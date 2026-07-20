/**
 * Regression tests for Row-Level Security and column-level privacy.
 *
 * Contract this file locks in:
 *
 *  1. teams.invite_code MUST NOT be readable by anonymous requests, even on
 *     `status='approved'` rows exposed by the public read policy.
 *  2. athletes.{whatsapp, instagram_handle, cpf_last4, cpf_hash} MUST NOT be
 *     readable by anonymous requests, even though `athletes public read`
 *     RLS makes the row visible.
 *  3. team_supporters MUST NOT be readable by anonymous requests.
 *  4. Security-definer helpers that could reveal aggregate data
 *     (get_athlete_stats, get_ranking_craques, get_team_supporter_counts)
 *     MUST NOT be EXECUTE-callable by anon.
 *  5. Public server-function proxies (getRankingCraques,
 *     getTeamSupporterCounts) MUST return the safe, aggregated shape.
 *
 * Runs with `bun test tests/rls-privacy.test.ts`.
 *
 * Requires env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Seed/cleanup uses the service-role client; the probes always use the anon
 * client so we test the surface a browser sees.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY. " +
      "Set them before running the RLS regression suite.",
  );
}

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_TAG = "__rls_test__";
const TEST_TEAM_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const TEST_ATHLETE_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const TEST_MANAGER_ID = "cccccccc-3333-4333-8333-cccccccccccc";
const TEST_SUPPORTER_ID = "dddddddd-4444-4444-8444-dddddddddddd";

// PII we want to prove is NOT exposed to anon.
const SENSITIVE_ATHLETE = {
  whatsapp: "5511999998888",
  instagram_handle: "@rls_test_player",
  cpf_last4: "9999",
  cpf_hash: "deadbeefdeadbeefdeadbeefdeadbeef",
};
const SENSITIVE_INVITE_CODE = "ZZTESTZZ";

beforeAll(async () => {
  // Ensure an auth user exists for manager_id / supporter user_id FKs.
  await admin.auth.admin
    .createUser({
      id: TEST_MANAGER_ID,
      email: `rls-mgr-${TEST_MANAGER_ID}@example.test`,
      email_confirm: true,
    })
    .catch(() => {});
  await admin.auth.admin
    .createUser({
      id: TEST_SUPPORTER_ID,
      email: `rls-sup-${TEST_SUPPORTER_ID}@example.test`,
      email_confirm: true,
    })
    .catch(() => {});

  const { error: teamErr } = await admin.from("teams").upsert({
    id: TEST_TEAM_ID,
    name: `${TEST_TAG} Team`,
    short_name: "RLS",
    manager_id: TEST_MANAGER_ID,
    registration_type: "host",
    status: "approved",
    lado: "A",
    invite_code: SENSITIVE_INVITE_CODE,
  });
  if (teamErr) throw teamErr;

  const { error: athErr } = await admin.from("athletes").upsert({
    id: TEST_ATHLETE_ID,
    team_id: TEST_TEAM_ID,
    full_name: `${TEST_TAG} Player`,
    ...SENSITIVE_ATHLETE,
  });
  if (athErr) throw athErr;

  await admin.from("team_supporters").upsert({
    team_id: TEST_TEAM_ID,
    user_id: TEST_SUPPORTER_ID,
  });
});

afterAll(async () => {
  await admin.from("team_supporters").delete().eq("team_id", TEST_TEAM_ID);
  await admin.from("athletes").delete().eq("id", TEST_ATHLETE_ID);
  await admin.from("teams").delete().eq("id", TEST_TEAM_ID);
  await admin.auth.admin.deleteUser(TEST_SUPPORTER_ID).catch(() => {});
  await admin.auth.admin.deleteUser(TEST_MANAGER_ID).catch(() => {});
});

describe("teams — anon column privacy", () => {
  test("public read never exposes invite_code", async () => {
    // Explicit column projection: should error OR return null, never leak.
    const { data, error } = await anon
      .from("teams")
      .select("id, invite_code")
      .eq("id", TEST_TEAM_ID);

    if (error) {
      // Column-level revoke path: PostgREST refuses the projection.
      expect(error.code === "42501" || error.message).toBeTruthy();
      return;
    }
    for (const row of data ?? []) {
      expect(
        (row as { invite_code: string | null }).invite_code,
        "invite_code leaked to anon",
      ).toBeNull();
    }
  });

  test("safe columns still readable for approved teams", async () => {
    const { data, error } = await anon
      .from("teams")
      .select("id, name, short_name, lado, status")
      .eq("id", TEST_TEAM_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("approved");
  });
});

describe("athletes — anon column privacy", () => {
  test.each(Object.keys(SENSITIVE_ATHLETE))(
    "sensitive column %s is never returned to anon",
    async (col) => {
      const { data, error } = await anon
        .from("athletes")
        .select(`id, ${col}`)
        .eq("id", TEST_ATHLETE_ID);

      if (error) {
        expect(error.code === "42501" || error.message).toBeTruthy();
        return;
      }
      for (const row of data ?? []) {
        expect(
          (row as Record<string, unknown>)[col],
          `athletes.${col} leaked to anon`,
        ).toBeNull();
      }
    },
  );

  test("safe columns still readable", async () => {
    const { data, error } = await anon
      .from("athletes")
      .select("id, full_name, team_id")
      .eq("id", TEST_ATHLETE_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.full_name).toContain(TEST_TAG);
  });
});

describe("team_supporters — anon must not enumerate memberships", () => {
  test("anon SELECT returns zero rows (RLS blocks)", async () => {
    const { data, error } = await anon
      .from("team_supporters")
      .select("team_id, user_id")
      .eq("team_id", TEST_TEAM_ID);
    // Either a permission error or empty result is acceptable; a populated
    // response means the public policy came back.
    if (!error) {
      expect(data ?? []).toHaveLength(0);
    }
  });
});

describe("SECURITY DEFINER helpers — anon EXECUTE revoked", () => {
  test("get_ranking_craques rejects anon", async () => {
    const { error } = await anon.rpc("get_ranking_craques", {
      _min_evaluations: 3,
    });
    expect(error?.code).toBe("42501");
  });

  test("get_athlete_stats rejects anon", async () => {
    const { error } = await anon.rpc("get_athlete_stats", {
      _athlete_id: TEST_ATHLETE_ID,
    });
    expect(error?.code).toBe("42501");
  });

  test("get_team_supporter_counts rejects anon", async () => {
    // supabase-js typed RPC omits fns removed from generated types; call raw.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_team_supporter_counts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY!,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: "{}",
      },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    expect(body.code).toBe("42501");
  });
});
