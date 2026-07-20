import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const adminListMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select("id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, host_filled_at, visitor_confirmed_at")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id]).filter(Boolean)));
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, lado")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((teams ?? []).map((t: any) => [t.id, t]));
    return (matches ?? []).map((m: any) => ({
      ...m,
      host: map.get(m.host_team_id) ?? null,
      visitor: map.get(m.visitor_team_id) ?? null,
    }));
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().datetime().optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  host_score: z.number().int().min(0).max(50).optional().nullable(),
  visitor_score: z.number().int().min(0).max(50).optional().nullable(),
  status: z.enum(["scheduled", "awaiting_confirmation", "confirmed", "closed", "disputed", "wo", "cancelled"]).optional(),
});

export const adminUpdateMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.scheduled_at !== undefined) patch.scheduled_at = data.scheduled_at;
    if (data.venue !== undefined) patch.venue = data.venue;
    if (data.host_score !== undefined) patch.host_score = data.host_score;
    if (data.visitor_score !== undefined) patch.visitor_score = data.visitor_score;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await supabaseAdmin.from("matches").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminAnnulMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("matches").update({
      status: "scheduled",
      host_score: null,
      visitor_score: null,
      host_filled_at: null,
      visitor_confirmed_at: null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
