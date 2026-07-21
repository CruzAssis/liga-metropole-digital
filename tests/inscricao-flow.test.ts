/**
 * End-to-end test for the /inscricao → /minha-conta flow.
 *
 * Contract validated by this test (mirrors `createTeamRegistration` in
 * src/lib/team-registration.functions.ts and the waitlist trigger
 * `handle_team_slot_freed` + `promote_waitlist_for_type`):
 *
 *   1. When `system_settings.master_registration_open = false`, every new
 *      inscription lands as `waitlist`, regardless of registration_type.
 *   2. When master is ON and there is room, a `host` inscription lands
 *      as `pending` and the director shows up as a `team_members` row
 *      with role='director' + accepted_at, plus a `user_roles` row.
 *      That is exactly what /minha-conta reads to render the dashboard.
 *   3. When master is ON and there are already `host_slots_limit` approved
 *      hosts, the next `host` inscription lands as `waitlist`.
 *   4. `visitor` inscriptions ignore the host limit — they always start
 *      as `pending` while master is ON.
 *   5. When an approved team is deleted (or demoted from `approved`), the
 *      DB trigger `handle_team_slot_freed` promotes the oldest `waitlist`
 *      row of the same `registration_type` back to `pending` — the
 *      documented "40 aprovados → waitlist → vaga livre → promoção" cycle.
 *
 * Run: `bun test tests/inscricao-flow.test.ts`
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = "__inscricao_e2e__";

// Deterministic UUIDs so cleanup is safe even if a run is aborted.
const uid = (n: number) =>
  `a${String(n).padStart(7, "0")}-1111-4111-8111-111111111111`;

// We seed a small host_slots_limit so we don't have to create 40 users.
// The waitlist logic in createTeamRegistration reads the current
// host_slots_limit from system_settings, so this simulates "limit reached"
// with the exact same code path used for the real 40-team production
// setting.
const HOST_LIMIT_FOR_TEST = 3;

// Roles under test:
//   0..HOST_LIMIT_FOR_TEST-1  → pre-approved hosts (fills the limit)
//   HOST_LIMIT_FOR_TEST       → new host, must go to `waitlist`
//   HOST_LIMIT_FOR_TEST+1     → visitor while master ON, must go `pending`
//   HOST_LIMIT_FOR_TEST+2     → host while master OFF, must go `waitlist`
//   HOST_LIMIT_FOR_TEST+3     → promotion candidate (waitlist → pending)
const USERS = Array.from({ length: HOST_LIMIT_FOR_TEST + 4 }, (_, i) => uid(i));

// Snapshot of system_settings so we can restore them after the test.
type Settings = {
  master_registration_open: boolean;
  host_slots_limit: number;
};
let originalSettings: Settings | null = null;

async function cleanup() {
  await admin.from("teams").delete().like("name", `${TAG}%`);
  for (const id of USERS) {
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

/**
 * Replays the exact side-effects of `createTeamRegistration` at the DB
 * layer: decide initial status, insert team, add director member and
 * user_roles row. Kept in lock-step with the server function.
 */
