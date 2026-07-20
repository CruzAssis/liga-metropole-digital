import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adminDb = supabaseAdmin as any;

async function loadMatchOr404(matchId: string) {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("id, host_team_id, visitor_team_id, status, scheduled_at, host_filled_at, visitor_confirmed_at")
    .eq("id", matchId)
    .single();
  if (error || !data) throw new Error("Partida nao encontrada");
  return data;
}

async function assertIsDirector(userId: string, teamId: string) {
  const { data: team } = await supabaseAdmin
    .from("teams").select("manager_id").eq("id", teamId).maybeSingle();
  if (team?.manager_id === userId) return;
  const { data: member } = await supabaseAdmin
    .from("team_members").select("id").eq("team_id", teamId)
    .eq("user_id", userId).eq("role", "director")
    .not("accepted_at", "is", null).maybeSingle();
  if (!member) throw new Error("Apenas o Diretor do time pode executar esta acao");
}

export function woExpired(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  return Date.now() > new Date(scheduledAt).getTime() + 72 * 3600 * 1000;
}

export function msUntilWO(scheduledAt: string | null): number {
  if (!scheduledAt) return 72 * 3600 * 1000;
  return new Date(scheduledAt).getTime() + 72 * 3600 * 1000 - Date.now();
}

export const submitSumulaScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      match_id: z.string().uuid(),
      host_score: z.number().int().min(0).max(50),
      visitor_score: z.number().int().min(0).max(50),
      questionamento_arbitragem: z.string().max(1000).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.visitor_team_id);
    if (match.status === "closed" || match.status === "wo") throw new Error("Sumula ja encerrada");
    if (woExpired(match.scheduled_at)) throw new Error("Prazo de 72h expirado");
    const update: Record<string, unknown> = {
      host_score: data.host_score, visitor_score: data.visitor_score,
      host_filled_at: new Date().toISOString(), status: "awaiting_confirmation",
    };
    if (data.questionamento_arbitragem !== undefined)
      update.questionamento_arbitragem = data.questionamento_arbitragem ?? null;
    const { error } = await adminDb.from("matches").update(update).eq("id", data.match_id);
    if (error) throw new Error(error.message);

    // Notifica diretor mandante que precisa validar a súmula
    try {
      const { enqueueWhatsapp, fetchTeamManagerContact, renderTemplate } = await import("@/lib/notify.server");
      const c = await fetchTeamManagerContact(match.host_team_id);
      if (c) {
        const { data: opp } = await supabaseAdmin
          .from("teams").select("name").eq("id", match.visitor_team_id).maybeSingle();
        const oppName = (opp as any)?.name ?? "adversário";
        const { assunto, mensagem } = await renderTemplate("sumula_disponivel", {
          diretor: c.name ?? "diretor(a)",
          time: c.team_name ?? "",
          adversario: oppName,
          placar_casa: data.host_score,
          placar_visitante: data.visitor_score,
        });
        await enqueueWhatsapp({
          tipo: "sumula_disponivel",
          destinatario_id: c.id,
          destinatario_nome: c.name,
          destinatario_phone: c.phone,
          assunto,
          mensagem,
          payload: { match_id: data.match_id, host_score: data.host_score, visitor_score: data.visitor_score },
          created_by: context.userId,
        });
      }
    } catch (err) {
      console.error("[notify:sumula_disponivel]", err);
    }

    return { ok: true };
  });

export const confirmSumulaScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.host_team_id);
    if (woExpired(match.scheduled_at)) throw new Error("Prazo de 72h expirado");
    const { error } = await supabaseAdmin.from("matches")
      .update({ visitor_confirmed_at: new Date().toISOString(), status: "confirmed" })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disputeSumulaScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      match_id: z.string().uuid(),
      reason: z.string().trim().min(10, "Descreva a contestação com pelo menos 10 caracteres").max(2000),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.host_team_id);
    if (match.status === "closed" || match.status === "wo") {
      throw new Error("Súmula já encerrada — não pode ser contestada");
    }
    const { error } = await adminDb.from("matches").update({
      status: "disputed",
      dispute_reason: data.reason,
      disputed_at: new Date().toISOString(),
      disputed_by: context.userId,
    }).eq("id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSumulaGoalsAndDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      match_id: z.string().uuid(), team_id: z.string().uuid(),
      goals: z.array(z.object({
        athlete_id: z.string().uuid().nullable(),
        minute: z.number().int().min(0).max(200).nullable(),
      })).max(50),
      destaque_jersey: z.number().int().min(1).max(99),
      destaque_name: z.string().max(120).nullable().optional(),
      destaque_athlete_id: z.string().uuid().nullable().optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    if (data.team_id !== match.host_team_id && data.team_id !== match.visitor_team_id)
      throw new Error("Time nao pertence a esta partida");
    await assertIsDirector(context.userId, data.team_id);
    if (woExpired(match.scheduled_at)) throw new Error("Prazo de 72h expirado");
    await supabaseAdmin.from("match_events").delete()
      .eq("match_id", data.match_id).eq("team_id", data.team_id).eq("kind", "goal");
    if (data.goals.length > 0) {
      const { error } = await supabaseAdmin.from("match_events").insert(
        data.goals.map((g) => ({
          match_id: data.match_id, team_id: data.team_id,
          athlete_id: g.athlete_id, kind: "goal", minute: g.minute,
        })));
      if (error) throw new Error(error.message);
    }
    const destaquePayload = {
      match_id: data.match_id, team_id: data.team_id,
      athlete_id: data.destaque_athlete_id ?? null,
      jersey_number: data.destaque_jersey,
      identified_name: data.destaque_name?.trim() ?? null,
    };
    const { data: existingDest } = await adminDb
      .from("match_best_own_votes").select("id")
      .eq("match_id", data.match_id).eq("team_id", data.team_id).maybeSingle();
    if (existingDest) {
      await adminDb.from("match_best_own_votes").update(destaquePayload).eq("id", existingDest.id);
    } else {
      await adminDb.from("match_best_own_votes").insert(destaquePayload);
    }
    return { ok: true };
  });

