import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

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

    const { data: prev } = await supabaseAdmin
      .from("matches")
      .select("id, scheduled_at, host_team_id, visitor_team_id, venue")
      .eq("id", data.id).maybeSingle();
    const prevScheduled = (prev as any)?.scheduled_at ?? null;

    const patch: any = {};
    if (data.scheduled_at !== undefined) patch.scheduled_at = data.scheduled_at;
    if (data.venue !== undefined) patch.venue = data.venue;
    if (data.host_score !== undefined) patch.host_score = data.host_score;
    if (data.visitor_score !== undefined) patch.visitor_score = data.visitor_score;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await supabaseAdmin.from("matches").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      claims: context.claims,
      action: "match.update",
      entity_type: "match",
      entity_id: data.id,
      metadata: patch,
    });

    // Notificar diretores se scheduled_at foi alterado
    if (patch.scheduled_at !== undefined && patch.scheduled_at !== prevScheduled && prev) {
      try {
        const { enqueueWhatsapp, fetchTeamManagerContact } = await import("@/lib/notify.server");
        const p = prev as any;
        const isReschedule = !!prevScheduled;
        const dt = patch.scheduled_at
          ? new Date(patch.scheduled_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            })
          : "data a definir";
        const venueTxt = patch.venue ?? p.venue ?? "";
        for (const teamId of [p.host_team_id, p.visitor_team_id].filter(Boolean)) {
          const c = await fetchTeamManagerContact(teamId as string);
          if (!c) continue;
          const opponentId = teamId === p.host_team_id ? p.visitor_team_id : p.host_team_id;
          const { data: opp } = await supabaseAdmin
            .from("teams").select("name").eq("id", opponentId).maybeSingle();
          const oppName = (opp as any)?.name ?? "adversário";
          const msg = `🏆 *Liga Metrópole* — ${isReschedule ? "Jogo remarcado" : "Novo jogo agendado"}\n\n${c.team_name} x ${oppName}\n📅 ${dt}${venueTxt ? `\n📍 ${venueTxt}` : ""}\n\nAcesse o app para detalhes.`;
          await enqueueWhatsapp({
            tipo: "jogo_agendado",
            destinatario_id: c.id,
            destinatario_nome: c.name,
            destinatario_phone: c.phone,
            assunto: `Jogo ${isReschedule ? "remarcado" : "agendado"}`,
            mensagem: msg,
            payload: { match_id: data.id, scheduled_at: patch.scheduled_at, is_reschedule: isReschedule },
            created_by: context.userId,
          });
        }
      } catch (err) {
        console.error("[notify:jogo_agendado]", err);
      }
    }

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
    await logAudit({
      claims: context.claims,
      action: "match.annul",
      entity_type: "match",
      entity_id: data.id,
    });
    return { success: true };
  });
