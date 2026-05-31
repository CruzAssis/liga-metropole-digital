import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Status canônicos (compat com RLS): scheduled | awaiting_confirmation | confirmed | closed

async function loadMatchOr404(matchId: string) {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("id, host_team_id, visitor_team_id, status")
    .eq("id", matchId)
    .single();
  if (error || !data) throw new Error("Partida não encontrada");
  return data;
}

async function assertIsDirector(userId: string, teamId: string) {
  // manager_id (legado) vale como diretor
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("manager_id")
    .eq("id", teamId)
    .maybeSingle();
  if (team?.manager_id === userId) return;

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("role", "director")
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!member) throw new Error("Apenas Diretor do time pode executar esta ação");
}

// 1) Visitante lança o placar
export const submitScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        match_id: z.string().uuid(),
        host_score: z.number().int().min(0).max(50),
        visitor_score: z.number().int().min(0).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.visitor_team_id);
    if (match.status === "closed" || match.status === "confirmed") {
      throw new Error("Súmula já encerrada");
    }
    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: data.host_score,
        visitor_score: data.visitor_score,
        host_filled_at: new Date().toISOString(),
        status: "awaiting_confirmation",
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 2) Mandante confirma o placar
export const confirmScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ match_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.host_team_id);
    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        visitor_confirmed_at: new Date().toISOString(),
        status: "confirmed",
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 2b) Mandante contesta — reseta para scheduled
export const disputeScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ match_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    await assertIsDirector(context.userId, match.host_team_id);
    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: null,
        visitor_score: null,
        host_filled_at: null,
        visitor_confirmed_at: null,
        status: "scheduled",
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 3) Registrar gols (substitui os do próprio time)
export const saveGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        match_id: z.string().uuid(),
        team_id: z.string().uuid(),
        goals: z
          .array(
            z.object({
              athlete_id: z.string().uuid().nullable(),
              minute: z.number().int().min(0).max(200).nullable(),
            }),
          )
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    if (data.team_id !== match.host_team_id && data.team_id !== match.visitor_team_id) {
      throw new Error("Time não pertence a esta partida");
    }
    await assertIsDirector(context.userId, data.team_id);

    await supabaseAdmin
      .from("match_events")
      .delete()
      .eq("match_id", data.match_id)
      .eq("team_id", data.team_id)
      .eq("kind", "goal");

    if (data.goals.length > 0) {
      const rows = data.goals.map((g) => ({
        match_id: data.match_id,
        team_id: data.team_id,
        athlete_id: g.athlete_id,
        kind: "goal",
        minute: g.minute,
      }));
      const { error } = await supabaseAdmin.from("match_events").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// 4) Avaliar destaque adversário — encerra súmula se ambos votaram
export const rateOpponentBest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        match_id: z.string().uuid(),
        voter_team_id: z.string().uuid(),
        jersey_number: z.number().int().min(1).max(99),
        identified_name: z.string().max(120).nullable().optional(),
        rating: z.number().min(0).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const match = await loadMatchOr404(data.match_id);
    if (
      data.voter_team_id !== match.host_team_id &&
      data.voter_team_id !== match.visitor_team_id
    ) {
      throw new Error("Time não pertence a esta partida");
    }
    await assertIsDirector(context.userId, data.voter_team_id);
    const opponent_team_id =
      data.voter_team_id === match.host_team_id
        ? match.visitor_team_id
        : match.host_team_id;

    const { data: existing } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("id")
      .eq("match_id", data.match_id)
      .eq("voter_team_id", data.voter_team_id)
      .maybeSingle();

    const payload = {
      match_id: data.match_id,
      voter_team_id: data.voter_team_id,
      opponent_team_id,
      jersey_number: data.jersey_number,
      identified_name: data.identified_name?.trim() || null,
      rating: data.rating,
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("match_best_opponent_votes")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("match_best_opponent_votes")
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    const { data: all } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("voter_team_id")
      .eq("match_id", data.match_id);
    const voters = new Set((all ?? []).map((v) => v.voter_team_id));
    if (voters.has(match.host_team_id) && voters.has(match.visitor_team_id)) {
      await supabaseAdmin
        .from("matches")
        .update({ status: "closed" })
        .eq("id", data.match_id);
    }
    return { ok: true };
  });
