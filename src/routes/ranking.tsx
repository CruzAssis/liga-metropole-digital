import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Match = {
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
  status: string;
  group_label: string | null;
  stage: string;
};

type Team = {
  id: string;
  name: string;
  short_name: string;
  registration_type: "host" | "visitor";
};

type Standing = {
  team_id: string;
  team_name: string;
  short_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const FINISHED = ["confirmed", "wo"];

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({
    meta: [
      { title: "Ranking · Liga Metrópole Várzea" },
      { name: "description", content: "Classificação dos times da Liga Metrópole Várzea." },
    ],
  }),
});

function computeStandings(matches: Match[], teams: Map<string, Team>): Standing[] {
  const t = new Map<string, Standing>();
  const ensure = (id: string) => {
    if (!t.has(id)) {
      const team = teams.get(id);
      t.set(id, {
        team_id: id,
        team_name: team?.name ?? "—",
        short_name: team?.short_name ?? "—",
        played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0,
      });
    }
    return t.get(id)!;
  };

  for (const m of matches) {
    const h = ensure(m.host_team_id);
    const v = ensure(m.visitor_team_id);
    const hs = m.host_score ?? 0;
    const vs = m.visitor_score ?? 0;
    h.played++; v.played++;
    h.gf += hs; h.ga += vs;
    v.gf += vs; v.ga += hs;
    if (hs > vs) { h.wins++; h.points += 3; v.losses++; }
    else if (hs < vs) { v.wins++; v.points += 3; h.losses++; }
    else { h.draws++; v.draws++; h.points++; v.points++; }
  }

  return Array.from(t.values())
    .map((s) => ({ ...s, gd: s.gf - s.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team_name.localeCompare(b.team_name));
}

function StandingsTable({ rows }: { rows: Standing[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Sem partidas confirmadas neste grupo.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left p-3 w-8">#</th>
            <th className="text-left p-3">Time</th>
            <th className="text-center p-2">P</th>
            <th className="text-center p-2">J</th>
            <th className="text-center p-2">V</th>
            <th className="text-center p-2">E</th>
            <th className="text-center p-2">D</th>
            <th className="text-center p-2">GP</th>
            <th className="text-center p-2">GC</th>
            <th className="text-center p-2">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team_id} className="border-b border-border last:border-0">
              <td className="p-3 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="p-3 font-medium">
                <span className="hidden sm:inline">{r.team_name}</span>
                <span className="sm:hidden font-mono">{r.short_name}</span>
              </td>
              <td className="text-center p-2 font-bold text-primary tabular-nums">{r.points}</td>
              <td className="text-center p-2 tabular-nums">{r.played}</td>
              <td className="text-center p-2 tabular-nums">{r.wins}</td>
              <td className="text-center p-2 tabular-nums">{r.draws}</td>
              <td className="text-center p-2 tabular-nums">{r.losses}</td>
              <td className="text-center p-2 tabular-nums">{r.gf}</td>
              <td className="text-center p-2 tabular-nums">{r.ga}</td>
              <td className="text-center p-2 tabular-nums">{r.gd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConferenceView({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Map<string, Team>;
}) {
  // Group matches by group_label
  const groups = useMemo(() => {
    const m = new Map<string, Match[]>();
    for (const match of matches) {
      const key = match.group_label ?? "—";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(match);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches]);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Nenhum jogo confirmado nesta conferência.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([label, list]) => (
        <div key={label}>
          <h3 className="font-display text-xl tracking-wide mb-2">Grupo {label}</h3>
          <StandingsTable rows={computeStandings(list, teams)} />
        </div>
      ))}
    </div>
  );
}

function RankingPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("matches")
        .select("host_team_id, visitor_team_id, host_score, visitor_score, status, group_label, stage")
        .in("status", FINISHED)
        .eq("stage", "group");

      const list = (m ?? []) as Match[];
      setMatches(list);

      const ids = Array.from(new Set(list.flatMap((x) => [x.host_team_id, x.visitor_team_id])));
      if (ids.length > 0) {
        const { data: tdata } = await supabase
          .from("teams")
          .select("id, name, short_name, registration_type")
          .in("id", ids);
        const map = new Map<string, Team>();
        for (const t of (tdata ?? []) as Team[]) map.set(t.id, t);
        setTeams(map);
      }
    })();
  }, []);

  const hostMatches = matches?.filter((m) => teams.get(m.host_team_id)?.registration_type === "host") ?? [];
  const visitorMatches = matches?.filter((m) => teams.get(m.host_team_id)?.registration_type === "visitor") ?? [];

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Ranking</h1>
        <p className="text-muted-foreground mt-1">
          Classificação por pontos · fase de grupos. P=Pontos · J=Jogos · V/E/D · GP/GC/SG.
        </p>
      </header>

      {!matches && <div className="text-muted-foreground">Carregando...</div>}

      {matches && (
        <Tabs defaultValue="mandantes">
          <TabsList>
            <TabsTrigger value="mandantes">Conferência Mandantes</TabsTrigger>
            <TabsTrigger value="visitantes">Conferência Visitantes</TabsTrigger>
          </TabsList>
          <TabsContent value="mandantes" className="mt-4">
            <ConferenceView matches={hostMatches} teams={teams} />
          </TabsContent>
          <TabsContent value="visitantes" className="mt-4">
            <ConferenceView matches={visitorMatches} teams={teams} />
          </TabsContent>
        </Tabs>
      )}
    </PublicShell>
  );
}
