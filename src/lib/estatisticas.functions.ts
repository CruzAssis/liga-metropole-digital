import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const FINISHED = ["confirmed", "closed", "wo"];

type MatchRow = {
  id: string;
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
  status: string;
  scheduled_at: string | null;
  competition_id: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  lado: "A" | "B" | null;
  registration_type: "host" | "visitor" | null;
};

async function loadCompetition(competition_id: string | null) {
  const matchesQ = supabaseAdmin
    .from("matches")
    .select("id, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, competition_id")
    .in("status", FINISHED)
    .order("scheduled_at", { ascending: true })
    .limit(5000);
  const teamsQ = supabaseAdmin
    .from("teams")
    .select("id, name, short_name, slug, logo_url, primary_color, lado, registration_type, competition_id")
    .eq("status", "approved");

  if (competition_id) {
    matchesQ.eq("competition_id", competition_id);
    teamsQ.eq("competition_id", competition_id);
  }

  const [{ data: matches }, { data: teams }] = await Promise.all([matchesQ, teamsQ]);
  return {
    matches: (matches ?? []) as MatchRow[],
    teams: (teams ?? []) as TeamRow[],
  };
}

// ============================================================
// Panorama: KPIs gerais da competição
// ============================================================
export const getLeagueKpis = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ competition_id: z.string().uuid().nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { matches, teams } = await loadCompetition(data.competition_id ?? null);

    let totalGoals = 0;
    let biggestDiff = 0;
    let biggestMatch: { host: string; visitor: string; hs: number; vs: number } | null = null;
    for (const m of matches) {
      const hs = m.host_score ?? 0;
      const vs = m.visitor_score ?? 0;
      totalGoals += hs + vs;
      const diff = Math.abs(hs - vs);
      if (diff > biggestDiff) {
        biggestDiff = diff;
        const h = teams.find((t) => t.id === m.host_team_id);
        const v = teams.find((t) => t.id === m.visitor_team_id);
        if (h && v) biggestMatch = { host: h.short_name, visitor: v.short_name, hs, vs };
      }
    }

    // Cartões totais
    const matchIds = matches.map((m) => m.id);
    let yellow = 0;
    let red = 0;
    if (matchIds.length) {
      const { data: events } = await supabaseAdmin
        .from("match_events")
        .select("kind")
        .in("match_id", matchIds)
        .in("kind", ["yellow_card", "red_card"])
        .limit(20000);
      for (const e of events ?? []) {
        if (e.kind === "yellow_card") yellow++;
        else if (e.kind === "red_card") red++;
      }
    }

    return {
      matches_played: matches.length,
      teams_count: teams.length,
      total_goals: totalGoals,
      avg_goals: matches.length ? Number((totalGoals / matches.length).toFixed(2)) : 0,
      yellow_cards: yellow,
      red_cards: red,
      biggest_match: biggestMatch,
    };
  });

// ============================================================
// Estatísticas avançadas por time: forma, aproveitamento, cartões, clean sheets
// ============================================================
type TeamAdvanced = {
  team: TeamRow;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  aproveitamento: number;
  clean_sheets: number;
  failed_to_score: number;
  yellow: number;
  red: number;
  form: ("V" | "E" | "D")[];
};

export const getAdvancedTeamStats = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ competition_id: z.string().uuid().nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { matches, teams } = await loadCompetition(data.competition_id ?? null);

    const stats = new Map<string, TeamAdvanced>();
    for (const t of teams) {
      stats.set(t.id, {
        team: t,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
        aproveitamento: 0,
        clean_sheets: 0,
        failed_to_score: 0,
        yellow: 0,
        red: 0,
        form: [],
      });
    }

    // ordena por data desc para "forma" recente
    const byDate = [...matches].sort((a, b) => {
      const ax = a.scheduled_at ? Date.parse(a.scheduled_at) : 0;
      const bx = b.scheduled_at ? Date.parse(b.scheduled_at) : 0;
      return ax - bx;
    });

    for (const m of byDate) {
      const hs = m.host_score ?? 0;
      const vs = m.visitor_score ?? 0;
      const h = stats.get(m.host_team_id);
      const v = stats.get(m.visitor_team_id);
      if (h) {
        h.played++;
        h.gf += hs;
        h.ga += vs;
        if (vs === 0) h.clean_sheets++;
        if (hs === 0) h.failed_to_score++;
        if (hs > vs) { h.wins++; h.points += 3; h.form.push("V"); }
        else if (hs < vs) { h.losses++; h.form.push("D"); }
        else { h.draws++; h.points++; h.form.push("E"); }
      }
      if (v) {
        v.played++;
        v.gf += vs;
        v.ga += hs;
        if (hs === 0) v.clean_sheets++;
        if (vs === 0) v.failed_to_score++;
        if (vs > hs) { v.wins++; v.points += 3; v.form.push("V"); }
        else if (vs < hs) { v.losses++; v.form.push("D"); }
        else { v.draws++; v.points++; v.form.push("E"); }
      }
    }

    // Cartões por time (partidas confirmadas)
    const matchIds = byDate.map((m) => m.id);
    if (matchIds.length) {
      const { data: events } = await supabaseAdmin
        .from("match_events")
        .select("team_id, kind")
        .in("match_id", matchIds)
        .in("kind", ["yellow_card", "red_card"])
        .limit(20000);
      for (const e of events ?? []) {
        if (!e.team_id) continue;
        const s = stats.get(e.team_id);
        if (!s) continue;
        if (e.kind === "yellow_card") s.yellow++;
        else if (e.kind === "red_card") s.red++;
      }
    }

    const rows = Array.from(stats.values()).map((s) => ({
      ...s,
      gd: s.gf - s.ga,
      aproveitamento: s.played > 0 ? Number(((s.points / (s.played * 3)) * 100).toFixed(1)) : 0,
      form: s.form.slice(-5),
    }));

    rows.sort((a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.name.localeCompare(b.team.name),
    );

    return rows;
  });

// ============================================================
// Head to Head: histórico entre dois times
// ============================================================
export const getHeadToHead = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({
      team_a: z.string().uuid(),
      team_b: z.string().uuid(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue, round")
      .in("status", FINISHED)
      .or(
        `and(host_team_id.eq.${data.team_a},visitor_team_id.eq.${data.team_b}),` +
        `and(host_team_id.eq.${data.team_b},visitor_team_id.eq.${data.team_a})`,
      )
      .order("scheduled_at", { ascending: false })
      .limit(50);

    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, slug, logo_url, primary_color")
      .in("id", [data.team_a, data.team_b]);

    const teamA = teams?.find((t) => t.id === data.team_a) ?? null;
    const teamB = teams?.find((t) => t.id === data.team_b) ?? null;

    let winsA = 0, winsB = 0, draws = 0, goalsA = 0, goalsB = 0;
    for (const m of matches ?? []) {
      const hs = m.host_score ?? 0;
      const vs = m.visitor_score ?? 0;
      const aIsHost = m.host_team_id === data.team_a;
      const gA = aIsHost ? hs : vs;
      const gB = aIsHost ? vs : hs;
      goalsA += gA;
      goalsB += gB;
      if (gA > gB) winsA++;
      else if (gA < gB) winsB++;
      else draws++;
    }

    return {
      team_a: teamA,
      team_b: teamB,
      matches: matches ?? [],
      summary: { winsA, winsB, draws, goalsA, goalsB, total: matches?.length ?? 0 },
    };
  });
