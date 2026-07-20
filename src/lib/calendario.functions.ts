import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { logAudit } from "@/lib/audit.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

// Circle method for round-robin schedule. Returns array of rounds; each round is a list of pairings.
function roundRobinPairings(teamIds: string[]): Array<Array<[string, string]>> {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  const hasBye = ids.length % 2 === 1;
  if (hasBye) ids.push("__BYE__");
  const n = ids.length;
  const rounds: Array<Array<[string, string]>> = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      // alternate home/away by round parity for fairness
      pairs.push(i % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // rotate keeping first fixed
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

// ============================================================
// Round-robin generator (stage='group')
// ============================================================
export const generateRoundRobin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        competitionId: z.string().uuid(),
        doubleRound: z.boolean().optional(),
        replace: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: comp, error: compErr } = await supabaseAdmin
      .from("competitions")
      .select("double_round")
      .eq("id", data.competitionId)
      .maybeSingle();
    if (compErr) throw new Error(compErr.message);
    const doubleRound = data.doubleRound ?? (comp as any)?.double_round ?? false;

    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id, name, lado")
      .eq("competition_id", data.competitionId)
      .eq("status", "approved");
    if (teamsErr) throw new Error(teamsErr.message);
    if (!teams || teams.length < 2) throw new Error("Times aprovados insuficientes.");

    if (data.replace) {
      const { error: delErr } = await supabaseAdmin
        .from("matches")
        .delete()
        .eq("competition_id", data.competitionId)
        .eq("stage", "group");
      if (delErr) throw new Error(delErr.message);
    } else {
      const { count } = await supabaseAdmin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", data.competitionId)
        .eq("stage", "group");
      if ((count ?? 0) > 0) throw new Error("Já existem jogos da fase de grupos. Use 'Substituir' para regenerar.");
    }

    // Split by lado (A/B); if no lado, single group.
    const groups: Array<{ label: string; teams: string[] }> = [];
    const ladoA = teams.filter((t: any) => t.lado === "A").map((t: any) => t.id);
    const ladoB = teams.filter((t: any) => t.lado === "B").map((t: any) => t.id);
    const semLado = teams.filter((t: any) => !t.lado).map((t: any) => t.id);
    if (ladoA.length >= 2) groups.push({ label: "Lado A", teams: ladoA });
    if (ladoB.length >= 2) groups.push({ label: "Lado B", teams: ladoB });
    if (semLado.length >= 2 && groups.length === 0) groups.push({ label: "Único", teams: semLado });

    if (groups.length === 0) throw new Error("Nenhum grupo válido para gerar (mínimo 2 times por lado).");

    const rows: any[] = [];
    let totalRound = 0;
    for (const g of groups) {
      const turn1 = roundRobinPairings(g.teams);
      const turns = doubleRound
        ? [...turn1, ...turn1.map((r) => r.map(([a, b]) => [b, a] as [string, string]))]
        : turn1;
      turns.forEach((round, idx) => {
        totalRound = Math.max(totalRound, idx + 1);
        for (const [host, visitor] of round) {
          rows.push({
            competition_id: data.competitionId,
            stage: "group",
            round: idx + 1,
            group_label: g.label,
            host_team_id: host,
            visitor_team_id: visitor,
            status: "scheduled",
          });
        }
      });
    }

    if (rows.length === 0) throw new Error("Nenhuma partida gerada.");
    const { error: insErr } = await supabaseAdmin.from("matches").insert(rows);
    if (insErr) throw new Error(insErr.message);

    await logAudit({
      claims: context.claims,
      action: "calendario.generate_round_robin",
      entity_type: "competition",
      entity_id: data.competitionId,
      metadata: { matches: rows.length, groups: groups.length, doubleRound },
    });

    return { ok: true, matches: rows.length, groups: groups.length, rounds: totalRound };
  });


