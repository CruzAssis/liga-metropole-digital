import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TOTAL_ROUNDS = 20;

type Match = {
  id: string;
  stage: string;
  round: number;
  group_label: string | null;
  host_team_id: string;
  visitor_team_id: string;
  scheduled_at: string | null;
  venue: string | null;
  status: string;
};

type Competition = {
  id: string;
  name: string;
  season: string | null;
  status: string;
};

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda · Liga Metropole Varzea" },
      { name: "description", content: "Proximos jogos da Liga Metropole Varzea." },
    ],
  }),
});

function AgendaPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [loadingMatches, setLoadingMatches] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Load active competitions
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id, name, season, status")
        .in("status", ["group_stage", "knockout", "finished"])
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Competition[];
      setCompetitions(list);
      if (list.length > 0) setSelectedComp(list[0].id);
    })();
  }, []);

  // Load matches for selected competition + round
  useEffect(() => {
    if (!selectedComp) return;
    setLoadingMatches(true);
    setMatches(null);
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, stage, round, group_label, host_team_id, visitor_team_id, scheduled_at, venue, status")
        .eq("competition_id", selectedComp)
        .eq("round", selectedRound)
        .in("status", ["scheduled", "live"])
        .order("group_label", { ascending: true })
        .order("scheduled_at", { ascending: true, nullsFirst: false });

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

  // Scroll active round button into view
  useEffect(() => {
    if (!navRef.current) return;
    const active = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedRound]);

  const prevRound = () => setSelectedRound((r) => Math.max(1, r - 1));
  const nextRound = () => setSelectedRound((r) => Math.min(TOTAL_ROUNDS, r + 1));

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Agenda</h1>
        <p className="text-muted-foreground mt-1">Proximos jogos.</p>
      </header>

      {/* Competition selector */}
      {competitions.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedComp(c.id); setSelectedRound(1); }}
              className={[
                "text-sm px-3 py-1.5 rounded-md border transition-colors",
                selectedComp === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {c.name}{c.season ? ` ${c.season}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Round navigation bar */}
      {selectedComp && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevRound} disabled={selectedRound === 1} className="shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div
              ref={navRef}
              className="flex-1 overflow-x-auto scrollbar-none flex gap-1 py-1"
              style={{ scrollbarWidth: "none" }}
            >
              {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => (
                <button
                  key={r}
                  data-active={selectedRound === r ? "true" : "false"}
                  onClick={() => setSelectedRound(r)}
                  className={[
                    "shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    selectedRound === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  ].join(" ")}
                >
                  Rod. {r}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={nextRound} disabled={selectedRound === TOTAL_ROUNDS} className="shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-center">Rodada {selectedRound} de {TOTAL_ROUNDS}</p>
        </div>
      )}

      {/* No active competition */}
      {!selectedComp && competitions.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma competicao em andamento.
        </div>
      )}

      {/* Loading */}
      {loadingMatches && <div className="text-muted-foreground">Carregando...</div>}

      {/* Empty state */}
      {!loadingMatches && matches && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum jogo agendado para a Rodada {selectedRound}.
        </div>
      )}

      {/* Match list */}
      <div className="space-y-3">
        {matches?.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3 justify-between"
          >
            <div className="flex items-center gap-3">
              {m.group_label && (
                <Badge variant="outline" className="shrink-0">Lado {m.group_label}</Badge>
              )}
              <span className="font-medium">{teams.get(m.host_team_id) ?? "—"}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{teams.get(m.visitor_team_id) ?? "—"}</span>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-3">
              {m.scheduled_at && (
                <span>
                  {new Date(m.scheduled_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {m.venue && <span>· {m.venue}</span>}
              {m.status === "live" && <Badge variant="destructive">AO VIVO</Badge>}
            </div>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}