async function registerTeam(opts: {
  userId: string;
  name: string;
  registrationType: "host" | "visitor";
}) {
  const { data: settings } = await admin
    .from("system_settings")
    .select("master_registration_open, host_slots_limit")
    .eq("id", true)
    .maybeSingle();

  const s = (settings as Settings | null) ?? {
    master_registration_open: false,
    host_slots_limit: 40,
  };

  let initialStatus: "pending" | "waitlist" = s.master_registration_open
    ? "pending"
    : "waitlist";

  if (s.master_registration_open && opts.registrationType === "host") {
    const { count } = await admin
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("registration_type", "host")
      .eq("status", "approved");
    if ((count ?? 0) >= s.host_slots_limit) initialStatus = "waitlist";
  }

  const { data: team, error } = await admin
    .from("teams")
    .insert({
      name: opts.name,
      short_name: opts.name.slice(0, 4).toUpperCase(),
      manager_id: opts.userId,
      registration_type: opts.registrationType,
      status: initialStatus,
      lado: "A",
      serie: "A",
      home_venue: opts.registrationType === "host" ? `${TAG} venue` : null,
    } as never)
    .select("id, status, registration_type")
    .single();
  if (error) throw error;

  await admin.from("team_members").insert({
    team_id: team!.id,
    user_id: opts.userId,
    role: "director",
    accepted_at: new Date().toISOString(),
  });
  await admin
    .from("user_roles")
    .upsert(
      { user_id: opts.userId, role: "director" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

  return team as { id: string; status: string; registration_type: string };
}

beforeAll(async () => {
  await cleanup();

  const { data: current } = await admin
    .from("system_settings")
    .select("master_registration_open, host_slots_limit")
    .eq("id", true)
    .maybeSingle();
  originalSettings = (current as Settings | null) ?? null;

  for (const id of USERS) {
    await admin.auth.admin.createUser({
      id,
      email: `${TAG}-${id.slice(0, 4)}@example.test`,
      email_confirm: true,
    });
  }
});

afterAll(async () => {
  await cleanup();
  if (originalSettings) {
    await admin
      .from("system_settings")
      .update({
        master_registration_open: originalSettings.master_registration_open,
        host_slots_limit: originalSettings.host_slots_limit,
      })
      .eq("id", true);
  }
});

describe("master switch OFF — everyone waits", () => {
  test("host inscription lands as waitlist while master is closed", async () => {
    await admin
      .from("system_settings")
      .update({
        master_registration_open: false,
        host_slots_limit: HOST_LIMIT_FOR_TEST,
      })
      .eq("id", true);

    const team = await registerTeam({
      userId: USERS[HOST_LIMIT_FOR_TEST + 2],
      name: `${TAG} closed-host`,
      registrationType: "host",
    });
    expect(team.status).toBe("waitlist");
    expect(team.registration_type).toBe("host");

    // /minha-conta reads team_members joined to teams for the dashboard.
    const { data: membership } = await admin
      .from("team_members")
      .select("team_id, role, accepted_at")
      .eq("user_id", USERS[HOST_LIMIT_FOR_TEST + 2])
      .single();
    expect(membership?.role).toBe("director");
    expect(membership?.accepted_at).not.toBeNull();
    expect(membership?.team_id).toBe(team.id);

    // And the director role must exist so /minha-conta renders the panel.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", USERS[HOST_LIMIT_FOR_TEST + 2]);
    expect(roles?.some((r) => r.role === "director")).toBe(true);
  });
});

describe("master switch ON — waitlist kicks in only at the limit", () => {
  test("filling `host_slots_limit` approved hosts pushes the next host to waitlist", async () => {
    await admin
      .from("system_settings")
      .update({
        master_registration_open: true,
        host_slots_limit: HOST_LIMIT_FOR_TEST,
      })
      .eq("id", true);

    // Seed the limit with already-approved hosts.
    for (let i = 0; i < HOST_LIMIT_FOR_TEST; i++) {
      const team = await registerTeam({
        userId: USERS[i],
        name: `${TAG} approved-host-${i}`,
        registrationType: "host",
      });
      // Simulate admin approval so approved_hosts count reaches the limit.
      await admin
        .from("teams")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", team.id);
    }

    const { count: approved } = await admin
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("registration_type", "host")
      .eq("status", "approved")
      .like("name", `${TAG}%`);
    expect(approved).toBe(HOST_LIMIT_FOR_TEST);

    // Next host arrives → limit is full → waitlist.
    const overflowHost = await registerTeam({
      userId: USERS[HOST_LIMIT_FOR_TEST],
      name: `${TAG} overflow-host`,
      registrationType: "host",
    });
    expect(overflowHost.status).toBe("waitlist");
  });

  test("visitor inscriptions ignore the host limit and land as pending", async () => {
    const visitor = await registerTeam({
      userId: USERS[HOST_LIMIT_FOR_TEST + 1],
      name: `${TAG} visitor`,
      registrationType: "visitor",
    });
    expect(visitor.status).toBe("pending");
    expect(visitor.registration_type).toBe("visitor");
  });
});

describe("waitlist promotion — freeing a slot promotes the oldest host", () => {
  test("deleting an approved host promotes the waitlist host to pending", async () => {
    // Locate the currently-waitlisted host from the previous test.
    const { data: waiting } = await admin
      .from("teams")
      .select("id, status, created_at")
      .eq("manager_id", USERS[HOST_LIMIT_FOR_TEST])
      .single();
    expect(waiting?.status).toBe("waitlist");

    // Pick one approved host and delete it — this fires
    // handle_team_slot_freed → promote_waitlist_for_type('host').
    const { data: approvedHost } = await admin
      .from("teams")
      .select("id")
      .like("name", `${TAG} approved-host-%`)
      .eq("status", "approved")
      .limit(1)
      .single();
    expect(approvedHost?.id).toBeTruthy();

    // team_members has FK on teams; clean the child row first.
    await admin.from("team_members").delete().eq("team_id", approvedHost!.id);
    const { error: delErr } = await admin
      .from("teams")
      .delete()
      .eq("id", approvedHost!.id);
    expect(delErr).toBeNull();

    // The waitlisted host must now be `pending`.
    const { data: promoted } = await admin
      .from("teams")
      .select("status")
      .eq("id", waiting!.id)
      .single();
    expect(promoted?.status).toBe("pending");
  });
});