// ============================================================
// Standings computed from confirmed matches (for bracket seeding)
// ============================================================
export const getCompetitionStandings = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ competitionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, short_name, logo_url, lado")
      .eq("competition_id", data.competitionId)
      .eq("status", "approved");

    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("host_team_id, visitor_team_id, host_score, visitor_score, status, group_label")
      .eq("competition_id", data.competitionId)
      .eq("stage", "group")
      .in("status", ["confirmed", "closed", "wo"]);

    const stats = new Map<string, any>();
    for (const t of teams ?? []) {
      stats.set(t.id, { team: t, group_label: null as string | null, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 });
    }
    for (const m of matches ?? []) {
      const h = stats.get(m.host_team_id);
      const v = stats.get(m.visitor_team_id);
      if (!h || !v) continue;
      if (m.group_label && !h.group_label) h.group_label = m.group_label;
      if (m.group_label && !v.group_label) v.group_label = m.group_label;
      const hs = m.host_score ?? 0;
      const vs = m.visitor_score ?? 0;
      h.played++; v.played++;
      h.gf += hs; h.ga += vs;
      v.gf += vs; v.ga += hs;
      if (hs > vs) { h.wins++; h.points += 3; v.losses++; }
      else if (hs < vs) { v.wins++; v.points += 3; h.losses++; }
      else { h.draws++; v.draws++; h.points++; v.points++; }
    }
    for (const s of stats.values()) s.gd = s.gf - s.ga;
    return Array.from(stats.values()).sort(
      (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name),
    );
  });

// ============================================================
// Bracket generator (single-elim). Seeds top N by standings.
// ============================================================
const BRACKET_STAGES: Record<number, string[]> = {
  16: ["oitavas", "quartas", "semi", "final"],
  8: ["quartas", "semi", "final"],
  4: ["semi", "final"],
  2: ["final"],
};

// Standard seeding pairs for a bracket size (1v8, 4v5, 3v6, 2v7 for 8).
function seedPairs(n: number): Array<[number, number]> {
  const seeds = Array.from({ length: n }, (_, i) => i + 1);
  const pairs: Array<[number, number]> = [];
  // Standard bracket ordering
  function build(arr: number[]): number[] {
    if (arr.length === 2) return arr;
    const half = arr.length / 2;
    const top = arr.slice(0, half);
    const bot = arr.slice(half).reverse();
    const inter: number[] = [];
    for (let i = 0; i < half; i++) inter.push(top[i], bot[i]);
    return build(inter);
  }
  const ordered = build(seeds);
  for (let i = 0; i < ordered.length; i += 2) pairs.push([ordered[i], ordered[i + 1]]);
  return pairs;
}

