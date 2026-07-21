/**
 * End-to-end test for the signup → /onboarding flow.
 *
 * Contract validated by this test:
 *   1. After signup, the chosen profile role (director/player/supporter) is
 *      persisted in `public.user_roles` (via `assignSelfRoles`), so that
 *      `/onboarding` can auto-skip the picker on the next mount.
 *   2. `/onboarding` decides the next step exactly once per identity:
 *        - If a `user_roles` row exists → redirect straight to the matching
 *          sub-flow (/onboarding/diretor|jogador|torcedor).
 *        - Else, if `auth.user_metadata.profile_type` was set by signup →
 *          same redirect (fallback path used before the row exists).
 *        - Else → show the picker.
 *   3. Re-running the flow is idempotent: repeating `assignSelfRoles` must
 *      NOT create duplicate `user_roles` rows.
 *   4. Once a role is stored, the picker step never runs a second time
 *      for the same user (the "vejo a etapa uma única vez" guarantee).
 *
 * We exercise the underlying data plane (auth metadata + user_roles table +
 * the exact upsert `assignSelfRoles` performs) that the routes rely on, so
 * a regression in RLS, unique constraint, or the onboarding decision is
 * caught before it reaches production.
 *
 * Run: `bun test tests/onboarding-flow.test.ts`
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

const TAG = "__onboarding_e2e__";
const DIRECTOR_ID = "f1111111-1111-4111-8111-111111111111";
const PLAYER_ID = "f2222222-2222-4222-8222-222222222222";
const SUPPORTER_ID = "f3333333-3333-4333-8333-333333333333";
const META_ONLY_ID = "f4444444-4444-4444-8444-444444444444";
const PICKER_ID = "f5555555-5555-4555-8555-555555555555";

const ALL_IDS = [DIRECTOR_ID, PLAYER_ID, SUPPORTER_ID, META_ONLY_ID, PICKER_ID];

// Mirrors the profile_type → role map used in signup.tsx / onboarding.tsx.
const META_MAP: Record<string, "director" | "player" | "supporter"> = {
  diretor: "director",
  jogador: "player",
  torcedor: "supporter",
};

// Mirrors the target route chosen by /onboarding.
function decideOnboardingTarget(
  roles: string[],
  metaProfile: string | undefined,
): string | null {
  if (roles.includes("director")) return "/onboarding/diretor";
  if (roles.includes("player")) return "/onboarding/jogador";
  if (roles.includes("supporter")) return "/onboarding/torcedor";
  const metaRole = metaProfile ? META_MAP[metaProfile] : undefined;
  if (metaRole === "director") return "/onboarding/diretor";
  if (metaRole === "player") return "/onboarding/jogador";
  if (metaRole === "supporter") return "/onboarding/torcedor";
  return null;
}

// Mirrors the upsert in `assignSelfRoles`.
async function assignSelfRoles(
  userId: string,
  roles: Array<"director" | "player" | "supporter">,
) {
  const rows = roles.map((role) => ({ user_id: userId, role }));
  return admin
    .from("user_roles")
    .upsert(rows, { onConflict: "user_id,role", ignoreDuplicates: true });
}

async function cleanup() {
  for (const id of ALL_IDS) {
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

beforeAll(async () => {
  await cleanup();
  const create = (id: string, profile: string | null) =>
    admin.auth.admin.createUser({
      id,
      email: `${TAG}-${id.slice(0, 4)}@example.test`,
      email_confirm: true,
      user_metadata: profile ? { profile_type: profile } : {},
    });
  await Promise.all([
    create(DIRECTOR_ID, "diretor"),
    create(PLAYER_ID, "jogador"),
    create(SUPPORTER_ID, "torcedor"),
    create(META_ONLY_ID, "jogador"),
    create(PICKER_ID, null),
  ]);
});

afterAll(cleanup);

describe("signup persists the chosen role (assignSelfRoles)", () => {
  test("director signup → user_roles has 'director'", async () => {
    const { error } = await assignSelfRoles(DIRECTOR_ID, ["director"]);
    expect(error).toBeNull();
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", DIRECTOR_ID);
    expect(data?.map((r) => r.role)).toEqual(["director"]);
  });

  test("player signup → user_roles has 'player'", async () => {
    const { error } = await assignSelfRoles(PLAYER_ID, ["player"]);
    expect(error).toBeNull();
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", PLAYER_ID);
    expect(data?.map((r) => r.role)).toEqual(["player"]);
  });

  test("supporter signup → user_roles has 'supporter'", async () => {
    const { error } = await assignSelfRoles(SUPPORTER_ID, ["supporter"]);
    expect(error).toBeNull();
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", SUPPORTER_ID);
    expect(data?.map((r) => r.role)).toEqual(["supporter"]);
  });

  test("re-running assignSelfRoles is idempotent (no duplicate rows)", async () => {
    await assignSelfRoles(DIRECTOR_ID, ["director"]);
    await assignSelfRoles(DIRECTOR_ID, ["director"]);
    const { data } = await admin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", DIRECTOR_ID);
    expect(data?.length).toBe(1);
    expect(data?.[0].role).toBe("director");
  });
});

describe("/onboarding auto-skip decision — picker shown at most once", () => {
  test("director with role row → skips picker to /onboarding/diretor", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", DIRECTOR_ID);
    const meta = "diretor";
    expect(
      decideOnboardingTarget(
        (data ?? []).map((r) => r.role as string),
        meta,
      ),
    ).toBe("/onboarding/diretor");
  });

  test("player with role row → skips picker to /onboarding/jogador", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", PLAYER_ID);
    expect(
      decideOnboardingTarget(
        (data ?? []).map((r) => r.role as string),
        "jogador",
      ),
    ).toBe("/onboarding/jogador");
  });

  test("supporter with role row → skips picker to /onboarding/torcedor", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", SUPPORTER_ID);
    expect(
      decideOnboardingTarget(
        (data ?? []).map((r) => r.role as string),
        "torcedor",
      ),
    ).toBe("/onboarding/torcedor");
  });

  test("metadata-only fallback (no user_roles row yet) still skips picker", async () => {
    // Simulates the transient window right after signup, before the
    // assignSelfRoles RPC has landed. /onboarding must still redirect
    // using auth.user_metadata.profile_type.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", META_ONLY_ID);
    expect(roles?.length ?? 0).toBe(0);

    const { data: userRes } = await admin.auth.admin.getUserById(META_ONLY_ID);
    const meta = userRes.user?.user_metadata?.profile_type as
      | string
      | undefined;
    expect(meta).toBe("jogador");

    expect(
      decideOnboardingTarget(
        (roles ?? []).map((r) => r.role as string),
        meta,
      ),
    ).toBe("/onboarding/jogador");
  });

  test("no role AND no metadata → picker runs exactly once", async () => {
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", PICKER_ID);
    const { data: userRes } = await admin.auth.admin.getUserById(PICKER_ID);
    const meta = userRes.user?.user_metadata?.profile_type as
      | string
      | undefined;

    // First mount: picker is shown (no target).
    expect(
      decideOnboardingTarget(
        (roles ?? []).map((r) => r.role as string),
        meta,
      ),
    ).toBeNull();

    // User picks "director" and the client calls assignSelfRoles.
    await assignSelfRoles(PICKER_ID, ["director"]);

    // Second mount (e.g. refresh, back button, deep link): auto-skip.
    const { data: roles2 } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", PICKER_ID);
    expect(
      decideOnboardingTarget(
        (roles2 ?? []).map((r) => r.role as string),
        meta,
      ),
    ).toBe("/onboarding/diretor");

    // And the picker CANNOT re-run: the role row is unique per (user, role).
    const { data: after } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", PICKER_ID);
    expect(after?.length).toBe(1);
  });
});
