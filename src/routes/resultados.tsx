import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Badge } from "@/components/ui/badge";

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

const FINISHED = ["confirmed", "wo"];

export const Route = createFileRoute("/resultados")({
  component: ResultadosPage,
  head: () => ({
    meta: [
      { title: "Resultados · Liga Metrópole Várzea" },
      { name: "description", content: "Resultados dos jogos da Liga Metrópole Várzea." },
    ],
  }),
});

function ResultadosPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, scheduled_at, venue, status")
        .in("status", FINISHED)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .limit(100);

      const list = (data ?? []) as Match[];
      setMatches(list);

      const ids = Array.from(new Set(list.flatMap((m) => [m.host_team_id, m.visitor_team_id])));
      if (ids.length > 0) {
        const { data: tdata } = await supabase.from("teams").select("id, name").in("id", ids);
        const map = new Map<string, string>();
        for (const t of tdata ?? []) map.set(t.id, t.name);
        setTeams(map);
      }
    })();
  }, []);

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Resultados</h1>
        <p className="text-muted-foreground mt-1">Partidas confirmadas.</p>
      </header>

      {!matches && <div className="text-muted-foreground">Carregando...</div>}
      {matches && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum resultado ainda.
        </div>
      )}

      <div className="space-y-3">
        {matches?.map((m) => {
          const isWO = m.status === "wo";
          return (
            <div
              key={m.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline">
                  {m.stage === "group" ? `Rod. ${m.round}` : m.stage}
                  {m.group_label ? ` · ${m.group_label}` : ""}
                </Badge>
                <span className="font-medium">{teams.get(m.host_team_id) ?? "—"}</span>
                <span className="font-display text-2xl">
                  {m.host_score ?? 0} <span className="text-muted-foreground">x</span> {m.visitor_score ?? 0}
                </span>
                <span className="font-medium">{teams.get(m.visitor_team_id) ?? "—"}</span>
                {isWO && <Badge variant="destructive">WO</Badge>}
              </div>
              {m.scheduled_at && (
                <span className="text-sm text-muted-foreground">
                  {new Date(m.scheduled_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </PublicShell>
  );
}
