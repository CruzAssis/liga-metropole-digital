import { createFileRoute } from "@tanstack/react-router";
import { SkeletonRankingPage, EmptyRanking } from "@/components/AppSkeletons";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

type Match = {
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
  status: string;
  competition_id: string | null;
};

type Team = {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  registration_type: "host" | "visitor";
  lado: "A" | "B";
  competition_id: string | null;
};

type Competition = {
  id: string;
  name: string;
  conference_name: string | null;
  subprefeitura: string | null;
  zona: string | null;
  season: number | null;
};

type Standing = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  supporters: number;
};

const FINISHED = ["confirmed", "closed", "wo"];

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte", sul: "Zona Sul", leste: "Zona Leste", oeste: "Zona Oeste", centro: "Centro",
};

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({
    meta: [
      { title: "Classificação · Liga Metrópole 2026" },
      {
        name: "description",
        content:
          "Rankings de Mandantes e Visitantes da Liga Metrópole. 40 times por grupo, top 8 ao playoff, últimos 10 rebaixados para Série B.",
      },
    ],
  }),
});

function computeStandings(
  teams: Team[],
  matches: Match[],
  supporters: Map<string, number>,
): Standing[] {
  const map = new Map<string, Standing>();
  for (const t of teams) {
    map.set(t.id, {
      team: t,
      played: 0, wins: 0, draws: 0, losses: 0,
      gf: 0, ga: 0, gd: 0, points: 0,
      supporters: supporters.get(t.id) ?? 0,
    });
  }
  for (const m of matches) {
    const h = map.get(m.host_team_id);
    const v = map.get(m.visitor_team_id);
    if (!h && !v) continue;
    const hs = m.host_score ?? 0;
    const vs = m.visitor_score ?? 0;
    if (h) {
      h.played++; h.gf += hs; h.ga += vs;
      if (hs > vs) { h.wins++; h.points += 3; }
      else if (hs < vs) { h.losses++; }
      else { h.draws++; h.points++; }
    }
    if (v) {
      v.played++; v.gf += vs; v.ga += hs;
      if (vs > hs) { v.wins++; v.points += 3; }
      else if (vs < hs) { v.losses++; }
      else { v.draws++; v.points++; }
    }
  }
  return Array.from(map.values())
    .map((s) => ({ ...s, gd: s.gf - s.ga }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.team.name.localeCompare(b.team.name),
    );
}

function StandingsTable({ rows }: { rows: Standing[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum time aprovado nesta categoria ainda.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left p-3 w-10">#</th>
            <th className="text-left p-3">Time</th>
            <th className="text-center p-2">P</th>
            <th className="text-center p-2">J</th>
            <th className="text-center p-2">V</th>
            <th className="text-center p-2">E</th>
            <th className="text-center p-2">D</th>
            <th className="text-center p-2">GP</th>
            <th className="text-center p-2">GC</th>
            <th className="text-center p-2">SG</th>
            <th className="text-center p-2 hidden sm:table-cell">Torc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pos = i + 1;
            const isTop8 = pos <= 8;
            const isRelegation = pos >= rows.length - 9 && rows.length >= 10;
            const rowCls = isTop8
              ? "bg-emerald-500/5 border-l-2 border-emerald-500"
              : isRelegation
              ? "bg-red-500/5 border-l-2 border-red-500"
              : "";
            return (
              <tr key={r.team.id} className={`border-b border-border last:border-0 ${rowCls}`}>
                <td className="p-3 text-muted-foreground tabular-nums font-mono">{pos}</td>
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-2">
                    {r.team.logo_url ? (
                      <img src={r.team.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted" />
                    )}
                    <span className="hidden sm:inline">{r.team.name}</span>
                    <span className="sm:hidden font-mono">{r.team.short_name}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{r.team.lado}</Badge>
                  </div>
                </td>
                <td className="text-center p-2 font-bold text-primary tabular-nums">{r.points}</td>
                <td className="text-center p-2 tabular-nums">{r.played}</td>
                <td className="text-center p-2 tabular-nums">{r.wins}</td>
                <td className="text-center p-2 tabular-nums">{r.draws}</td>
                <td className="text-center p-2 tabular-nums">{r.losses}</td>
                <td className="text-center p-2 tabular-nums">{r.gf}</td>
                <td className="text-center p-2 tabular-nums">{r.ga}</td>
                <td className="text-center p-2 tabular-nums">{r.gd}</td>
                <td className="text-center p-2 tabular-nums hidden sm:table-cell text-muted-foreground">{r.supporters}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-3">
      <span className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/40 border-l-2 border-emerald-500" />
        Top 8 — Playoff
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm bg-red-500/40 border-l-2 border-red-500" />
        31º–40º — Rebaixamento Série B
      </span>
    </div>
  );
}

function RankingPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compsLoaded, setCompsLoaded] = useState(false);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [supporters, setSupporters] = useState<Map<string, number>>(new Map());

  // Load competitions that have active/finished status
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id, name, conference_name, subprefeitura, zona, season")
        .in("registration_status", ["active", "finished", "draw_ready", "open"])
        .order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as Competition[];
      setCompetitions(list);
      setCompsLoaded(true);
      if (list.length > 0) setSelectedComp(list[0].id);
    })();
  }, []);

  // Load teams + matches for selected competition
  useEffect(() => {
    if (!selectedComp) return;
    (async () => {
      const [{ data: tdata }, { data: mdata }, { data: sdata }] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, short_name, logo_url, registration_type, lado, competition_id")
          .eq("status", "approved")
          .eq("competition_id", selectedComp),
        supabase
          .from("matches")
          .select("host_team_id, visitor_team_id, host_score, visitor_score, status, competition_id")
          .eq("competition_id", selectedComp)
          .in("status", FINISHED),
        supabase.from("team_supporters").select("team_id"),
      ]);
      setTeams((tdata ?? []) as Team[]);
      setMatches((mdata ?? []) as Match[]);
      const sup = new Map<string, number>();
      for (const row of (sdata ?? []) as { team_id: string }[]) {
        sup.set(row.team_id, (sup.get(row.team_id) ?? 0) + 1);
      }
      setSupporters(sup);
    })();
  }, [selectedComp]);

  const hosts = useMemo(() => teams.filter((t) => t.registration_type === "host"), [teams]);
  const visitors = useMemo(() => teams.filter((t) => t.registration_type === "visitor"), [teams]);

  const hostStandings = useMemo(
    () => (matches ? computeStandings(hosts, matches, supporters) : []),
    [hosts, matches, supporters],
  );
  const visitorStandings = useMemo(
    () => (matches ? computeStandings(visitors, matches, supporters) : []),
    [visitors, matches, supporters],
  );

  const activeComp = competitions.find((c) => c.id === selectedComp);

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Classificação</h1>
        <p className="text-muted-foreground mt-1">
          Fase regular · 20 rodadas · pontos corridos. Vitória 3 · Empate 1 · Derrota 0.
        </p>
      </header>

      {/* Conference filter */}
      {competitions.length > 0 && (
        <div className="mb-6 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Conferência
          </label>
          <div className="flex flex-wrap gap-2">
            {competitions.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedComp(c.id); setMatches(null); }}
                className={[
                  "text-sm px-3 py-1.5 rounded-md border transition-colors",
                  selectedComp === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {c.conference_name ?? c.name}
                {c.season ? ` ${c.season}` : ""}
              </button>
            ))}
          </div>
          {compsLoaded && competitions.length === 0 && (
        <div className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-400 text-lg">Nenhuma conferência ativa.</p>
          <p className="text-zinc-500 text-sm mt-2">Crie uma liga no painel admin para visualizar o ranking.</p>
        </div>
      )}
      {activeComp?.subprefeitura && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {activeComp.subprefeitura}
              {activeComp.zona && ` · ${ZONA_LABELS[activeComp.zona] ?? activeComp.zona}`}
            </p>
          )}
        </div>
      )}

      {!matches && <SkeletonRankingPage />}

      {matches && matches.length === 0 && hostStandings.length === 0 && visitorStandings.length === 0 && (
          <EmptyRanking />
        )}
        {matches && (hostStandings.length > 0 || visitorStandings.length > 0) && (
        <Tabs defaultValue="mandantes">
          <TabsList>
            <TabsTrigger value="mandantes">Mandantes ({hosts.length})</TabsTrigger>
            <TabsTrigger value="visitantes">Visitantes ({visitors.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="mandantes" className="mt-4">
            <StandingsTable rows={hostStandings} />
            <Legend />
          </TabsContent>
          <TabsContent value="visitantes" className="mt-4">
            <StandingsTable rows={visitorStandings} />
            <Legend />
          </TabsContent>
        </Tabs>
      )}
    </PublicShell>
  );
      }
