import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adminDb = supabaseAdmin as any;

type CardKind = "yellow_card" | "red_card" | "direct_red";

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await adminDb.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

async function isDirectorOf(userId: string, teamId: string): Promise<boolean> {
  const { data: team } = await adminDb
    .from("teams").select("manager_id").eq("id", teamId).maybeSingle();
  if (team?.manager_id === userId) return true;
  const { data: m } = await adminDb
    .from("team_members").select("id")
    .eq("team_id", teamId).eq("user_id", userId).eq("role", "director")
    .not("accepted_at", "is", null).maybeSingle();
  return !!m;
}

/**
 * Core rule engine — called after a súmula is homologated.
 * Creates suspensions for red cards + accumulated yellows, then
 * decrements active suspensions for both teams that predate this match.
 */
export async function computeDisciplineForMatch(matchId: string): Promise<void> {
  const { data: match } = await adminDb.from("matches")
    .select("id, host_team_id, visitor_team_id, competition_id, scheduled_at")
    .eq("id", matchId).maybeSingle();
  if (!match) return;

  const compId: string | null = match.competition_id ?? null;
  let yellowsForSusp = 3;
  let redGames = 1;
  let directRedGames = 2;
  if (compId) {
    const { data: comp } = await adminDb.from("competitions")
      .select("yellows_for_suspension, red_suspension_games, direct_red_suspension_games")
      .eq("id", compId).maybeSingle();
    if (comp) {
      yellowsForSusp = comp.yellows_for_suspension ?? 3;
      redGames = comp.red_suspension_games ?? 1;
      directRedGames = comp.direct_red_suspension_games ?? 2;
    }
  }

  // 1) Cartões deste jogo
  const { data: events } = await adminDb.from("match_events")
    .select("athlete_id, team_id, kind")
    .eq("match_id", matchId)
    .in("kind", ["yellow_card", "red_card", "direct_red"] as CardKind[]);

  // 2) Vermelho direto / expulsão -> cria suspensão
  for (const ev of (events ?? []) as Array<{athlete_id: string|null; team_id: string; kind: CardKind}>) {
    if (!ev.athlete_id) continue;
    if (ev.kind === "red_card" || ev.kind === "direct_red") {
      const games = ev.kind === "direct_red" ? directRedGames : redGames;
      // evita duplicar suspensão para o mesmo jogo/origem
      const { data: existing } = await adminDb.from("disciplinary_suspensions")
        .select("id").eq("origin_match_id", matchId).eq("athlete_id", ev.athlete_id)
        .in("reason", [ev.kind]).maybeSingle();
      if (!existing) {
        await adminDb.from("disciplinary_suspensions").insert({
          athlete_id: ev.athlete_id, team_id: ev.team_id,
          competition_id: compId, origin_match_id: matchId,
          reason: ev.kind, games_total: games, games_remaining: games,
        });
      }
    }
  }

  // 3) Amarelos acumulados por atleta (no escopo da competição)
  const yellowByAthlete = new Map<string, {team_id: string}>();
  for (const ev of (events ?? []) as Array<{athlete_id: string|null; team_id: string; kind: CardKind}>) {
    if (ev.kind === "yellow_card" && ev.athlete_id) {
      yellowByAthlete.set(ev.athlete_id, { team_id: ev.team_id });
    }
  }
  for (const [athleteId, info] of yellowByAthlete) {
    // conta total de amarelos em jogos confirmados/fechados nessa competição
    let q = adminDb.from("match_events")
      .select("id, matches!inner(status, competition_id)", { count: "exact", head: true })
      .eq("athlete_id", athleteId).eq("kind", "yellow_card")
      .in("matches.status", ["confirmed", "closed"]);
    if (compId) q = q.eq("matches.competition_id", compId);
    const { count } = await q;
    const totalYellows = count ?? 0;
    // suspensões por acúmulo já existentes p/ esse atleta nessa competição
    let sQ = adminDb.from("disciplinary_suspensions")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId).eq("reason", "accum_yellow");
    if (compId) sQ = sQ.eq("competition_id", compId);
    const { count: alreadyIssued } = await sQ;
    const shouldHave = Math.floor(totalYellows / yellowsForSusp);
    const toIssue = shouldHave - (alreadyIssued ?? 0);
    for (let i = 0; i < toIssue; i++) {
      await adminDb.from("disciplinary_suspensions").insert({
        athlete_id: athleteId, team_id: info.team_id,
        competition_id: compId, origin_match_id: matchId,
        reason: "accum_yellow", games_total: 1, games_remaining: 1,
      });
    }
  }

  // 4) Cumprimento: decrementa suspensões ativas que existiam ANTES deste jogo,
  //    para os dois times envolvidos.
  const teamIds = [match.host_team_id, match.visitor_team_id];
  for (const teamId of teamIds) {
    const { data: actives } = await adminDb.from("disciplinary_suspensions")
      .select("id, games_remaining, created_at, origin_match_id")
      .eq("team_id", teamId).eq("active", true);
    for (const s of (actives ?? []) as Array<{id: string; games_remaining: number; created_at: string; origin_match_id: string | null}>) {
      // não decrementa a suspensão criada por este próprio jogo
      if (s.origin_match_id === matchId) continue;
      if (match.scheduled_at && new Date(s.created_at) > new Date(match.scheduled_at)) continue;
      const next = Math.max(0, (s.games_remaining ?? 1) - 1);
      await adminDb.from("disciplinary_suspensions")
        .update({ games_remaining: next, active: next > 0 })
        .eq("id", s.id);
    }
  }
}