export const generateBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        competitionId: z.string().uuid(),
        size: z.union([z.literal(4), z.literal(8), z.literal(16)]).default(8),
        replace: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.replace) {
      await supabaseAdmin
        .from("matches")
        .delete()
        .eq("competition_id", data.competitionId)
        .in("stage", ["oitavas", "quartas", "semi", "final"]);
    } else {
      const { count } = await supabaseAdmin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", data.competitionId)
        .in("stage", ["oitavas", "quartas", "semi", "final"]);
      if ((count ?? 0) > 0) throw new Error("Chaveamento já existe. Use 'Substituir' para regenerar.");
    }

    // Fetch standings inline (avoid RPC roundtrip)
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, name, lado")
      .eq("competition_id", data.competitionId)
      .eq("status", "approved");
    const { data: gm } = await supabaseAdmin
      .from("matches")
      .select("host_team_id, visitor_team_id, host_score, visitor_score, status")
      .eq("competition_id", data.competitionId)
      .eq("stage", "group")
      .in("status", ["confirmed", "closed", "wo"]);

    const stats = new Map<string, { id: string; name: string; points: number; gd: number; gf: number }>();
    for (const t of teams ?? []) stats.set(t.id, { id: t.id, name: t.name, points: 0, gd: 0, gf: 0 });
    for (const m of gm ?? []) {
      const h = stats.get(m.host_team_id); const v = stats.get(m.visitor_team_id);
      if (!h || !v) continue;
      const hs = m.host_score ?? 0, vs = m.visitor_score ?? 0;
      h.gf += hs; v.gf += vs; h.gd += hs - vs; v.gd += vs - hs;
      if (hs > vs) h.points += 3; else if (hs < vs) v.points += 3; else { h.points++; v.points++; }
    }
    const ordered = Array.from(stats.values()).sort(
      (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name),
    );

    if (ordered.length < data.size) throw new Error(`Necessário ${data.size} times classificados; encontrados ${ordered.length}.`);
    const qualified = ordered.slice(0, data.size);

    const stages = BRACKET_STAGES[data.size];
    const firstStage = stages[0];
    const pairs = seedPairs(data.size);

    // Insert stages from final back to first, tracking IDs so parent_match_id works.
    // Number of matches per stage: size/2, size/4, ..., 1.
    const stageMatchIds: Record<string, string[]> = {};
    // Insert from last (final) to first so we can point children to parents.
    let cursor: string[] = [];
    for (let sIdx = stages.length - 1; sIdx >= 0; sIdx--) {
      const stage = stages[sIdx];
      const count = data.size / Math.pow(2, sIdx + 1);
      const rows: any[] = [];
      for (let pos = 1; pos <= count; pos++) {
        rows.push({
          competition_id: data.competitionId,
          stage,
          bracket_position: pos,
          parent_match_id: cursor[Math.floor((pos - 1) / 2)] ?? null,
          status: "scheduled",
          host_team_id: null,
          visitor_team_id: null,
        });
      }
      // For first stage, populate teams via seeded pairs.
      if (sIdx === 0) {
        pairs.forEach(([sa, sb], idx) => {
          rows[idx].host_team_id = qualified[sa - 1].id;
          rows[idx].visitor_team_id = qualified[sb - 1].id;
        });
      }
      const { data: ins, error } = await supabaseAdmin
        .from("matches")
        .insert(rows)
        .select("id, bracket_position")
        .order("bracket_position");
      if (error) throw new Error(error.message);
      stageMatchIds[stage] = (ins ?? []).map((r: any) => r.id);
      cursor = stageMatchIds[stage];
    }

    await logAudit({
      claims: context.claims,
      action: "calendario.generate_bracket",
      entity_type: "competition",
      entity_id: data.competitionId,
      metadata: { size: data.size, stage: firstStage, qualified: qualified.map((q) => q.id) },
    });

    return { ok: true, size: data.size, stages };
  });

// ============================================================
// Public bracket viewer
// ============================================================
export const getCompetitionBracket = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ competitionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, stage, bracket_position, parent_match_id, host_team_id, visitor_team_id, host_score, visitor_score, status, scheduled_at, venue")
      .eq("competition_id", data.competitionId)
      .in("stage", ["oitavas", "quartas", "semi", "final"])
      .order("bracket_position");

    const teamIds = Array.from(
      new Set((matches ?? []).flatMap((m: any) => [m.host_team_id, m.visitor_team_id]).filter(Boolean)),
    ) as string[];
    const { data: teams } = teamIds.length
      ? await supabaseAdmin.from("teams").select("id, name, short_name, logo_url, primary_color, lado").in("id", teamIds)
      : { data: [] as any[] };
    const map = new Map((teams ?? []).map((t: any) => [t.id, t]));

    const stages = ["oitavas", "quartas", "semi", "final"];
    const grouped: Record<string, any[]> = {};
    for (const stage of stages) {
      grouped[stage] = (matches ?? [])
        .filter((m: any) => m.stage === stage)
        .map((m: any) => ({
          ...m,
          host: m.host_team_id ? map.get(m.host_team_id) ?? null : null,
          visitor: m.visitor_team_id ? map.get(m.visitor_team_id) ?? null : null,
        }));
    }
    return grouped;
  });

// List competitions for admin selector
export const adminListCompetitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("competitions")
      .select("id, name, season, subprefeitura, conference_name, status")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
