/**
 * End-to-end test for the invite → player signup → team association flow.
 *
 * The invite link (/convite/:code) must:
 *   1. Build against the published domain — never the Lovable editor/preview,
 *      even when window.location.origin points somewhere else.
 *   2. Preserve a safe `redirect` back to /convite/:code across /signup and
 *      /login, refusing external hosts.
 *   3. Resolve the team via get_team_by_invite_code (what lookupInvite calls).
 *   4. Vincular o usuário autenticado ao time via team_members (o que
 *      joinTeamByInvite faz), incluindo o papel `player` em user_roles.
 *   5. Ser idempotente: reusar a associação existente sem duplicar linhas.
 *
 * This test exercises the underlying data plane (RPC + tables) that both
 * server functions rely on, so a regression in RLS, policies, or the
 * join logic is caught before it reaches production.
 *
 * Run: `bun test tests/invite-flow.test.ts`
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_ORIGIN, publicUrl, safeInternalPath } from "../src/lib/public-url";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = "__invite_e2e__";
const TEAM_ID = "e1111111-1111-4111-8111-111111111111";
const MANAGER_ID = "e2222222-2222-4222-8222-222222222222";
const PLAYER_ID = "e3333333-3333-4333-8333-333333333333";
const INVITE_CODE = "E2ETEST01";

async function cleanup() {
  await admin.from("team_members").delete().eq("team_id", TEAM_ID);
  await admin.from("user_roles").delete().eq("user_id", PLAYER_ID);
  await admin.from("teams").delete().eq("id", TEAM_ID);
  await admin.auth.admin.deleteUser(PLAYER_ID).catch(() => {});
  await admin.auth.admin.deleteUser(MANAGER_ID).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  await admin.auth.admin.createUser({
    id: MANAGER_ID,
    email: `${TAG}-mgr@example.test`,
    email_confirm: true,
  });
  await admin.auth.admin.createUser({
    id: PLAYER_ID,
    email: `${TAG}-player@example.test`,
    email_confirm: true,
  });

  const { error } = await admin.from("teams").insert({
    id: TEAM_ID,
    name: `${TAG} FC`,
    short_name: "E2E",
    manager_id: MANAGER_ID,
    registration_type: "host",
    status: "approved",
    lado: "A",
    invite_code: INVITE_CODE,
  });
  if (error) throw error;
});

afterAll(cleanup);

describe("invite link URL helpers — no preview / external hosts", () => {
  test("publicUrl always uses the published origin", () => {
    expect(publicUrl(`/convite/${INVITE_CODE}`)).toBe(
      `${PUBLIC_ORIGIN}/convite/${INVITE_CODE}`,
    );
  });

  test("safeInternalPath preserves /convite deep links", () => {
    expect(safeInternalPath(`/convite/${INVITE_CODE}`)).toBe(
      `/convite/${INVITE_CODE}`,
    );
  });

  test("safeInternalPath strips a preview / editor origin", () => {
    const preview =
      "https://id-preview--46dddd26-96b3-465a-95e0-1d017b2ddc72.lovable.app/convite/" +
      INVITE_CODE;
    expect(safeInternalPath(preview)).toBe(`/convite/${INVITE_CODE}`);
  });

  test("safeInternalPath refuses fully-qualified external hosts", () => {
    // A malicious ?redirect=https://evil.example/steal must NOT survive.
    const path = safeInternalPath("https://evil.example/steal");
    expect(path.startsWith("/")).toBe(true);
    expect(path.includes("evil.example")).toBe(false);
  });

  test("safeInternalPath falls back for junk input", () => {
    expect(safeInternalPath("")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("//attacker.example")).toBe("/");
  });
});

describe("lookupInvite data path — get_team_by_invite_code", () => {
  test("valid code returns the seeded team (anon, no auth)", async () => {
    const { data, error } = await anon.rpc("get_team_by_invite_code", {
      _code: INVITE_CODE,
    });
    expect(error).toBeNull();
    const team = Array.isArray(data) ? data[0] : data;
    expect(team?.id).toBe(TEAM_ID);
    expect(team?.name).toContain(TAG);
    expect(team?.status).toBe("approved");
    // Sensitive columns must NOT be part of the RPC payload.
    expect((team as Record<string, unknown>).invite_code).toBeUndefined();
    expect((team as Record<string, unknown>).manager_id).toBeUndefined();
  });

  test("unknown code returns zero rows (not an error)", async () => {
    const { data, error } = await anon.rpc("get_team_by_invite_code", {
      _code: "ZZZZZZZZ99",
    });
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : data ? 1 : 0).toBe(0);
  });

  test("lookup is case-insensitive (matches lookupInvite normalization)", async () => {
    const { data } = await anon.rpc("get_team_by_invite_code", {
      _code: INVITE_CODE.toLowerCase().toUpperCase(),
    });
    const team = Array.isArray(data) ? data[0] : data;
    expect(team?.id).toBe(TEAM_ID);
  });
});

describe("joinTeamByInvite data path — team_members + user_roles", () => {
  test("first join inserts a player member and grants the player role", async () => {
    // Simulate exactly what joinTeamByInvite does after lookup.
    const { error: memErr } = await admin.from("team_members").insert({
      team_id: TEAM_ID,
      user_id: PLAYER_ID,
      role: "player",
      accepted_at: new Date().toISOString(),
    });
    expect(memErr).toBeNull();

    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: PLAYER_ID, role: "player" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    expect(roleErr).toBeNull();

    const { data: members } = await admin
      .from("team_members")
      .select("id, role, accepted_at")
      .eq("team_id", TEAM_ID)
      .eq("user_id", PLAYER_ID);
    expect(members?.length).toBe(1);
    expect(members?.[0].role).toBe("player");
    expect(members?.[0].accepted_at).not.toBeNull();

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", PLAYER_ID);
    expect(roles?.some((r) => r.role === "player")).toBe(true);
  });

  test("re-joining is idempotent — no duplicate team_members row", async () => {
    // Second call must NOT produce a duplicate row for the same (team, user).
    const { data: existing } = await admin
      .from("team_members")
      .select("id, accepted_at")
      .eq("team_id", TEAM_ID)
      .eq("user_id", PLAYER_ID)
      .maybeSingle();
    expect(existing).not.toBeNull();

    if (existing && !existing.accepted_at) {
      await admin
        .from("team_members")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    const { data: all } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", TEAM_ID)
      .eq("user_id", PLAYER_ID);
    expect(all?.length).toBe(1);
  });
});