// ============================================================
// Server functions (callable)
// ============================================================
export const recomputeMatchDiscipline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Apenas administradores");
    await computeDisciplineForMatch(data.match_id);
    return { ok: true };
  });

export const listTeamSuspensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ team_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId)) && !(await isDirectorOf(context.userId, data.team_id))) {
      throw new Error("Sem permissão");
    }
    const { data: rows } = await adminDb.rpc("get_team_suspensions", { _team_id: data.team_id });
    return { rows: rows ?? [] };
  });

export const listMyTeamSuspensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: team } = await adminDb.from("teams")
      .select("id, name").eq("manager_id", context.userId).maybeSingle();
    if (!team) return { team: null, rows: [] };
    const { data: rows } = await adminDb.rpc("get_team_suspensions", { _team_id: team.id });
    return { team, rows: rows ?? [] };
  });

export const getAthleteDiscipline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    athlete_id: z.string().uuid(),
    competition_id: z.string().uuid().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows } = await adminDb.rpc("get_athlete_discipline", {
      _athlete_id: data.athlete_id,
      _competition_id: data.competition_id ?? null,
    });
    return rows?.[0] ?? {
      yellows: 0, reds: 0, direct_reds: 0,
      active_suspension_games: 0, has_active_suspension: false,
    };
  });

// Admin listing: all active suspensions across the league
export const adminListActiveSuspensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Apenas administradores");
    const { data } = await adminDb.from("disciplinary_suspensions")
      .select(`
        id, athlete_id, team_id, competition_id, origin_match_id,
        reason, games_total, games_remaining, active, created_at,
        athletes:athlete_id(full_name, nickname, position),
        teams:team_id(name, short_name),
        competitions:competition_id(name)
      `)
      .eq("active", true)
      .order("created_at", { ascending: false });
    return { rows: data ?? [] };
  });

// Admin: registrar cartão manualmente (quando algo não veio da súmula)
export const adminAddCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    match_id: z.string().uuid(),
    team_id: z.string().uuid(),
    athlete_id: z.string().uuid(),
    kind: z.enum(["yellow_card", "red_card", "direct_red"]),
    minute: z.number().int().min(0).max(200).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Apenas administradores");
    const { error } = await adminDb.from("match_events").insert({
      match_id: data.match_id, team_id: data.team_id,
      athlete_id: data.athlete_id, kind: data.kind,
      minute: data.minute ?? null,
    });
    if (error) throw new Error(error.message);
    await computeDisciplineForMatch(data.match_id);
    return { ok: true };
  });

// Admin: anular / encerrar uma suspensão
export const adminSetSuspensionActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    active: z.boolean(),
    games_remaining: z.number().int().min(0).max(20).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Apenas administradores");
    const patch: Record<string, unknown> = { active: data.active };
    if (data.games_remaining !== undefined) patch.games_remaining = data.games_remaining;
    if (!data.active) patch.games_remaining = 0;
    const { error } = await adminDb.from("disciplinary_suspensions")
      .update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
