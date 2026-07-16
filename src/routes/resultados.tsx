import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonMatchList, EmptyResultados } from "@/components/AppSkeletons";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

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

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte", sul: "Zona Sul", leste: "Zona Leste", oeste: "Zona Oeste", centro: "Centro",
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
  const navRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!navRef.current) return;
    const active = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedRound]);

  const prevRound = () => setSelectedRound((r) => Math.max(1, r - 1));
  const nextRound = () => setSelectedRound((r) => Math.min(TOTAL_ROUNDS, r + 1));

  const activeComp = competitions.find((c) => c.id === selectedComp);

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Últimas rodadas"
        title="Resultados"
        description="Partidas confirmadas da temporada."
      />


      {/* Conference filter */}
      {competitions.length > 0 && (
        <div className="mb-4 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Conferência
          </label>
          <div className="flex flex-wrap gap-2">
            {competitions.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedComp(c.id); setSelectedRound(1); }}
                className={[
                  "text-sm font-semibold px-3.5 py-2 rounded-full border transition-all",
                  selectedComp === c.id
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-6px_rgba(21,101,245,0.6)]"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                ].join(" ")}
              >
                {c.conference_name ?? c.name}{c.season ? ` ${c.season}` : ""}
              </button>
            ))}
          </div>

          {activeComp?.subprefeitura && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {activeComp.subprefeitura}
              {activeComp.zona && ` · ${ZONA_LABELS[activeComp.zona] ?? activeComp.zona}`}
            </p>
          )}
        </div>
      )}

      {/* Round navigation bar */}
      {selectedComp && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevRound} disabled={selectedRound === 1} className="shrink-0 h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div
              ref={navRef}
              className="flex-1 overflow-x-auto scrollbar-none flex gap-1.5 py-1"
            >
              {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => (
                <button
                  key={r}
                  data-active={selectedRound === r ? "true" : "false"}
                  onClick={() => setSelectedRound(r)}
                  className={[
                    "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all",
                    selectedRound === r
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_-6px_rgba(21,101,245,0.6)]"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                  ].join(" ")}
                >
                  Rod. {r}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={nextRound} disabled={selectedRound === TOTAL_ROUNDS} className="shrink-0 h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center font-medium">Rodada {selectedRound} de {TOTAL_ROUNDS}</p>
        </div>
      )}


      {!selectedComp && competitions.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma conferência ativa. Crie uma liga no painel admin.
        </div>
      )}

      {loadingMatches && <SkeletonMatchList count={5} />}

      {!loadingMatches && matches && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
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
              className="group block rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(21,101,245,0.4)] hover:-translate-y-0.5 transition-all"
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
