import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdvancedTeamStats,
  getLeagueKpis,
  getHeadToHead,
  getLeagueTrends,
  getPlayerStats,
} from "@/lib/estatisticas.functions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Goal, Trophy, ShieldAlert, Target, Swords } from "lucide-react";

type Competition = {
  id: string;
  name: string;
  conference_name: string | null;
  season: number | null;
};

type TeamAdvanced = {
  team: {
    id: string;
    name: string;
    short_name: string;
    logo_url: string | null;
    slug: string | null;
    lado: "A" | "B" | null;
  };
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

type Kpis = {
  matches_played: number;
  teams_count: number;
  total_goals: number;
  avg_goals: number;
  yellow_cards: number;
  red_cards: number;
  biggest_match: { host: string; visitor: string; hs: number; vs: number } | null;
};

export const Route = createFileRoute("/estatisticas")({
  component: EstatisticasPage,
  head: () => ({
    meta: [
      { title: "Estatísticas Avançadas · Liga Metrópole" },
      {
        name: "description",
        content:
          "Panorama da temporada, aproveitamento por time, forma recente, cartões e confrontos diretos da Liga Metrópole.",
      },
    ],
  }),
});

function FormDots({ form }: { form: ("V" | "E" | "D")[] }) {
  if (!form.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          title={f === "V" ? "Vitória" : f === "E" ? "Empate" : "Derrota"}
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
            f === "V"
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
              : f === "E"
              ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
              : "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
          }`}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="stat-number text-3xl">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EstatisticasPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<TeamAdvanced[] | null>(null);
  const [trends, setTrends] = useState<
    { key: string; label: string; goals: number; matches: number; yellow: number; red: number }[] | null
  >(null);

  const fetchKpis = useServerFn(getLeagueKpis);
  const fetchAdv = useServerFn(getAdvancedTeamStats);
  const fetchH2H = useServerFn(getHeadToHead);
  const fetchTrends = useServerFn(getLeagueTrends);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id, name, conference_name, season")
        .in("registration_status", ["active", "finished", "draw_ready", "open"])
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Competition[];
      setComps(list);
      if (list.length > 0) setSelectedComp(list[0].id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [k, r, t] = await Promise.all([
        fetchKpis({ data: { competition_id: selectedComp } }),
        fetchAdv({ data: { competition_id: selectedComp } }),
        fetchTrends({ data: { competition_id: selectedComp } }),
      ]);
      setKpis(k as Kpis);
      setRows(r as TeamAdvanced[]);
      setTrends(t as any);
    })();
  }, [selectedComp]);

  // Head to head state
  const [teamA, setTeamA] = useState<string | null>(null);
  const [teamB, setTeamB] = useState<string | null>(null);
  const [h2h, setH2h] = useState<Awaited<ReturnType<typeof fetchH2H>> | null>(null);
  const teamOptions = useMemo(() => rows?.map((r) => r.team) ?? [], [rows]);

  const runH2h = async () => {
    if (!teamA || !teamB || teamA === teamB) return;
    const res = await fetchH2H({ data: { team_a: teamA, team_b: teamB } });
    setH2h(res);
  };

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Temporada 2026"
        title="Estatísticas avançadas"
        description="Panorama, forma recente, aproveitamento, disciplina e confrontos diretos."
      />

      {comps.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Select value={selectedComp ?? ""} onValueChange={(v) => setSelectedComp(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar conferência" />
            </SelectTrigger>
            <SelectContent>
              {comps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="panorama">
        <TabsList>
          <TabsTrigger value="panorama">
            <BarChart3 className="h-4 w-4 mr-1" /> Panorama
          </TabsTrigger>
          <TabsTrigger value="times">
            <Trophy className="h-4 w-4 mr-1" /> Times
          </TabsTrigger>
          <TabsTrigger value="confronto">
            <Swords className="h-4 w-4 mr-1" /> Confronto direto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="panorama" className="mt-6">
          {!kpis ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={Trophy} label="Partidas" value={kpis.matches_played} hint={`${kpis.teams_count} times ativos`} />
              <KpiCard icon={Goal} label="Gols" value={kpis.total_goals} hint={`${kpis.avg_goals} por partida`} />
              <KpiCard
                icon={ShieldAlert}
                label="Cartões"
                value={kpis.yellow_cards + kpis.red_cards}
                hint={`${kpis.yellow_cards} amarelos · ${kpis.red_cards} vermelhos`}
              />
              <KpiCard
                icon={Target}
                label="Maior goleada"
                value={
                  kpis.biggest_match
                    ? `${kpis.biggest_match.hs}x${kpis.biggest_match.vs}`
                    : "—"
                }
                hint={
                  kpis.biggest_match
                    ? `${kpis.biggest_match.host} vs ${kpis.biggest_match.visitor}`
                    : "Sem partidas confirmadas"
                }
              />
            </div>
          )}

          {trends && trends.length > 0 && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                    Gols por rodada
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="goals" name="Gols" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="matches" name="Partidas" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                    Cartões por rodada
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="yellow" name="Amarelos" stackId="c" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="red" name="Vermelhos" stackId="c" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="times" className="mt-6 space-y-6">
          {rows && rows.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                    Top 8 ataques (gols marcados)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...rows].sort((a, b) => b.gf - a.gf).slice(0, 8).map((r) => ({
                        name: r.team.short_name,
                        gols: r.gf,
                        sofridos: r.ga,
                      }))}
                      margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="gols" name="Marcados" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="sofridos" name="Sofridos" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                    Distribuição de resultados (liga)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Vitórias", value: rows.reduce((s, r) => s + r.wins, 0), fill: "#10b981" },
                          { name: "Empates", value: rows.reduce((s, r) => s + r.draws, 0), fill: "#f59e0b" },
                          { name: "Derrotas", value: rows.reduce((s, r) => s + r.losses, 0), fill: "#ef4444" },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {["#10b981", "#f59e0b", "#ef4444"].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}


          {!rows ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem times aprovados nesta conferência.</div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground border-b border-border font-semibold tracking-wider bg-muted/30">
                  <tr>
                    <th className="text-left p-3">Time</th>
                    <th className="text-center p-2">J</th>
                    <th className="text-center p-2">Aprov.</th>
                    <th className="text-center p-2">SG</th>
                    <th className="text-center p-2">Clean</th>
                    <th className="text-center p-2">S/ marcar</th>
                    <th className="text-center p-2">🟨</th>
                    <th className="text-center p-2">🟥</th>
                    <th className="text-left p-3">Últimos 5</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.team.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.team.logo_url ? (
                            <img src={r.team.logo_url} alt="" className="h-8 w-8 rounded-md object-cover ring-1 ring-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-muted grid place-items-center text-[11px] font-bold">
                              {r.team.short_name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="hidden sm:inline truncate font-medium">{r.team.name}</span>
                          <span className="sm:hidden font-mono font-semibold">{r.team.short_name}</span>
                          {r.team.lado && (
                            <Badge variant="outline" className="text-[10px] ml-1">{r.team.lado}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2 tabular-nums text-muted-foreground">{r.played}</td>
                      <td className="text-center p-2 tabular-nums font-semibold text-primary">
                        {r.aproveitamento}%
                      </td>
                      <td
                        className={`text-center p-2 tabular-nums font-semibold ${
                          r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        {r.gd > 0 ? "+" : ""}
                        {r.gd}
                      </td>
                      <td className="text-center p-2 tabular-nums">{r.clean_sheets}</td>
                      <td className="text-center p-2 tabular-nums text-muted-foreground">{r.failed_to_score}</td>
                      <td className="text-center p-2 tabular-nums text-amber-400">{r.yellow}</td>
                      <td className="text-center p-2 tabular-nums text-red-400">{r.red}</td>
                      <td className="p-3">
                        <FormDots form={r.form} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="confronto" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Time A</label>
              <Select value={teamA ?? ""} onValueChange={setTeamA}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Time B</label>
              <Select value={teamB ?? ""} onValueChange={setTeamB}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.filter((t) => t.id !== teamA).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={runH2h}
              disabled={!teamA || !teamB || teamA === teamB}
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              Comparar
            </button>
          </div>

          {h2h && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {h2h.team_a?.name} × {h2h.team_b?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="stat-number text-3xl text-emerald-400">{h2h.summary.winsA}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      Vitórias {h2h.team_a?.short_name}
                    </div>
                  </div>
                  <div>
                    <div className="stat-number text-3xl text-amber-400">{h2h.summary.draws}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Empates</div>
                  </div>
                  <div>
                    <div className="stat-number text-3xl text-emerald-400">{h2h.summary.winsB}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      Vitórias {h2h.team_b?.short_name}
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Gols: <span className="text-foreground font-semibold">{h2h.summary.goalsA}</span> ×{" "}
                  <span className="text-foreground font-semibold">{h2h.summary.goalsB}</span> ·{" "}
                  {h2h.summary.total} partidas
                </div>

                {(h2h.matches?.length ?? 0) > 0 ? (
                  <div className="rounded-md border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase text-muted-foreground border-b border-border bg-muted/30">
                        <tr>
                          <th className="text-left p-2">Data</th>
                          <th className="text-left p-2">Casa</th>
                          <th className="text-center p-2">Placar</th>
                          <th className="text-left p-2">Visitante</th>
                          <th className="text-center p-2 hidden sm:table-cell">Rodada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {h2h.matches.map((m: any) => {
                          const hName =
                            m.host_team_id === h2h.team_a?.id
                              ? h2h.team_a?.short_name
                              : h2h.team_b?.short_name;
                          const vName =
                            m.visitor_team_id === h2h.team_a?.id
                              ? h2h.team_a?.short_name
                              : h2h.team_b?.short_name;
                          return (
                            <tr key={m.id} className="border-b border-border/60 last:border-0">
                              <td className="p-2 text-muted-foreground">
                                {m.scheduled_at
                                  ? new Date(m.scheduled_at).toLocaleDateString("pt-BR")
                                  : "—"}
                              </td>
                              <td className="p-2 font-medium">{hName}</td>
                              <td className="p-2 text-center font-mono font-bold">
                                {m.host_score ?? 0} × {m.visitor_score ?? 0}
                              </td>
                              <td className="p-2 font-medium">{vName}</td>
                              <td className="p-2 text-center text-muted-foreground hidden sm:table-cell">
                                {m.round ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Sem confrontos registrados entre esses times.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PublicShell>
  );
}
