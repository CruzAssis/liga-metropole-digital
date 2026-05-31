import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// =============================================================
// Rankings públicos de atletas:
// - Artilharia (gols em match_events com partida confirmada)
// - Disciplina (cartões amarelos / vermelhos em partidas confirmadas)
// - Nota Metrópole (média das notas recebidas em
//   match_best_opponent_votes, considerando apenas votos identificados)
// =============================================================
export const getAthleteRankings = createServerFn({ method: "GET" }).handler(async () => {
  // Partidas confirmadas (ou WO) — base para contabilizar eventos
  const { data: confirmedMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .in("status", ["confirmed", "wo"])
    .limit(2000);
  const confirmedIds = new Set((confirmedMatches ?? []).map((m) => m.id));

  // Todos os eventos
  const { data: events } = await supabaseAdmin
    .from("match_events")
    .select("match_id, athlete_id, kind")
    .limit(20000);

  const goalsBy = new Map<string, number>();
  const yellowBy = new Map<string, number>();
  const redBy = new Map<string, number>();
  const gamesBy = new Map<string, Set<string>>();
  for (const ev of events ?? []) {
    if (!confirmedIds.has(ev.match_id)) continue;
    if (!ev.athlete_id) continue;
    const aid = ev.athlete_id;
    if (ev.kind === "goal") goalsBy.set(aid, (goalsBy.get(aid) ?? 0) + 1);
    if (ev.kind === "yellow_card") yellowBy.set(aid, (yellowBy.get(aid) ?? 0) + 1);
    if (ev.kind === "red_card") redBy.set(aid, (redBy.get(aid) ?? 0) + 1);
    if (!gamesBy.has(aid)) gamesBy.set(aid, new Set());
    gamesBy.get(aid)!.add(ev.match_id);
  }

  // Votos de melhor jogador adversário identificados
  const { data: votes } = await supabaseAdmin
    .from("match_best_opponent_votes")
    .select("match_id, opponent_athlete_id, rating")
    .not("opponent_athlete_id", "is", null)
    .limit(10000);

  const ratingsBy = new Map<string, { sum: number; count: number }>();
  for (const v of votes ?? []) {
    if (!v.opponent_athlete_id) continue;
    if (v.match_id && !confirmedIds.has(v.match_id)) continue;
    const cur = ratingsBy.get(v.opponent_athlete_id) ?? { sum: 0, count: 0 };
    cur.sum += Number(v.rating);
    cur.count += 1;
    ratingsBy.set(v.opponent_athlete_id, cur);
  }

  // Carrega atletas envolvidos
  const ids = new Set<string>([
    ...goalsBy.keys(),
    ...yellowBy.keys(),
    ...redBy.keys(),
    ...ratingsBy.keys(),
  ]);
  if (ids.size === 0) {
    return { topScorers: [], discipline: [], topRated: [] };
  }
  const { data: athletes } = await supabaseAdmin
    .from("athletes")
    .select("id, full_name, nickname, photo_url, team_id")
    .in("id", Array.from(ids));

  const teamIds = Array.from(
    new Set((athletes ?? []).map((a) => a.team_id).filter(Boolean)),
  ) as string[];
  const { data: teams } = teamIds.length
    ? await supabaseAdmin.from("teams").select("id, name, short_name, slug, logo_url").in("id", teamIds)
    : { data: [] as { id: string; name: string; short_name: string; slug: string | null; logo_url: string | null }[] };
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

  const hydrate = (athleteId: string) => {
    const a = (athletes ?? []).find((x) => x.id === athleteId);
    if (!a) return null;
    const t = a.team_id ? teamMap.get(a.team_id) ?? null : null;
    return {
      id: a.id,
      name: a.nickname?.trim() || a.full_name?.trim() || "(sem nome)",
      photo_url: a.photo_url,
      team_name: t?.short_name ?? null,
      team_slug: t?.slug ?? null,
      team_logo: t?.logo_url ?? null,
    };
  };

  const topScorers = Array.from(goalsBy.entries())
    .map(([id, goals]) => ({
      athlete: hydrate(id),
      goals,
      games: gamesBy.get(id)?.size ?? 0,
    }))
    .filter((r) => r.athlete)
    .sort((a, b) => b.goals - a.goals || (a.games - b.games))
    .slice(0, 50);

  const discipline = Array.from(
    new Set([...yellowBy.keys(), ...redBy.keys()]),
  )
    .map((id) => ({
      athlete: hydrate(id),
      yellow: yellowBy.get(id) ?? 0,
      red: redBy.get(id) ?? 0,
      games: gamesBy.get(id)?.size ?? 0,
    }))
    .filter((r) => r.athlete)
    .sort((a, b) => b.red - a.red || b.yellow - a.yellow)
    .slice(0, 50);

  const topRated = Array.from(ratingsBy.entries())
    .map(([id, { sum, count }]) => ({
      athlete: hydrate(id),
      avg: count > 0 ? sum / count : 0,
      votes: count,
    }))
    .filter((r) => r.athlete && r.votes > 0)
    .sort((a, b) => b.avg - a.avg || b.votes - a.votes)
    .slice(0, 50);

  return { topScorers, discipline, topRated };
});
