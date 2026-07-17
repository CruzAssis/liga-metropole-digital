import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonMatchList } from "@/components/AppSkeletons";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { ConferenceFilter, RoundNav } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";

const TOTAL_ROUNDS = 20;
const FINISHED = ["confirmed", "wo", "finished"];


type Match = {
  id: string;
  stage: string;
  round: number;
  group_label: string | null;
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
  scheduled_at: string | null;
  venue: string | null;
  status: string;
};

type Competition = {
  id: string;
  name: string;
  conference_name: string | null;
  subprefeitura: string | null;
  zona: string | null;
  season: number | null;
  status: string;
};




export const Route = createFileRoute("/resultados")({
  component: ResultadosPage,
  head: () => ({
    meta: [
      { title: "Resultados · Liga Metrópole" },
      { name: "description", content: "Resultados dos jogos da Liga Metrópole." },
    ],
  }),
});

function ResultadosPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id, name, conference_name, subprefeitura, zona, season, status")
        .in("status", ["group_stage", "knockout", "finished"])
        .order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as Competition[];
      setCompetitions(list);
      if (list.length > 0) setSelectedComp(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedComp) return;
    setLoadingMatches(true);
    setMatches(null);
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, scheduled_at, venue, status")
        .eq("competition_id", selectedComp)
        .eq("round", selectedRound)
        .in("status", FINISHED)
        .order("group_label", { ascending: true })
        .order("scheduled_at", { ascending: false, nullsFirst: false });

      const list = (data ?? []) as Match[];
      setMatches(list);

      const ids = Array.from(new Set(list.flatMap((m) => [m.host_team_id, m.visitor_team_id])));
      if (ids.length > 0) {
        const { data: tdata } = await supabase.from("teams").select("id, name").in("id", ids);
        const map = new Map<string, string>();
        for (const t of tdata ?? []) map.set(t.id, t.name);
        setTeams(map);
      } else {
        setTeams(new Map());
      }
      setLoadingMatches(false);
    })();
  }, [selectedComp, selectedRound]);

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Últimas rodadas"
        title="Resultados"
        description="Partidas confirmadas da temporada."
      />

      <ConferenceFilter
        competitions={competitions}
        selectedId={selectedComp}
        onSelect={(id) => { setSelectedComp(id); setSelectedRound(1); }}
      />

      {selectedComp && (
        <RoundNav total={TOTAL_ROUNDS} value={selectedRound} onChange={setSelectedRound} />
      )}

      {!selectedComp && competitions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma conferência ativa. Crie uma liga no painel admin.
        </div>
      )}

      {loadingMatches && <SkeletonMatchList count={5} />}

      {!loadingMatches && matches && matches.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum resultado para a Rodada {selectedRound} ainda.
        </div>
      )}
      <div className="space-y-3">
        {matches?.map((m) => {
          const isWO = m.status === "wo";
          const hostWon = (m.host_score ?? 0) > (m.visitor_score ?? 0);
          const visitorWon = (m.visitor_score ?? 0) > (m.host_score ?? 0);
          return (
            <Link
              key={m.id}
              to="/partidas/$id"
              params={{ id: m.id }}
              className="card-hover group block rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {m.group_label && (
                    <Badge variant="outline" className="shrink-0">Lado {m.group_label}</Badge>
                  )}
                  {isWO && <Badge variant="destructive">WO</Badge>}
                </div>
                {m.scheduled_at && (
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {new Date(m.scheduled_at).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <span className={`font-semibold truncate text-right ${hostWon ? "text-foreground" : "text-muted-foreground"}`}>
                  {teams.get(m.host_team_id) ?? "—"}
                </span>
                <span className="font-display text-3xl tabular-nums px-3">
                  <span className={hostWon ? "text-foreground" : "text-muted-foreground"}>{m.host_score ?? 0}</span>
                  <span className="text-muted-foreground/40 mx-1">×</span>
                  <span className={visitorWon ? "text-foreground" : "text-muted-foreground"}>{m.visitor_score ?? 0}</span>
                </span>
                <span className={`font-semibold truncate ${visitorWon ? "text-foreground" : "text-muted-foreground"}`}>
                  {teams.get(m.visitor_team_id) ?? "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

    </PublicShell>
  );
  }
