import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Shuffle, Trophy, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  adminListCompetitions,
  generateRoundRobin,
  generateBracket,
  getCompetitionStandings,
  getCompetitionBracket,
} from "@/lib/calendario.functions";

export const Route = createFileRoute("/_authenticated/admin/calendario")({
  component: CalendarioAdmin,
  head: () => ({ meta: [{ title: "Calendário & Chaveamento • Admin" }] }),
});

function CalendarioAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCompetitions);
  const standingsFn = useServerFn(getCompetitionStandings);
  const bracketFn = useServerFn(getCompetitionBracket);
  const genRR = useServerFn(generateRoundRobin);
  const genBR = useServerFn(generateBracket);

  const { data: competitions = [] } = useQuery({ queryKey: ["admin-competitions"], queryFn: () => listFn() });
  const [competitionId, setCompetitionId] = useState<string>("");
  const [doubleRound, setDoubleRound] = useState(true);
  const [replace, setReplace] = useState(false);
  const [size, setSize] = useState<4 | 8 | 16>(8);

  const { data: standings = [], isLoading: loadingStand } = useQuery({
    queryKey: ["standings", competitionId],
    queryFn: () => standingsFn({ data: { competitionId } }),
    enabled: !!competitionId,
  });
  const { data: bracket, isLoading: loadingBr } = useQuery({
    queryKey: ["bracket", competitionId],
    queryFn: () => bracketFn({ data: { competitionId } }),
    enabled: !!competitionId,
  });

  const rrMut = useMutation({
    mutationFn: () => genRR({ data: { competitionId, doubleRound, replace } }),
    onSuccess: (r: any) => {
      toast.success(`Turno gerado: ${r.matches} partidas em ${r.groups} grupo(s).`);
      qc.invalidateQueries({ queryKey: ["standings", competitionId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar rodadas."),
  });
  const brMut = useMutation({
    mutationFn: () => genBR({ data: { competitionId, size, replace } }),
    onSuccess: () => {
      toast.success("Chaveamento gerado.");
      qc.invalidateQueries({ queryKey: ["bracket", competitionId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar chaveamento."),
  });

  const stages = ["oitavas", "quartas", "semi", "final"] as const;
  const activeStages = useMemo(() => stages.filter((s) => (bracket?.[s]?.length ?? 0) > 0), [bracket]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Calendário & Chaveamento</h1>
        <p className="text-sm text-muted-foreground">
          Gere pontos corridos e o mata-mata final por competição.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Competição</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={competitionId} onValueChange={setCompetitionId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma competição" /></SelectTrigger>
            <SelectContent>
              {competitions.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} • {c.subprefeitura ?? "—"} {c.season ? `• ${c.season}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3">
            <Switch id="replace" checked={replace} onCheckedChange={setReplace} />
            <Label htmlFor="replace">Substituir partidas existentes ao regenerar</Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Shuffle className="h-4 w-4" /> Fase de Grupos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch id="dbl" checked={doubleRound} onCheckedChange={setDoubleRound} />
              <Label htmlFor="dbl">Turno e returno (ida e volta)</Label>
            </div>
            <Button disabled={!competitionId || rrMut.isPending} onClick={() => rrMut.mutate()}>
              {rrMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Gerar rodadas
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Mata-Mata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Classificados:</Label>
              <Select value={String(size)} onValueChange={(v) => setSize(Number(v) as 4 | 8 | 16)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!competitionId || brMut.isPending} onClick={() => brMut.mutate()}>
              {brMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
              Gerar chaveamento
            </Button>
            <p className="text-xs text-muted-foreground">Seed pelos pontos corridos (pts / SG / GP).</p>
          </CardContent>
        </Card>
      </div>

      {competitionId && (
        <Card>
          <CardHeader><CardTitle>Classificação atual</CardTitle></CardHeader>
          <CardContent>
            {loadingStand ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum time aprovado ou partida concluída ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Grupo</th>
                      <th className="p-2 text-right">P</th>
                      <th className="p-2 text-right">J</th>
                      <th className="p-2 text-right">V</th>
                      <th className="p-2 text-right">E</th>
                      <th className="p-2 text-right">D</th>
                      <th className="p-2 text-right">GP</th>
                      <th className="p-2 text-right">GC</th>
                      <th className="p-2 text-right">SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s: any, i: number) => (
                      <tr key={s.team.id} className="border-t border-border/60">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-medium">{s.team.name}</td>
                        <td className="p-2">{s.group_label ?? "—"}</td>
                        <td className="p-2 text-right font-semibold">{s.points}</td>
                        <td className="p-2 text-right">{s.played}</td>
                        <td className="p-2 text-right">{s.wins}</td>
                        <td className="p-2 text-right">{s.draws}</td>
                        <td className="p-2 text-right">{s.losses}</td>
                        <td className="p-2 text-right">{s.gf}</td>
                        <td className="p-2 text-right">{s.ga}</td>
                        <td className="p-2 text-right">{s.gd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {competitionId && (
        <Card>
          <CardHeader><CardTitle>Chaveamento</CardTitle></CardHeader>
          <CardContent>
            {loadingBr ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : activeStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chaveamento gerado ainda.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                {activeStages.map((stage) => (
                  <div key={stage} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage}</h3>
                    {(bracket?.[stage] ?? []).map((m: any) => (
                      <div key={m.id} className="rounded-md border border-border/60 bg-card p-2 text-sm">
                        <BracketRow team={m.host} score={m.host_score} />
                        <div className="my-1 border-t border-border/50" />
                        <BracketRow team={m.visitor} score={m.visitor_score} />
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {m.status === "confirmed" ? "Encerrado" : "A definir"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BracketRow({ team, score }: { team: any; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">{team?.short_name ?? team?.name ?? "A definir"}</span>
      <span className="font-mono text-sm">{score ?? "—"}</span>
    </div>
  );
}
