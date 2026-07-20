/**
 * Regression tests for Row-Level Security and column-level privacy.
 *
 * After the privacy migration, anon MUST see one of the following for each
 * leaked column / sensitive relation:
 *   - a PostgREST permission error (42501 / permission denied), OR
 *   - zero rows returned, OR
 *   - rows where the leaked field is null / missing / empty string.
 *
 * A populated sensitive value is always a hard fail — even when the row is
 * otherwise visible through a public read policy.
 *
 * The suite re-seeds deterministic fixtures with the service-role client on
 * every run (delete → insert), then probes with the anon client so we test
 * the exact surface a browser sees.
 *
 * Run: `bun test tests/rls-privacy.test.ts`
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
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

// PII / secrets that MUST NOT reach anon.
const SENSITIVE_ATHLETE = {
  whatsapp: "5511999998888",
  instagram_handle: "@rls_test_player",
  cpf_last4: "9999",
  cpf_hash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
};
const SENSITIVE_ATHLETE_COLS = Object.keys(
  SENSITIVE_ATHLETE,
) as (keyof typeof SENSITIVE_ATHLETE)[];
const SENSITIVE_ATHLETE_VALUES = new Set<string>(
  Object.values(SENSITIVE_ATHLETE),
);
const SENSITIVE_INVITE_CODE = "ZZTESTZZ";

/** A leaked field means: not null, not undefined, not empty string. */
function isLeaked(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/** True if the anon error is a permission denial (42501) — expected shape. */
function isPermissionDenied(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  if (err.code === "42501") return true;
  return /permission denied|not allowed|insufficient/i.test(err.message ?? "");
}

async function reseed() {
  // Wipe (children first) so a partially seeded state from a previous run
  // never masks a leak.
  await admin.from("team_supporters").delete().eq("team_id", TEST_TEAM_ID);
  await admin.from("athletes").delete().eq("id", TEST_ATHLETE_ID);
  await admin.from("teams").delete().eq("id", TEST_TEAM_ID);

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

  const { error: teamErr } = await admin.from("teams").insert({
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

  const { error: athErr } = await admin.from("athletes").insert({
    id: TEST_ATHLETE_ID,
    team_id: TEST_TEAM_ID,
    full_name: `${TEST_TAG} Player`,
    ...SENSITIVE_ATHLETE,
  });
  if (athErr) throw athErr;

  const { error: supErr } = await admin
    .from("team_supporters")
    .insert({ team_id: TEST_TEAM_ID, user_id: TEST_SUPPORTER_ID });
  if (supErr) throw supErr;
}

beforeAll(async () => {
  await reseed();
});

afterAll(async () => {
  await admin.from("team_supporters").delete().eq("team_id", TEST_TEAM_ID);
  await admin.from("athletes").delete().eq("id", TEST_ATHLETE_ID);
  await admin.from("teams").delete().eq("id", TEST_TEAM_ID);
  await admin.auth.admin.deleteUser(TEST_SUPPORTER_ID).catch(() => {});
  await admin.auth.admin.deleteUser(TEST_MANAGER_ID).catch(() => {});
});

describe("teams — anon column privacy (invite_code)", () => {
  test("explicit projection: invite_code errors, is null, or absent", async () => {
    const { data, error } = await anon
      .from("teams")
      .select("id, invite_code")
      .eq("id", TEST_TEAM_ID);

    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    // Zero rows is fine (public read denied); otherwise field must be blank.
    for (const row of data ?? []) {
      const val = (row as { invite_code?: unknown }).invite_code;
      expect(
        isLeaked(val),
        `invite_code leaked to anon: ${JSON.stringify(val)}`,
      ).toBe(false);
    }
  });

  test("select('*'): row payload never carries invite_code value", async () => {
    const { data, error } = await anon
      .from("teams")
      .select("*")
      .eq("id", TEST_TEAM_ID);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    for (const row of data ?? []) {
      const val = (row as Record<string, unknown>).invite_code;
      expect(val === undefined || val === null || val === "").toBe(true);
      // Belt-and-braces: the seeded secret must not appear on any field.
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        expect(
          v === SENSITIVE_INVITE_CODE,
          `invite_code value surfaced on teams.${k}`,
        ).toBe(false);
      }
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

describe("athletes — anon column privacy (PII)", () => {
  test.each(SENSITIVE_ATHLETE_COLS)(
    "explicit projection of %s: error, zero rows, or null",
    async (col) => {
      const { data, error } = await anon
        .from("athletes")
        .select(`id, ${col}`)
        .eq("id", TEST_ATHLETE_ID);

      if (error) {
        expect(isPermissionDenied(error)).toBe(true);
        return;
      }
      for (const row of data ?? []) {
        const val = (row as Record<string, unknown>)[col];
        expect(isLeaked(val), `athletes.${col} leaked to anon: ${val}`).toBe(
          false,
        );
      }
    },
  );

  test("select('*'): no sensitive value appears on any field", async () => {
    const { data, error } = await anon
      .from("athletes")
      .select("*")
      .eq("id", TEST_ATHLETE_ID);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    for (const row of data ?? []) {
      // Sensitive columns must be null / empty / absent.
      for (const col of SENSITIVE_ATHLETE_COLS) {
        const val = (row as Record<string, unknown>)[col];
        expect(isLeaked(val), `athletes.${col} leaked via select('*')`).toBe(
          false,
        );
      }
      // Even if columns were renamed, the seeded secret values must never
      // appear on any field of the payload.
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (typeof v !== "string") continue;
        expect(
          SENSITIVE_ATHLETE_VALUES.has(v),
          `sensitive value surfaced on athletes.${k}: ${v}`,
        ).toBe(false);
      }
    }
  });

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
  test("anon SELECT: permission denied or zero rows", async () => {
    const { data, error } = await anon
      .from("team_supporters")
      .select("team_id, user_id")
      .eq("team_id", TEST_TEAM_ID);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });

  test("anon SELECT('*') on the whole table returns zero rows", async () => {
    // Cross-check: unfiltered probe must also stay empty, so a permissive
    // policy regression can't hide behind our .eq() filter.
    const { data, error } = await anon
      .from("team_supporters")
      .select("*")
      .limit(5);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });
});

describe("SECURITY DEFINER helpers — anon EXECUTE revoked", () => {
  test("get_ranking_craques rejects anon", async () => {
    const { error } = await anon.rpc("get_ranking_craques", {
      _min_evaluations: 3,
    });
    expect(isPermissionDenied(error)).toBe(true);
  });

  test("get_athlete_stats rejects anon", async () => {
    const { error } = await anon.rpc("get_athlete_stats", {
      _athlete_id: TEST_ATHLETE_ID,
    });
    expect(isPermissionDenied(error)).toBe(true);
  });

  test("get_team_supporter_counts rejects anon", async () => {
    // supabase-js typed RPC drops fns absent from generated types; call raw.
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
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    expect(isPermissionDenied(body)).toBe(true);
  });
});
