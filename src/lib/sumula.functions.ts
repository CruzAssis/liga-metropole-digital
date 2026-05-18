import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Match status lifecycle:
//   scheduled -> awaiting_confirmation -> confirmed
//                                      -> disputed
//   scheduled / awaiting_confirmation -> wo (admin)
//   scheduled                         -> live (optional, not used here)

// =============================================================
// List matches involving the manager's team (for /minha-conta)
// =============================================================
export const listMyTeamMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, name")
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) return { team: null, matches: [] };

    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, host_filled_at, visitor_confirmed_at",
      )
      .or(`host_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id])),
    );
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, slug, logo_url, manager_id")
      .in("id", ids);
    const map: Record<string, { name: string; short_name: string; slug: string | null; logo_url: string | null; manager_id: string }> = {};
    for (const t of teams ?? []) map[t.id] = t;

    // Fetch manager profiles (phone) for adversaries
    const managerIds = Array.from(new Set(Object.values(map).map((t) => t.manager_id).filter(Boolean)));
    const { data: profiles } = managerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", managerIds)
      : { data: [] as { id: string; full_name: string; phone: string | null }[] };
    const profileMap: Record<string, { full_name: string; phone: string | null }> = {};
    for (const p of profiles ?? []) profileMap[p.id] = { full_name: p.full_name, phone: p.phone };

    const hydrate = (teamId: string) => {
      const t = map[teamId];
      if (!t) return null;
      const p = profileMap[t.manager_id];
      return {
        name: t.name,
        short_name: t.short_name,
        slug: t.slug,
        logo_url: t.logo_url,
        manager_name: p?.full_name ?? null,
        manager_phone: p?.phone ?? null,
      };
    };

    return {
      team,
      matches: (matches ?? []).map((m) => ({
        ...m,
        host: hydrate(m.host_team_id),
        visitor: hydrate(m.visitor_team_id),
        is_host: m.host_team_id === team.id,
      })),
    };
  });

// =============================================================
// Sumula context (rosters + current events) for the fill form
// =============================================================
export const getSumulaContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, host_team_id, visitor_team_id, host_score, visitor_score, status")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });

    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, manager_id")
      .in("id", [match.host_team_id, match.visitor_team_id]);
    const host = teams?.find((t) => t.id === match.host_team_id);
    const visitor = teams?.find((t) => t.id === match.visitor_team_id);
    const isHostManager = host?.manager_id === userId;
    const isVisitorManager = visitor?.manager_id === userId;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (!isHostManager && !isVisitorManager && !isAdmin) {
      throw new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403 });
    }

    const { data: athletes } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, nickname, team_id")
      .in("team_id", [match.host_team_id, match.visitor_team_id])
      .order("full_name");

    const { data: events } = await supabaseAdmin
      .from("match_events")
      .select("id, team_id, athlete_id, kind, minute")
      .eq("match_id", data.matchId)
      .order("minute", { ascending: true, nullsFirst: false });

    const { data: bestVotes } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("id, voter_team_id, opponent_team_id, jersey_number, rating, note, opponent_athlete_id, identified_name, identified_at")
      .eq("match_id", data.matchId);

    return {
      match,
      host: host ? { id: host.id, name: host.name, short_name: host.short_name } : null,
      visitor: visitor ? { id: visitor.id, name: visitor.name, short_name: visitor.short_name } : null,
      isHostManager,
      isVisitorManager,
      hostAthletes: (athletes ?? []).filter((a) => a.team_id === match.host_team_id),
      visitorAthletes: (athletes ?? []).filter((a) => a.team_id === match.visitor_team_id),
      events: events ?? [],
      bestVotes: bestVotes ?? [],
    };
  });

// =============================================================
// Fill score + events (mandante)
// =============================================================
const eventSchema = z.object({
  team_id: z.string().uuid(),
  athlete_id: z.string().uuid(),
  kind: z.enum(["goal", "yellow_card", "red_card"]),
  minute: z.number().int().min(0).max(200).nullable().optional(),
});

const bestOpponentSchema = z.object({
  jersey_number: z.number().int().min(0).max(999),
  rating: z.number().min(0).max(10),
  note: z.string().max(280).optional().nullable(),
});

const fillSchema = z.object({
  matchId: z.string().uuid(),
  hostScore: z.number().int().min(0).max(50),
  visitorScore: z.number().int().min(0).max(50),
  events: z.array(eventSchema).max(200).optional(),
  bestOpponent: bestOpponentSchema.optional().nullable(),
});

export const fillSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => fillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("id, status, host_team_id, visitor_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (!["scheduled", "awaiting_confirmation"].includes(match.status)) {
      throw new Response(JSON.stringify({ error: "Jogo já encerrado" }), { status: 400 });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.host_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(
        JSON.stringify({ error: "Apenas o mandante pode preencher a súmula" }),
        { status: 403 },
      );
    }

    const events = data.events ?? [];
    const validTeamIds = new Set([match.host_team_id, match.visitor_team_id]);
    for (const ev of events) {
      if (!validTeamIds.has(ev.team_id)) {
        throw new Response(JSON.stringify({ error: "Evento de time inválido" }), { status: 400 });
      }
    }
    const hostGoals = events.filter((e) => e.kind === "goal" && e.team_id === match.host_team_id).length;
    const visitorGoals = events.filter((e) => e.kind === "goal" && e.team_id === match.visitor_team_id).length;
    if (events.length > 0 && (hostGoals !== data.hostScore || visitorGoals !== data.visitorScore)) {
      throw new Response(
        JSON.stringify({
          error: `Gols informados (${hostGoals}×${visitorGoals}) não batem com o placar (${data.hostScore}×${data.visitorScore})`,
        }),
        { status: 400 },
      );
    }

    // Confirma que cada atleta pertence ao time do evento
    const athleteIds = Array.from(new Set(events.map((e) => e.athlete_id)));
    if (athleteIds.length > 0) {
      const { data: athletes } = await supabaseAdmin
        .from("athletes")
        .select("id, team_id")
        .in("id", athleteIds);
      const athleteTeam = new Map((athletes ?? []).map((a) => [a.id, a.team_id]));
      for (const ev of events) {
        if (athleteTeam.get(ev.athlete_id) !== ev.team_id) {
          throw new Response(JSON.stringify({ error: "Atleta não pertence ao time do evento" }), { status: 400 });
        }
      }
    }

    // Reescreve eventos do jogo
    const { error: delErr } = await supabaseAdmin
      .from("match_events")
      .delete()
      .eq("match_id", data.matchId);
    if (delErr) throw new Error(delErr.message);

    if (events.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("match_events").insert(
        events.map((e) => ({
          match_id: data.matchId,
          team_id: e.team_id,
          athlete_id: e.athlete_id,
          kind: e.kind,
          minute: e.minute ?? null,
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: data.hostScore,
        visitor_score: data.visitorScore,
        status: "awaiting_confirmation",
        host_filled_at: new Date().toISOString(),
        visitor_confirmed_at: null,
      })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    // Voto de melhor jogador adversário (mandante vota no time visitante)
    if (data.bestOpponent) {
      const { error: voteErr } = await supabaseAdmin
        .from("match_best_opponent_votes")
        .upsert(
          {
            match_id: data.matchId,
            voter_team_id: match.host_team_id,
            opponent_team_id: match.visitor_team_id,
            jersey_number: data.bestOpponent.jersey_number,
            rating: data.bestOpponent.rating,
            note: data.bestOpponent.note ?? null,
          },
          { onConflict: "match_id,voter_team_id" },
        );
      if (voteErr) throw new Error(voteErr.message);
    }

    return { success: true };
  });


// =============================================================
// Confirm (visitante)
// =============================================================
const idSchema = z.object({ matchId: z.string().uuid() });

const confirmSchema = z.object({
  matchId: z.string().uuid(),
  bestOpponent: bestOpponentSchema.optional().nullable(),
});

export const confirmSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, host_team_id, visitor_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.status !== "awaiting_confirmation") {
      throw new Response(JSON.stringify({ error: "Súmula não está aguardando confirmação" }), {
        status: 400,
      });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.visitor_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(JSON.stringify({ error: "Apenas o visitante pode confirmar" }), {
        status: 403,
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({ status: "confirmed", visitor_confirmed_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    // Voto do visitante: melhor jogador do mandante
    if (data.bestOpponent) {
      const { error: voteErr } = await supabaseAdmin
        .from("match_best_opponent_votes")
        .upsert(
          {
            match_id: data.matchId,
            voter_team_id: match.visitor_team_id,
            opponent_team_id: match.host_team_id,
            jersey_number: data.bestOpponent.jersey_number,
            rating: data.bestOpponent.rating,
            note: data.bestOpponent.note ?? null,
          },
          { onConflict: "match_id,voter_team_id" },
        );
      if (voteErr) throw new Error(voteErr.message);
    }

    return { success: true };
  });

// =============================================================
// Identificar jogador escolhido pelo adversário
// =============================================================
const identifySchema = z.object({
  voteId: z.string().uuid(),
  athleteId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120).nullable().optional(),
});

export const identifyBestOpponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => identifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: vote } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("id, opponent_team_id")
      .eq("id", data.voteId)
      .maybeSingle();
    if (!vote) throw new Response("Voto não encontrado", { status: 404 });

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", vote.opponent_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(
        JSON.stringify({ error: "Apenas o diretor do time indicado pode identificar o jogador" }),
        { status: 403 },
      );
    }

    let name = data.name ?? null;
    if (data.athleteId) {
      const { data: ath } = await supabaseAdmin
        .from("athletes")
        .select("id, full_name, nickname, team_id")
        .eq("id", data.athleteId)
        .maybeSingle();
      if (!ath || ath.team_id !== vote.opponent_team_id) {
        throw new Response(JSON.stringify({ error: "Atleta não pertence ao seu time" }), { status: 400 });
      }
      name = name || ath.nickname || ath.full_name || null;
    }

    const { error } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .update({
        opponent_athlete_id: data.athleteId ?? null,
        identified_name: name,
        identified_at: new Date().toISOString(),
      })
      .eq("id", data.voteId);
    if (error) throw new Error(error.message);

    return { success: true };
  });

// =============================================================
// Dispute (visitante)
// =============================================================
export const disputeSumula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, visitor_team_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.status !== "awaiting_confirmation") {
      throw new Response(JSON.stringify({ error: "Súmula não pode ser contestada agora" }), {
        status: 400,
      });
    }

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", match.visitor_team_id)
      .eq("manager_id", userId)
      .maybeSingle();
    if (!team) {
      throw new Response(JSON.stringify({ error: "Apenas o visitante pode contestar" }), {
        status: 403,
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from("matches")
      .update({ status: "disputed" })
      .eq("id", data.matchId);
    if (updErr) throw new Error(updErr.message);

    return { success: true };
  });

// =============================================================
// Admin: list matches needing attention
// =============================================================
async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response(JSON.stringify({ error: "Apenas admin" }), { status: 403 });
}

export const adminListSumulasPending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);

    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, host_filled_at, visitor_confirmed_at",
      )
      .in("status", ["awaiting_confirmation", "disputed", "scheduled"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((matches ?? []).flatMap((m) => [m.host_team_id, m.visitor_team_id])),
    );
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name")
      .in("id", ids);
    const map: Record<string, { name: string; short_name: string }> = {};
    for (const t of teams ?? []) map[t.id] = t;

    return {
      matches: (matches ?? []).map((m) => ({
        ...m,
        host: map[m.host_team_id] ?? null,
        visitor: map[m.visitor_team_id] ?? null,
      })),
    };
  });

// =============================================================
// Admin: apply WO (3x0 to winner)
// =============================================================
const woSchema = z.object({
  matchId: z.string().uuid(),
  winner: z.enum(["host", "visitor"]),
});

export const adminApplyWO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => woSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const hostScore = data.winner === "host" ? 3 : 0;
    const visitorScore = data.winner === "visitor" ? 3 : 0;

    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        host_score: hostScore,
        visitor_score: visitorScore,
        status: "wo",
      })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);

    return { success: true };
  });

// =============================================================
// Admin: force confirm (resolve dispute / auto-confirm expired)
// =============================================================
export const adminForceConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const { data: match } = await supabaseAdmin
      .from("matches")
      .select("id, status, host_score, visitor_score")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Response("Jogo não encontrado", { status: 404 });
    if (match.host_score == null || match.visitor_score == null) {
      throw new Response(JSON.stringify({ error: "Placar não foi preenchido" }), { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("matches")
      .update({ status: "confirmed", visitor_confirmed_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