export const rateSumulaOpponentBest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      match_id: z.string().uuid(), voter_team_id: z.string().uuid(),
      jersey_number: z.number().int().min(1).max(99),
      identified_name: z.string().max(120).nullable().optional(),
      rating: z.number().int().min(1).max(10),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    if (data.voter_team_id !== match.host_team_id && data.voter_team_id !== match.visitor_team_id)
      throw new Error("Time nao pertence a esta partida");
    await assertIsDirector(context.userId, data.voter_team_id);
    if (woExpired(match.scheduled_at)) throw new Error("Prazo de 72h expirado");
    const opponent_team_id = data.voter_team_id === match.host_team_id
      ? match.visitor_team_id : match.host_team_id;
    const payload = {
      match_id: data.match_id, voter_team_id: data.voter_team_id, opponent_team_id,
      jersey_number: data.jersey_number,
      identified_name: data.identified_name?.trim() ?? null,
      rating: data.rating,
    };
    const { data: existing } = await supabaseAdmin
      .from("match_best_opponent_votes").select("id")
      .eq("match_id", data.match_id).eq("voter_team_id", data.voter_team_id).maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("match_best_opponent_votes")
        .update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("match_best_opponent_votes").insert(payload);
      if (error) throw new Error(error.message);
    }
    const { data: allVotes } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("voter_team_id, jersey_number, identified_name, rating, opponent_team_id")
      .eq("match_id", data.match_id);
    const voters = new Set((allVotes ?? []).map((v) => v.voter_team_id));
    const bothVoted = voters.has(match.host_team_id) && voters.has(match.visitor_team_id);
    if (bothVoted) {
      for (const v of (allVotes ?? [])) {
        const d = {
          match_id: data.match_id, team_id: v.opponent_team_id,
          jersey_number: v.jersey_number, identified_name: v.identified_name,
          rating: v.rating, published_at: new Date().toISOString(),
        };
        const { data: existingD } = await adminDb
          .from("match_destaques_publicados").select("id")
          .eq("match_id", data.match_id).eq("team_id", v.opponent_team_id).maybeSingle();
        if (existingD) {
          await adminDb.from("match_destaques_publicados").update(d).eq("id", existingD.id);
        } else {
          await adminDb.from("match_destaques_publicados").insert(d);
        }
      }
      await supabaseAdmin.from("matches").update({ status: "closed" }).eq("id", data.match_id);

      // Notifica diretores dos destaques publicados
      try {
        const { enqueueWhatsapp, fetchTeamManagerContact } = await import("@/lib/notify.server");
        for (const v of (allVotes ?? [])) {
          const c = await fetchTeamManagerContact(v.opponent_team_id);
          if (!c) continue;
          const name = v.identified_name || `Camisa #${v.jersey_number}`;
          await enqueueWhatsapp({
            tipo: "destaque_publicado",
            destinatario_id: c.id,
            destinatario_nome: c.name,
            destinatario_phone: c.phone,
            assunto: "Destaque publicado",
            mensagem: `⭐ *Destaque da partida!* — ${c.team_name}\n\n*${name}* foi eleito destaque pelo adversário com nota *${v.rating}/10*.\n\nParabéns! Confira no app.`,
            payload: { match_id: data.match_id, athlete: name, rating: v.rating },
            created_by: context.userId,
          });
        }
      } catch (err) {
        console.error("[notify:destaque_publicado]", err);
      }
    }
    return { ok: true, bothVoted };
  });

export const applyAutoWO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const match = await loadMatchOr404(data.match_id);
    if (!woExpired(match.scheduled_at)) return { applied: false };
    if (match.status === "closed" || match.status === "wo") return { applied: false };
    await supabaseAdmin.from("matches").update({ status: "wo" }).eq("id", data.match_id);
    return { applied: true };
  });
