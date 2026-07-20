/**
 * Regression tests for `profiles` RLS.
 *
 * Contract:
 *  1. anon MUST NOT read any profile row.
 *  2. anon MUST NOT insert / update / delete any profile.
 *  3. An authenticated user CAN read and update their own row.
 *  4. An authenticated user MUST NOT read another user's profile row.
 *  5. An authenticated user MUST NOT update another user's row — either the
 *     write is denied outright or zero rows are affected.
 *  6. An authenticated user MUST NOT change their own `id` (identity theft).
 *
 * Every test re-seeds two isolated profiles via the service-role client and
 * probes with real anon / authenticated clients — the same surfaces a
 * browser sees.
 *
 * Run: `bun test tests/profiles-rls.test.ts`
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = "__profiles_rls__";
const USER_A = {
  id: "11111111-aaaa-4aaa-8aaa-111111111111",
  email: "profiles-rls-a@example.test",
  password: "Passw0rd!TestA#2026",
};
const USER_B = {
  id: "22222222-bbbb-4bbb-8bbb-222222222222",
  email: "profiles-rls-b@example.test",
  password: "Passw0rd!TestB#2026",
};

function isPermissionDenied(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  if (err.code === "42501" || err.code === "PGRST301") return true;
  return /permission denied|not allowed|violates row-level security/i.test(
    err.message ?? "",
  );
}

async function signedInClient(email: string, password: string) {
  const client: SupabaseClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function reseed() {
  // Wipe profile rows and users so a stale run can't hide a leak.
  await admin.from("profiles").delete().in("id", [USER_A.id, USER_B.id]);
  await admin.auth.admin.deleteUser(USER_A.id).catch(() => {});
  await admin.auth.admin.deleteUser(USER_B.id).catch(() => {});

  for (const u of [USER_A, USER_B]) {
    const { error } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error && !/already/i.test(error.message)) throw error;
  }

  // Upsert clean profile rows (handle_new_user trigger may have seeded them).
  const { error: pErr } = await admin.from("profiles").upsert([
    { id: USER_A.id, full_name: `${TAG} A`, phone: "111", nickname: "alpha" },
    { id: USER_B.id, full_name: `${TAG} B`, phone: "222", nickname: "bravo" },
  ]);
  if (pErr) throw pErr;
}

let clientA: SupabaseClient;
let clientB: SupabaseClient;

beforeAll(async () => {
  await reseed();
  clientA = await signedInClient(USER_A.email, USER_A.password);
  clientB = await signedInClient(USER_B.email, USER_B.password);
});

afterAll(async () => {
  await clientA?.auth.signOut().catch(() => {});
  await clientB?.auth.signOut().catch(() => {});
  await admin.from("profiles").delete().in("id", [USER_A.id, USER_B.id]);
  await admin.auth.admin.deleteUser(USER_A.id).catch(() => {});
  await admin.auth.admin.deleteUser(USER_B.id).catch(() => {});
});

describe("anon has no access to profiles", () => {
  test("SELECT returns error or zero rows", async () => {
    const { data, error } = await anon.from("profiles").select("*").limit(10);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });

  test("SELECT by id returns error or zero rows", async () => {
    const { data, error } = await anon
      .from("profiles")
      .select("*")
      .eq("id", USER_A.id);
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });

  test("INSERT is denied", async () => {
    const { error } = await anon
      .from("profiles")
      .insert({ id: crypto.randomUUID(), full_name: "anon insert" });
    expect(error).not.toBeNull();
    expect(isPermissionDenied(error)).toBe(true);
  });

  test("UPDATE affects zero rows or errors", async () => {
    const { data, error } = await anon
      .from("profiles")
      .update({ full_name: "hijacked" })
      .eq("id", USER_A.id)
      .select();
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    // Confirm persisted state is untouched.
    const { data: after } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", USER_A.id)
      .single();
    expect(after?.full_name).toBe(`${TAG} A`);
  });

  test("DELETE affects zero rows or errors", async () => {
    const { data, error } = await anon
      .from("profiles")
      .delete()
      .eq("id", USER_A.id)
      .select();
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    const { data: still } = await admin
      .from("profiles")
      .select("id")
      .eq("id", USER_A.id)
      .single();
    expect(still?.id).toBe(USER_A.id);
  });
});

describe("authenticated user can only touch their own profile", () => {
  test("A reads own row", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("id, full_name")
      .eq("id", USER_A.id)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(USER_A.id);
  });

  test("A cannot read B's row (zero rows, not an error)", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("*")
      .eq("id", USER_B.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test("A can update own field", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ nickname: "alpha-renamed" })
      .eq("id", USER_A.id);
    expect(error).toBeNull();
    const { data } = await admin
      .from("profiles")
      .select("nickname")
      .eq("id", USER_A.id)
      .single();
    expect(data?.nickname).toBe("alpha-renamed");
  });

  test("A cannot update B's row (0 rows affected, B untouched)", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .update({ full_name: "attacked-by-A", nickname: "pwned" })
      .eq("id", USER_B.id)
      .select();
    // Either denied or silently filtered — both are acceptable, mutation is not.
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    const { data: bAfter } = await admin
      .from("profiles")
      .select("full_name, nickname")
      .eq("id", USER_B.id)
      .single();
    expect(bAfter?.full_name).toBe(`${TAG} B`);
    expect(bAfter?.nickname).toBe("bravo");
  });

  test("A cannot bulk-update by omitting the id filter", async () => {
    // Attempt to overwrite every row visible; RLS must scope this to A only.
    const { error } = await clientA
      .from("profiles")
      .update({ nickname: "mass-pwn" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
    }
    const { data: bAfter } = await admin
      .from("profiles")
      .select("nickname")
      .eq("id", USER_B.id)
      .single();
    expect(bAfter?.nickname).toBe("bravo");
  });

  test("A cannot change their own id to steal another account", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ id: USER_B.id })
      .eq("id", USER_A.id);
    // Either RLS/FK denies it, or the row keeps its original id.
    if (!error) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("id", USER_A.id)
        .maybeSingle();
      expect(data?.id).toBe(USER_A.id);
    } else {
      expect(error).not.toBeNull();
    }
  });

  test("A cannot delete B's profile", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .delete()
      .eq("id", USER_B.id)
      .select();
    if (error) {
      expect(isPermissionDenied(error)).toBe(true);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    const { data: still } = await admin
      .from("profiles")
      .select("id")
      .eq("id", USER_B.id)
      .single();
    expect(still?.id).toBe(USER_B.id);
  });

  test("B's view of themself is unaffected by A's attempts", async () => {
    const { data, error } = await clientB
      .from("profiles")
      .select("full_name, nickname")
      .eq("id", USER_B.id)
      .single();
    expect(error).toBeNull();
    expect(data?.full_name).toBe(`${TAG} B`);
    expect(data?.nickname).toBe("bravo");
  });
});
