/**
 * Regression tests for `teams` RLS.
 *
 * Contract:
 *  1. anon MUST NOT read a pending/waitlist team (only 'approved' rows are
 *     public), and MUST NOT insert/update/delete any team.
 *  2. The manager CAN update their own team fields (safe columns) and status.
 *  3. Another authenticated user (not the manager, not a director, not admin)
 *     MUST NOT read a pending team, MUST NOT update any field of a team they
 *     don't own — either denied or zero rows affected.
 *  4. The manager MUST NOT reassign `manager_id` to someone else
 *     (prevent_team_manager_change trigger).
 *
 * Each run re-seeds two teams via the service-role client and probes with
 * real anon + authenticated clients.
 *
 * Run: `bun test tests/teams-rls.test.ts`
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = "__teams_rls__";
const MANAGER = {
  id: "aa000000-0001-4001-8001-aa0000000001",
  email: "teams-rls-mgr@example.test",
  password: "Passw0rd!Mgr#2026",
};
const MANAGER2 = {
  id: "aa000000-0004-4004-8004-aa0000000004",
  email: "teams-rls-mgr2@example.test",
  password: "Passw0rd!Mgr2#2026",
};
const OUTSIDER = {
  id: "aa000000-0002-4002-8002-aa0000000002",
  email: "teams-rls-out@example.test",
  password: "Passw0rd!Out#2026",
};
const OTHER_MGR_ID = "aa000000-0003-4003-8003-aa0000000003";

const APPROVED_TEAM_ID = "bb000000-0001-4001-8001-bb0000000001";
const PENDING_TEAM_ID = "bb000000-0002-4002-8002-bb0000000002";

function isDenied(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  if (err.code === "42501" || err.code === "PGRST301") return true;
  return /permission denied|violates row-level security|not allowed|only admins|only .* can change/i.test(
    err.message ?? "",
  );
}

async function signIn(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function reseed() {
  await admin
    .from("teams")
    .delete()
    .in("id", [APPROVED_TEAM_ID, PENDING_TEAM_ID]);
  for (const u of [MANAGER, OUTSIDER]) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
    const { error } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error && !/already/i.test(error.message)) throw error;
  }

  const { error: e1 } = await admin.from("teams").insert([
    {
      id: APPROVED_TEAM_ID,
      name: `${TAG} Approved`,
      short_name: "RLA",
      manager_id: MANAGER.id,
      registration_type: "host",
      status: "approved",
      lado: "A",
      home_venue: "Original Venue",
    },
    {
      id: PENDING_TEAM_ID,
      name: `${TAG} Pending`,
      short_name: "RLP",
      manager_id: MANAGER.id,
      registration_type: "host",
      status: "pending",
      lado: "A",
    },
  ]);
  if (e1) throw e1;
}

let mgrClient: SupabaseClient;
let outClient: SupabaseClient;

beforeAll(async () => {
  await reseed();
  mgrClient = await signIn(MANAGER.email, MANAGER.password);
  outClient = await signIn(OUTSIDER.email, OUTSIDER.password);
});

afterAll(async () => {
  await mgrClient?.auth.signOut().catch(() => {});
  await outClient?.auth.signOut().catch(() => {});
  await admin
    .from("teams")
    .delete()
    .in("id", [APPROVED_TEAM_ID, PENDING_TEAM_ID]);
  await admin.auth.admin.deleteUser(MANAGER.id).catch(() => {});
  await admin.auth.admin.deleteUser(OUTSIDER.id).catch(() => {});
});

describe("anon — no read/write on teams", () => {
  test("anon cannot see pending team", async () => {
    const { data, error } = await anon
      .from("teams")
      .select("id, status")
      .eq("id", PENDING_TEAM_ID);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test("anon can list approved teams (safe columns) but public-read only", async () => {
    const { data, error } = await anon
      .from("teams")
      .select("id, name, status")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("approved");
  });

  test("anon INSERT is denied", async () => {
    const { error } = await anon.from("teams").insert({
      name: "anon team",
      short_name: "AN",
      manager_id: MANAGER.id,
      registration_type: "host",
      status: "approved",
      lado: "A",
    });
    expect(isDenied(error)).toBe(true);
  });

  test("anon UPDATE on approved team is a no-op / denied", async () => {
    const { data, error } = await anon
      .from("teams")
      .update({ name: "hijacked" })
      .eq("id", APPROVED_TEAM_ID)
      .select();
    if (error) expect(isDenied(error)).toBe(true);
    else expect(data ?? []).toHaveLength(0);
    const { data: after } = await admin
      .from("teams")
      .select("name")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(after?.name).toBe(`${TAG} Approved`);
  });

  test("anon DELETE is a no-op / denied", async () => {
    const { data, error } = await anon
      .from("teams")
      .delete()
      .eq("id", APPROVED_TEAM_ID)
      .select();
    if (error) expect(isDenied(error)).toBe(true);
    else expect(data ?? []).toHaveLength(0);
    const { data: still } = await admin
      .from("teams")
      .select("id")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(still?.id).toBe(APPROVED_TEAM_ID);
  });
});

describe("manager — full read/update on own team only", () => {
  test("manager reads their own pending team", async () => {
    const { data, error } = await mgrClient
      .from("teams")
      .select("id, status, home_venue")
      .eq("id", PENDING_TEAM_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("pending");
  });

  test("manager can update safe fields on own team", async () => {
    const { error } = await mgrClient
      .from("teams")
      .update({ home_venue: "Updated Venue", primary_color: "#123456" })
      .eq("id", APPROVED_TEAM_ID);
    expect(error).toBeNull();
    const { data } = await admin
      .from("teams")
      .select("home_venue, primary_color")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(data?.home_venue).toBe("Updated Venue");
    expect(data?.primary_color).toBe("#123456");
  });

  test("manager can update status on own team", async () => {
    const { error } = await mgrClient
      .from("teams")
      .update({ status: "waitlist" })
      .eq("id", PENDING_TEAM_ID);
    expect(error).toBeNull();
    const { data } = await admin
      .from("teams")
      .select("status")
      .eq("id", PENDING_TEAM_ID)
      .single();
    expect(data?.status).toBe("waitlist");
  });

  test("manager CANNOT reassign manager_id (trigger guard)", async () => {
    const { error } = await mgrClient
      .from("teams")
      .update({ manager_id: OTHER_MGR_ID })
      .eq("id", APPROVED_TEAM_ID);
    expect(error).not.toBeNull();
    expect(isDenied(error)).toBe(true);
    const { data } = await admin
      .from("teams")
      .select("manager_id")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(data?.manager_id).toBe(MANAGER.id);
  });
});

describe("outsider — cannot read or edit another user's team", () => {
  test("outsider cannot see pending team", async () => {
    const { data, error } = await outClient
      .from("teams")
      .select("id")
      .eq("id", PENDING_TEAM_ID);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test("outsider sees approved team (public policy) but only safe read", async () => {
    const { data, error } = await outClient
      .from("teams")
      .select("id, name, status")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(APPROVED_TEAM_ID);
  });

  test("outsider UPDATE on approved team affects zero rows", async () => {
    const { data, error } = await outClient
      .from("teams")
      .update({ name: "outsider-pwn", status: "rejected" })
      .eq("id", APPROVED_TEAM_ID)
      .select();
    if (error) expect(isDenied(error)).toBe(true);
    else expect(data ?? []).toHaveLength(0);
    const { data: after } = await admin
      .from("teams")
      .select("name, status")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(after?.name).toBe(`${TAG} Approved`);
    expect(after?.status).toBe("approved");
  });

  test("outsider bulk UPDATE without filter cannot touch manager's rows", async () => {
    const { error } = await outClient
      .from("teams")
      .update({ name: "mass-pwn" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) expect(isDenied(error)).toBe(true);
    const { data } = await admin
      .from("teams")
      .select("id, name")
      .in("id", [APPROVED_TEAM_ID, PENDING_TEAM_ID]);
    for (const row of data ?? []) expect(row.name).toContain(TAG);
  });

  test("outsider DELETE is denied / no-op", async () => {
    const { data, error } = await outClient
      .from("teams")
      .delete()
      .eq("id", APPROVED_TEAM_ID)
      .select();
    if (error) expect(isDenied(error)).toBe(true);
    else expect(data ?? []).toHaveLength(0);
    const { data: still } = await admin
      .from("teams")
      .select("id")
      .eq("id", APPROVED_TEAM_ID)
      .single();
    expect(still?.id).toBe(APPROVED_TEAM_ID);
  });

  test("outsider cannot INSERT a team owned by someone else", async () => {
    const { error } = await outClient.from("teams").insert({
      name: "spoofed",
      short_name: "SP",
      manager_id: MANAGER.id, // spoof
      registration_type: "host",
      status: "approved",
      lado: "A",
    });
    expect(isDenied(error)).toBe(true);
  });
});
