import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type Standing = {
  team_id: string;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const FINISHED = ["confirmed", "wo_host", "wo_visitor"];

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({
    meta: [
      { title: "Ranking · Liga Metrópole Várzea" },
      { name: "description", content: "Classificação dos times da Liga Metrópole Várzea." },
    ],
  }),
});

function computeStandings(matches: Match[], teamNames: Map<string, string>): Standing[] {
  const t = new Map<string, Standing>();
  const ensure = (id: string) => {
    if (!t.has(id)) {
      t.set(id, {
        team_id: id,
        team_name: teamNames.get(id) ?? "—",
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
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
}

function StandingsTable({ rows }: { rows: Standing[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Sem partidas confirmadas neste grupo.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left p-3">#</th>
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
              <td className="p-3 text-muted-foreground">{i + 1}</td>
              <td className="p-3 font-medium">{r.team_name}</td>
              <td className="text-center p-2 font-bold text-primary">{r.points}</td>
              <td className="text-center p-2">{r.played}</td>
              <td className="text-center p-2">{r.wins}</td>
              <td className="text-center p-2">{r.draws}</td>
              <td className="text-center p-2">{r.losses}</td>
              <td className="text-center p-2">{r.gf}</td>
              <td className="text-center p-2">{r.ga}</td>
              <td className="text-center p-2">{r.gd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [teamRoles, setTeamRoles] = useState<Map<string, string>>(new Map());

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
        const [{ data: tdata }, { data: regs }] = await Promise.all([
          supabase.from("teams").select("id, name, registration_type").in("id", ids),
          Promise.resolve({ data: [] }),
        ]);
        const nameMap = new Map<string, string>();
        const roleMap = new Map<string, string>();
        for (const t of tdata ?? []) {
          nameMap.set(t.id, t.name);
          roleMap.set(t.id, t.registration_type);
        }
        setTeams(nameMap);
        setTeamRoles(roleMap);
        void regs;
      }
    })();
  }, []);

  const hostMatches = matches?.filter((m) => teamRoles.get(m.host_team_id) === "host") ?? [];
  const visitorMatches = matches?.filter((m) => teamRoles.get(m.host_team_id) === "visitor") ?? [];

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Ranking</h1>
        <p className="text-muted-foreground mt-1">
          Classificação por pontos · fase de grupos.
        </p>
      </header>

      {!matches && <div className="text-muted-foreground">Carregando...</div>}

      {matches && (
        <Tabs defaultValue="mandantes">
          <TabsList>
            <TabsTrigger value="mandantes">Mandantes</TabsTrigger>
            <TabsTrigger value="visitantes">Visitantes</TabsTrigger>
          </TabsList>
          <TabsContent value="mandantes" className="mt-4">
            <StandingsTable rows={computeStandings(hostMatches, teams)} />
          </TabsContent>
          <TabsContent value="visitantes" className="mt-4">
            <StandingsTable rows={computeStandings(visitorMatches, teams)} />
          </TabsContent>
        </Tabs>
      )}
    </PublicShell>
  );
}
