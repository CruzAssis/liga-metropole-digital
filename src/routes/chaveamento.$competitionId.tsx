import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCompetitionBracket } from "@/lib/calendario.functions";

export const Route = createFileRoute("/chaveamento/$competitionId")({
  component: BracketPublic,
  head: () => ({
    meta: [
      { title: "Chaveamento • Liga Metrópole" },
      { name: "description", content: "Acompanhe o mata-mata da conferência." },
    ],
  }),
});

function BracketPublic() {
  const { competitionId } = Route.useParams();
  const fn = useServerFn(getCompetitionBracket);
  const { data: bracket, isLoading } = useQuery({
    queryKey: ["public-bracket", competitionId],
    queryFn: () => fn({ data: { competitionId } }),
  });

  const stages = ["oitavas", "quartas", "semi", "final"] as const;
  const active = stages.filter((s) => (bracket?.[s]?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Mata-Mata</h1>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando chaveamento…</p>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            O chaveamento desta competição ainda não foi divulgado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-4">
          {active.map((stage) => (
            <Card key={stage}>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  {stage === "semi" ? "Semifinal" : stage.charAt(0).toUpperCase() + stage.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(bracket?.[stage] ?? []).map((m: any) => (
                  <div key={m.id} className="rounded-lg border border-border/60 bg-card p-3">
                    <MatchRow team={m.host} score={m.host_score} />
                    <div className="my-2 border-t border-border/50" />
                    <MatchRow team={m.visitor} score={m.visitor_score} />
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("pt-BR") : "A definir"}</span>
                      <Badge variant="secondary">
                        {m.status === "confirmed" || m.status === "closed" ? "Encerrado" : "Agendado"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ team, score }: { team: any; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {team?.logo_url ? (
          <img src={team.logo_url} alt="" className="h-6 w-6 rounded" />
        ) : (
          <div className="h-6 w-6 rounded bg-muted" />
        )}
        <span className="truncate text-sm font-medium">
          {team?.short_name ?? team?.name ?? "A definir"}
        </span>
      </div>
      <span className="font-mono text-base font-semibold tabular-nums">{score ?? "—"}</span>
    </div>
  );
}
