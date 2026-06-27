// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  ClipboardList,
  UserCheck,
  Shuffle,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  FileWarning,
  ChevronRight,
  Trophy,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mesAtual() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon, color, alert = false, href }) {
  const inner = (
    <Card className={`bg-zinc-900 border-zinc-800 ${alert ? "border-red-500/50 bg-red-950/10" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-xs uppercase tracking-wide ${alert ? "text-red-400" : "text-zinc-400"}`}>
              {label}
            </p>
            <p className={`text-4xl font-black mt-1 tabular-nums ${alert ? "text-red-400" : "text-white"}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
            Ver detalhes <ChevronRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data }) {
  if (!data || !data.length) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Nenhuma inscrição registrada ainda.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="space-y-2.5 mt-2">
      {data.map((d) => (
        <div key={d.conference_name} className="flex items-center gap-3 min-w-0">
          <span
            className="text-xs text-zinc-400 text-right shrink-0 truncate"
            style={{ width: 160 }}
            title={d.conference_name}
          >
            {d.conference_name}
          </span>
          <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden relative">
            <div
              className="h-full bg-[#1565F5]/80 rounded transition-all"
              style={{ width: `${(d.total / max) * 100}%` }}
            />
            <div
              className="h-full bg-emerald-600/70 rounded absolute top-0 left-0"
              style={{ width: `${(d.approved / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400 tabular-nums shrink-0 w-16 text-right">
            <span className="text-white">{d.approved}</span>
            <span className="text-zinc-600">/{d.total}</span>
          </span>
        </div>
      ))}
      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-600/70" /> Aprovados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-[#1565F5]/50" /> Total inscritos
        </span>
      </div>
    </div>
  );
}

// ─── Match Row ────────────────────────────────────────────────────────────────

