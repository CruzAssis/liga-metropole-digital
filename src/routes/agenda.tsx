import { createFileRoute } from "@tanstack/react-router";
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
  scheduled_at: string | null;
  venue: string | null;
  status: string;
};

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda · Liga Metrópole Várzea" },
      { name: "description", content: "Próximos jogos da Liga Metrópole Várzea." },
    ],
  }),
});

function AgendaPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, stage, round, group_label, host_team_id, visitor_team_id, scheduled_at, venue, status")
        .in("status", ["scheduled", "live"])
        .order("scheduled_at", { ascending: true, nullsFirst: false })
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
        <h1 className="font-display text-5xl tracking-wide">Agenda</h1>
        <p className="text-muted-foreground mt-1">Próximos jogos.</p>
      </header>

      {!matches && <div className="text-muted-foreground">Carregando...</div>}
      {matches && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum jogo agendado.
        </div>
      )}

      <div className="space-y-3">
        {matches?.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3 justify-between"
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                {m.stage === "group" ? `Rod. ${m.round}` : m.stage}
                {m.group_label ? ` · ${m.group_label}` : ""}
              </Badge>
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
