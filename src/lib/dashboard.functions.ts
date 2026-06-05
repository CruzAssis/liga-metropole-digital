import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcStatus, diasAtraso, mesAtual } from "./pagamentos.functions";

const adminDb = supabaseAdmin as any;
type PagamentoDashboardRow = {
  time_id: string;
  status: "pendente" | "pago" | "atrasado";
  valor: number;
  mes_referencia: string;
};
type CompetitionDashboardRow = { id: string; conference_name: string | null; name: string };

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response(JSON.stringify({ error: "Apenas admin" }), { status: 403 });
}

export type DashboardMetrics = {
  // Teams
  total_teams: number;
  approved_teams: number;
  pending_teams: number;
  // Athletes
  verified_athletes: number;
  // Sumulas
  sumulas_pending_fill: number;   // scheduled - no fill yet
  sumulas_awaiting_confirm: number; // host filled, visitor hasn't confirmed
  sumulas_disputed: number;
  sumulas_expiring_24h: number;    // scheduled, past match date > 24h ago
  // Revenue
  mes_referencia: string;
  times_pagos: number;
  total_aprovados: number;
  receita_mes: number;
  receita_esperada: number;
  // Upcoming matches
  proximos_jogos: UpcomingMatch[];
  // Inscriptions by conference
  inscricoes_por_conferencia: ConferenceCount[];
};

export type UpcomingMatch = {
  id: string;
  scheduled_at: string | null;
  stage: string;
  round: number | null;
  host_name: string;
  visitor_name: string;
  host_short: string;
  visitor_short: string;
  status: string;
};

export type ConferenceCount = {
  conference_name: string;
  total: number;
  approved: number;
  pending: number;
};

export const getAdminDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);

    // 1. Teams stats
    const { data: allTeams } = await supabaseAdmin
      .from("teams")
      .select("id, status, competition_id");
    const teams = allTeams ?? [];
    const total_teams = teams.length;
    const approved_teams = teams.filter((t) => t.status === "approved").length;
    const pending_teams = teams.filter((t) => t.status === "pending").length;

    // 2. Verified athletes
    const { count: verified_athletes } = await supabaseAdmin
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("verified", true);

    // 3. Sumulas
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, status, scheduled_at, host_filled_at")
      .in("status", ["scheduled", "awaiting_confirmation", "disputed"]);
    const matchList = matches ?? [];
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sumulas_pending_fill = matchList.filter(
      (m) => m.status === "scheduled" && !m.host_filled_at
    ).length;
    const sumulas_awaiting_confirm = matchList.filter(
      (m) => m.status === "awaiting_confirmation"
    ).length;
    const sumulas_disputed = matchList.filter((m) => m.status === "disputed").length;
    // Expiring: scheduled matches where scheduled_at is in the past (>24h overdue)
    const sumulas_expiring_24h = matchList.filter((m) => {
      if (!m.scheduled_at || m.status !== "scheduled") return false;
      const matchDate = new Date(m.scheduled_at);
      const diffHours = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 48; // match happened in last 48h but no fill yet
    }).length;

    // 4. Revenue this month
    const mes = mesAtual();
    const { data: approvedTeamsData } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("status", "approved");
    const approvedIds = (approvedTeamsData ?? []).map((t) => t.id);
    const { data: pagamentos } = approvedIds.length
      ? await adminDb
          .from("pagamentos")
          .select("time_id, status, valor, mes_referencia")
          .eq("mes_referencia", mes)
          .in("time_id", approvedIds)
      : { data: [] };
    const pagList = (pagamentos ?? []) as PagamentoDashboardRow[];
    const times_pagos = pagList.filter(
      (p) => calcStatus({ status: p.status as "pendente" | "pago" | "atrasado", mes_referencia: p.mes_referencia }) === "pago"
    ).length;
    const total_aprovados = approvedIds.length;
    const receita_mes = pagList
      .filter((p) => calcStatus({ status: p.status as "pendente" | "pago" | "atrasado", mes_referencia: p.mes_referencia }) === "pago")
      .reduce((s, p) => s + Number(p.valor), 0);
    const receita_esperada = total_aprovados * 150; // R$150 per team

    // 5. Upcoming matches (next 7 days)
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data: upcoming } = await supabaseAdmin
      .from("matches")
      .select("id, stage, round, host_team_id, visitor_team_id, scheduled_at, status")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", weekEnd.toISOString())
      .in("status", ["scheduled", "awaiting_confirmation"])
      .order("scheduled_at", { ascending: true })
      .limit(10);
    const upcomingList = upcoming ?? [];
    const teamIds = Array.from(
      new Set(upcomingList.flatMap((m) => [m.host_team_id, m.visitor_team_id]))
    );
    const { data: teamData } = teamIds.length
      ? await supabaseAdmin
          .from("teams")
          .select("id, name, short_name")
          .in("id", teamIds)
      : { data: [] };
    const teamMap: Record<string, { name: string; short_name: string }> = {};
    for (const t of teamData ?? []) teamMap[t.id] = t;

    const proximos_jogos: UpcomingMatch[] = upcomingList.map((m) => ({
      id: m.id,
      scheduled_at: m.scheduled_at,
      stage: m.stage,
      round: m.round,
      host_name: teamMap[m.host_team_id]?.name ?? "—",
      visitor_name: teamMap[m.visitor_team_id]?.name ?? "—",
      host_short: teamMap[m.host_team_id]?.short_name ?? "—",
      visitor_short: teamMap[m.visitor_team_id]?.short_name ?? "—",
      status: m.status,
    }));

    // 6. Inscriptions by conference
    const { data: competitions } = await adminDb
      .from("competitions")
      .select("id, conference_name, name");
    const competitionMap: Record<string, string> = {};
    for (const c of (competitions ?? []) as CompetitionDashboardRow[]) {
      competitionMap[c.id] = c.conference_name ?? c.name;
    }

    const { data: teamsByComp } = await supabaseAdmin
      .from("teams")
      .select("id, status, competition_id")
      .in("status", ["approved", "pending"]);

    const confCounts: Record<string, { total: number; approved: number; pending: number }> = {};
    for (const t of teamsByComp ?? []) {
      const conf = t.competition_id ? competitionMap[t.competition_id] ?? "Sem conferência" : "Sem conferência";
      if (!confCounts[conf]) confCounts[conf] = { total: 0, approved: 0, pending: 0 };
      confCounts[conf].total++;
      if (t.status === "approved") confCounts[conf].approved++;
      if (t.status === "pending") confCounts[conf].pending++;
    }

    const inscricoes_por_conferencia: ConferenceCount[] = Object.entries(confCounts)
      .map(([conference_name, counts]) => ({ conference_name, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12); // top 12 conferences

    return {
      total_teams,
      approved_teams,
      pending_teams,
      verified_athletes: verified_athletes ?? 0,
      sumulas_pending_fill,
      sumulas_awaiting_confirm,
      sumulas_disputed,
      sumulas_expiring_24h,
      mes_referencia: mes,
      times_pagos,
      total_aprovados,
      receita_mes,
      receita_esperada,
      proximos_jogos,
      inscricoes_por_conferencia,
    } satisfies DashboardMetrics;
  });