function MatchRow({ match }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0">
      <div className="text-xs text-zinc-500 w-28 shrink-0">
        {match.scheduled_at ? fmtDate(match.scheduled_at) : "—"}
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-white truncate">
          {match.host_short || match.host_name || "—"}
        </span>
        <span className="text-zinc-600 text-xs">×</span>
        <span className="text-sm font-medium text-white truncate">
          {match.visitor_short || match.visitor_name || "—"}
        </span>
      </div>
      {match.round != null && (
        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 shrink-0">
          Rod. {match.round}
        </Badge>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const mes = mesAtual();

      // 1. Teams
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, status, competition_id");
      const teams = allTeams || [];
      const total_teams = teams.length;
      const approved_teams = teams.filter((t) => t.status === "approved").length;
      const pending_teams = teams.filter((t) => t.status === "pending").length;

      // 2. Verified athletes
      const { count: verified_athletes } = await supabase
        .from("athletes")
        .select("id", { count: "exact", head: true })
        .eq("verified", true);

      // 3. Sumulas / matches
      const { data: matchData } = await supabase
        .from("matches")
        .select("id, status, scheduled_at, host_filled_at")
        .in("status", ["scheduled", "awaiting_confirmation", "disputed"]);
      const matchList = matchData || [];
      const sumulas_pending_fill = matchList.filter(
        (m) => m.status === "scheduled" && !m.host_filled_at
      ).length;
      const sumulas_awaiting_confirm = matchList.filter(
        (m) => m.status === "awaiting_confirmation"
      ).length;
      const sumulas_disputed = matchList.filter((m) => m.status === "disputed").length;
      const sumulas_expiring_24h = matchList.filter((m) => {
        if (!m.scheduled_at || m.status !== "scheduled") return false;
        const matchDate = new Date(m.scheduled_at);
        const diffHours = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 48;
      }).length;

      // 4. Revenue this month
      const approvedIds = teams.filter((t) => t.status === "approved").map((t) => t.id);
      let times_pagos = 0;
      let receita_mes = 0;
      const total_aprovados = approvedIds.length;
      if (approvedIds.length > 0) {
        const { data: pags } = await supabase
          .from("pagamentos")
          .select("time_id, status, valor, mes_referencia")
          .eq("mes_referencia", mes)
          .in("time_id", approvedIds);
        const pagList = pags || [];
        times_pagos = pagList.filter((p) => p.status === "pago").length;
        receita_mes = pagList
          .filter((p) => p.status === "pago")
          .reduce((s, p) => s + Number(p.valor), 0);
      }
      const receita_esperada = total_aprovados * 120;

      // 5. Upcoming matches (next 7 days)
      const { data: upcoming } = await supabase
        .from("matches")
        .select("id, stage, round, host_team_id, visitor_team_id, scheduled_at, status")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", weekEnd.toISOString())
        .in("status", ["scheduled", "awaiting_confirmation"])
        .order("scheduled_at", { ascending: true })
        .limit(10);
      const upcomingList = upcoming || [];
      const teamIds = [
        ...new Set(upcomingList.flatMap((m) => [m.host_team_id, m.visitor_team_id])),
      ];
      let teamMap = {};
      if (teamIds.length > 0) {
        const { data: teamNames } = await supabase
          .from("teams")
          .select("id, name, short_name")
          .in("id", teamIds);
        for (const t of teamNames || []) teamMap[t.id] = t;
      }
      const proximos_jogos = upcomingList.map((m) => ({
        id: m.id,
        scheduled_at: m.scheduled_at,
        stage: m.stage,
        round: m.round,
        host_name: teamMap[m.host_team_id]?.name || "—",
        host_short: teamMap[m.host_team_id]?.short_name || "—",
        visitor_name: teamMap[m.visitor_team_id]?.name || "—",
        visitor_short: teamMap[m.visitor_team_id]?.short_name || "—",
        status: m.status,
      }));

      // 6. Inscriptions by conference
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, conference_name, name");
      const compMap = {};
      for (const c of comps || []) compMap[c.id] = c.conference_name || c.name;
      const confCounts = {};
      for (const t of teams.filter((t) => ["approved", "pending"].includes(t.status))) {
        const conf = t.competition_id
          ? compMap[t.competition_id] || "Sem conferência"
          : "Sem conferência";
        if (!confCounts[conf]) confCounts[conf] = { total: 0, approved: 0 };
        confCounts[conf].total++;
        if (t.status === "approved") confCounts[conf].approved++;
      }
      const inscricoes_por_conferencia = Object.entries(confCounts)
        .map(([conference_name, counts]) => ({ conference_name, ...counts }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12);

      setMetrics({
        total_teams,
        approved_teams,
        pending_teams,
        verified_athletes: verified_athletes || 0,
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
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(err?.message || "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      fetchMetrics();
    }
  }, [adminLoading, isAdmin, fetchMetrics]);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }

  if (!isAdmin) return null;

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div>
          <p className="text-lg font-semibold text-zinc-100">Erro ao carregar métricas</p>
          <p className="text-sm text-zinc-400 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-zinc-800 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const pctPagos =
    metrics.total_aprovados > 0
      ? Math.round((metrics.times_pagos / metrics.total_aprovados) * 100)
      : 0;
  const hasAlerts = metrics.sumulas_expiring_24h > 0 || metrics.sumulas_disputed > 0;

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-white">Painel Admin</h1>
          <p className="text-zinc-400 text-sm mt-1">Liga Metrópole · Métricas em tempo real</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            {metrics.sumulas_expiring_24h > 0 && (
              <p className="text-red-300">
                <strong>{metrics.sumulas_expiring_24h}</strong> súmula
                {metrics.sumulas_expiring_24h !== 1 ? "s" : ""} com prazo expirando!{" "}
                <Link to="/admin/sumulas" className="underline hover:text-red-200">
                  Ver súmulas →
                </Link>
              </p>
            )}
            {metrics.sumulas_disputed > 0 && (
              <p className="text-red-300">
                <strong>{metrics.sumulas_disputed}</strong> súmula
                {metrics.sumulas_disputed !== 1 ? "s" : ""} contestada
                {metrics.sumulas_disputed !== 1 ? "s" : ""}.{" "}
                <Link to="/admin/sumulas" className="underline hover:text-red-200">
                  Resolver →
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-xl tracking-wide text-zinc-200 mb-3">Atalhos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Link to="/admin/ligas">
              <Plus className="h-4 w-4" />
              Criar / Gerenciar ligas
            </Link>
          </Button>
          <Button asChild className="bg-[#1565F5] hover:bg-blue-600 text-white gap-2">
            <Link to="/admin/triagem">
              <UserCheck className="h-4 w-4" />
              Aprovar times pendentes
              {metrics.pending_teams > 0 && (
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {metrics.pending_teams}
                </span>
              )}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-2"
          >
            <Link to="/admin/sumulas">
              <ClipboardList className="h-4 w-4" />
              Ver súmulas abertas
              {metrics.sumulas_pending_fill + metrics.sumulas_awaiting_confirm > 0 && (
                <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded-full">
                  {metrics.sumulas_pending_fill + metrics.sumulas_awaiting_confirm}
                </span>
              )}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-2"
          >
            <Link to="/admin/sorteio">
              <Shuffle className="h-4 w-4" /> Sorteio / Rodadas
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-2"
          >
            <Link to="/admin/financeiro">
              <DollarSign className="h-4 w-4" /> Financeiro
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-2"
          >
            <Link to="/admin/usuarios">
              <Users className="h-4 w-4" /> Usuários
            </Link>
          </Button>
        </div>
      </div>

      {/* Times */}
      <div>
        <h2 className="font-display text-xl tracking-wide text-zinc-200 mb-3">Times</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total de times"
            value={metrics.total_teams}
            icon={<Users className="h-5 w-5 text-blue-400" />}
            color="bg-blue-950/40"
          />
          <MetricCard
            label="Aprovados"
            value={metrics.approved_teams}
            sub="Inscrições confirmadas"
            icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
            color="bg-emerald-950/40"
            href="/admin/triagem"
          />
          <MetricCard
            label="Aguardando triagem"
            value={metrics.pending_teams}
            sub={metrics.pending_teams > 0 ? "Clique para avaliar" : "Nenhum pendente"}
            icon={<Clock className="h-5 w-5 text-amber-400" />}
            color="bg-amber-950/40"
            alert={metrics.pending_teams > 0}
            href="/admin/triagem"
          />
          <MetricCard
            label="Atletas verificados"
            value={metrics.verified_athletes}
            sub="Com Selo Verificado ✓"
            icon={<UserCheck className="h-5 w-5 text-purple-400" />}
            color="bg-purple-950/40"
          />
        </div>
      </div>

      {/* Súmulas */}
      <div>
        <h2 className="font-display text-xl tracking-wide text-zinc-200 mb-3">Súmulas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Pendentes de preenchimento"
            value={metrics.sumulas_pending_fill}
            icon={<ClipboardList className="h-5 w-5 text-zinc-400" />}
            color="bg-zinc-800/60"
            href="/admin/sumulas"
          />
          <MetricCard
            label="Aguardando confirmação"
            value={metrics.sumulas_awaiting_confirm}
            icon={<Clock className="h-5 w-5 text-amber-400" />}
            color="bg-amber-950/40"
            href="/admin/sumulas"
          />
          <MetricCard
            label="Contestadas"
            value={metrics.sumulas_disputed}
            sub={metrics.sumulas_disputed > 0 ? "Requerem resolução" : "Nenhuma contestação"}
            icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
            color="bg-red-950/40"
            alert={metrics.sumulas_disputed > 0}
            href="/admin/sumulas"
          />
          <MetricCard
            label="Prazo expirando"
            value={metrics.sumulas_expiring_24h}
            sub="Jogos das últimas 48h sem preenchimento"
            icon={<FileWarning className="h-5 w-5 text-red-400" />}
            color="bg-red-950/40"
            alert={metrics.sumulas_expiring_24h > 0}
            href="/admin/sumulas"
          />
        </div>
      </div>

      {/* Financeiro */}
      <div>
        <h2 className="font-display text-xl tracking-wide text-zinc-200 mb-3">
          Financeiro ·{" "}
          {new Date(metrics.mes_referencia).toLocaleString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Receita do mês"
            value={fmtBRL(metrics.receita_mes)}
            sub={`${metrics.times_pagos} de ${metrics.total_aprovados} times pagaram`}
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            color="bg-emerald-950/40"
            href="/admin/financeiro"
          />
          <MetricCard
            label="Receita esperada"
            value={fmtBRL(metrics.receita_esperada)}
            sub="R$120 × times aprovados"
            icon={<DollarSign className="h-5 w-5 text-blue-400" />}
            color="bg-blue-950/40"
          />
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                Taxa de adimplência
              </p>
              <p className="text-4xl font-black mt-1 text-white tabular-nums">{pctPagos}%</p>
              <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pctPagos >= 80
                      ? "bg-emerald-500"
                      : pctPagos >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${pctPagos}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {metrics.total_aprovados - metrics.times_pagos} times em aberto
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chart + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center justify-between">
              <span>Inscrições por conferência</span>
              <span className="text-xs text-zinc-500 font-normal">Aprovados / Total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={metrics.inscricoes_por_conferencia} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                Próximos jogos (7 dias)
              </span>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-500 hover:text-zinc-300 -mr-2"
              >
                <Link to="/agenda">Ver agenda →</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {metrics.proximos_jogos.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">
                  Nenhum jogo nos próximos 7 dias.
                </p>
              </div>
            ) : (
              <div>
                {metrics.proximos_jogos.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
