/**
 * End-to-end test for shield/logo upload during /inscricao and its
 * persistence into /minha-conta after admin approval.
 *
 * Contract validated (mirrors `TeamCustomizationCard.upload` in
 * src/components/teams/TeamCustomizationCard.tsx and the /minha-conta
 * team read in src/routes/_authenticated/minha-conta.tsx):
 *
 *   1. Uploading an image to the `team-logos` bucket at
 *      `logos/<team_id>/<ts>.png` succeeds and the returned public URL
 *      is reachable.
 *   2. Persisting `logo_url` on `teams` via `.update({ logo_url })` is
 *      accepted while the team is still `pending`/`waitlist` (the
 *      /inscricao path — the director sets the shield before approval).
 *   3. After admin approval (`status='approved'`), the same
 *      `id,name,logo_url,...` SELECT that /minha-conta issues returns
 *      the previously-saved `logo_url` unchanged.
 *   4. The stored `logo_url` matches the bucket public URL — so the
 *      <img src={team.logo_url}> on /minha-conta will actually resolve.
 *
 * Run: `bun test tests/inscricao-logo-flow.test.ts`
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

const TAG = "__logo_e2e__";
const USER_ID = "b0000001-2222-4222-8222-222222222222";
const BUCKET = "team-logos";

// A minimal but valid 1x1 transparent PNG.
const PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

let teamId: string | null = null;
let uploadedPath: string | null = null;

async function cleanup() {
  if (uploadedPath) {
    await admin.storage.from(BUCKET).remove([uploadedPath]).catch(() => {});
  }
  await admin.from("teams").delete().like("name", `${TAG}%`);
  await admin.from("user_roles").delete().eq("user_id", USER_ID);
  await admin.auth.admin.deleteUser(USER_ID).catch(() => {});
}

beforeAll(async () => {
  await cleanup();
  await admin.auth.admin.createUser({
    id: USER_ID,
    email: `${TAG}@example.test`,
    email_confirm: true,
  });

  // Simulate the /inscricao insert (pending, no logo yet).
  const { data: team, error } = await admin
    .from("teams")
    .insert({
      name: `${TAG} club`,
      short_name: "LOGO",
      manager_id: USER_ID,
      registration_type: "host",
      status: "pending",
      lado: "A",
      serie: "A",
      home_venue: `${TAG} venue`,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  teamId = team!.id;

  await admin.from("team_members").insert({
    team_id: teamId,
    user_id: USER_ID,
    role: "director",
    accepted_at: new Date().toISOString(),
  });
});

afterAll(async () => {
  await cleanup();
});

describe("/inscricao logo upload → /minha-conta after approval", () => {
  test("uploading to team-logos returns a resolvable public URL", async () => {
    uploadedPath = `logos/${teamId}/${Date.now()}.png`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(uploadedPath, PNG_1x1, {
        upsert: true,
        contentType: "image/png",
      });
    expect(upErr).toBeNull();

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(uploadedPath);
    expect(pub.publicUrl).toContain(uploadedPath);

    const res = await fetch(pub.publicUrl);
    expect(res.status).toBe(200);
  });

  test("saving logo_url on a pending team persists it", async () => {
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(uploadedPath!);
    const { error } = await admin
      .from("teams")
      .update({ logo_url: pub.publicUrl })
      .eq("id", teamId!);
    expect(error).toBeNull();

    const { data } = await admin
      .from("teams")
      .select("logo_url, status")
      .eq("id", teamId!)
      .single();
    expect(data?.status).toBe("pending");
    expect(data?.logo_url).toBe(pub.publicUrl);
  });

  test("after admin approval, /minha-conta SELECT returns the same logo_url", async () => {
    const { error: apprErr } = await admin
      .from("teams")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", teamId!);
    expect(apprErr).toBeNull();

    // Exact SELECT used by /minha-conta.
    const { data: team } = await admin
      .from("teams")
      .select(
        "id,name,short_name,slug,logo_url,banner_url,primary_color,registration_type,status,rejected_reason,created_at",
      )
      .eq("id", teamId!)
      .single();

    expect(team?.status).toBe("approved");
    expect(team?.logo_url).toBeTruthy();

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(uploadedPath!);
    expect(team?.logo_url).toBe(pub.publicUrl);

    // And the URL is still reachable — the <img src> on /minha-conta resolves.
    const res = await fetch(team!.logo_url as string);
    expect(res.status).toBe(200);
  });
});
