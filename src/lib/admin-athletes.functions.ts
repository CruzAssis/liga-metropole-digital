import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

// List all athletes across all teams (admin)
export const adminListAthletes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, nickname, position, photo_url, verified, whatsapp, team_id, created_at, teams(id, name, short_name, lado)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().trim().min(1).max(40),
  position: z.string().trim().min(1).max(30),
  whatsapp: z.string().trim().max(20).optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  verified: z.boolean().optional(),
});

export const adminUpdateAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {
      full_name: data.full_name,
      nickname: data.nickname,
      position: data.position,
      whatsapp: data.whatsapp || null,
    };
    if (data.team_id !== undefined) patch.team_id = data.team_id;
    if (data.verified !== undefined) patch.verified = data.verified;
    const { error } = await supabaseAdmin.from("athletes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "athlete.update",
      entity_type: "athlete",
      entity_id: data.id,
      metadata: { full_name: data.full_name, nickname: data.nickname, team_id: data.team_id ?? null },
    });
    return { success: true };
  });

export const adminDeleteAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("athletes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "athlete.delete",
      entity_type: "athlete",
      entity_id: data.id,
    });
    return { success: true };
  });
