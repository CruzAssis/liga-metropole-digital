import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Goal, Square, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSumulaContext, confirmSumula, disputeSumula } from "@/lib/sumula.functions";
import { BestOpponentBlock } from "./SumulaDialog";

type BestVote = {
  voter_team_id: string;
  jersey_number: number;
  rating: number;
  note: string | null;
};

export function ConfirmSumulaDialog({
  matchId,
  open,
  onOpenChange,
}: {
  matchId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const ctxFn = useServerFn(getSumulaContext);
  const confirmFn = useServerFn(confirmSumula);
  const disputeFn = useServerFn(disputeSumula);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sumula-ctx", matchId],
    queryFn: () => ctxFn({ data: { matchId } }),
    enabled: open,
  });

  const [bestJersey, setBestJersey] = useState("");
  const [bestRating, setBestRating] = useState("");
  const [bestNote, setBestNote] = useState("");

  useEffect(() => {
    if (!data) return;
    const visitorId = data.visitor?.id;
    const myVote = (data.bestVotes as BestVote[] | undefined)?.find((v) => v.voter_team_id === visitorId);
    if (myVote) {
      setBestJersey(String(myVote.jersey_number));
      setBestRating(String(myVote.rating));
      setBestNote(myVote.note ?? "");
    }
  }, [data]);

  const bestJerseyNum = bestJersey === "" ? null : parseInt(bestJersey, 10);
  const bestRatingNum = bestRating === "" ? null : Number(bestRating);
  const bestPartial =
    (bestJersey !== "" || bestRating !== "") &&
    !(bestJerseyNum !== null && !Number.isNaN(bestJerseyNum) && bestRatingNum !== null && !Number.isNaN(bestRatingNum));
  const bestComplete =
    bestJerseyNum !== null &&
    !Number.isNaN(bestJerseyNum) &&
    bestJerseyNum >= 0 &&
    bestJerseyNum <= 999 &&
    bestRatingNum !== null &&
    !Number.isNaN(bestRatingNum) &&
    bestRatingNum >= 0 &&
    bestRatingNum <= 10;

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (bestPartial) throw new Error("Preencha número da camisa e nota, ou deixe ambos em branco");
      return confirmFn({
        data: {
          matchId,
          bestOpponent: bestComplete
            ? { jersey_number: bestJerseyNum!, rating: bestRatingNum!, note: bestNote.trim() || null }
            : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Súmula confirmada.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
      qc.invalidateQueries({ queryKey: ["sumula-ctx", matchId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputeMut = useMutation({
    mutationFn: async () => disputeFn({ data: { matchId } }),
    onSuccess: () => {
      toast.success("Contestação enviada à organização.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isVisitorMgr = !!data?.isVisitorManager;
  const canAct = isVisitorMgr && data?.match.status === "awaiting_confirmation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">Confirmar súmula</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-5">
            {/* Resumo */}
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="text-center flex-1 min-w-0">
                <div className="font-display text-lg truncate">{data.host?.name}</div>
              </div>
              <div className="font-mono font-bold text-3xl tabular-nums">
                {data.match.host_score ?? "–"} × {data.match.visitor_score ?? "–"}
              </div>
              <div className="text-center flex-1 min-w-0">
                <div className="font-display text-lg truncate">{data.visitor?.name}</div>
              </div>
            </div>

            {/* Eventos (read-only) */}
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="font-display text-base mb-2">Eventos lançados pelo mandante</div>
              {(data.events ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento lançado.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.events.map((e) => {
                    const team =
                      e.team_id === data.host?.id ? data.host?.short_name : data.visitor?.short_name;
                    const ath = [...data.hostAthletes, ...data.visitorAthletes].find(
                      (a) => a.id === e.athlete_id,
                    );
                    const athName = ath?.nickname || ath?.full_name || "—";
                    return (
                      <li key={e.id} className="flex items-center gap-2">
                        <KindBadge kind={e.kind as "goal" | "yellow_card" | "red_card"} />
                        <span className="font-medium">{athName}</span>
                        <span className="text-muted-foreground text-xs">· {team}</span>
                        {e.minute != null && (
                          <span className="ml-auto font-mono text-xs text-muted-foreground">{e.minute}'</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Voto do visitante: melhor jogador do mandante */}
            {data.host && (
              <BestOpponentBlock
                opponentName={data.host.short_name}
                jersey={bestJersey}
                rating={bestRating}
                note={bestNote}
                onJersey={setBestJersey}
                onRating={setBestRating}
                onNote={setBestNote}
                canEdit={canAct}
              />
            )}

            {canAct && bestPartial && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Preencha número da camisa e nota, ou deixe ambos em branco.
              </div>
            )}

            {!canAct && (
              <p className="text-xs text-muted-foreground">
                Status atual: {data.match.status}. Apenas o visitante pode confirmar uma súmula aguardando confirmação.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canAct && (
            <>
              <Button
                variant="destructive"
                onClick={() => disputeMut.mutate()}
                disabled={disputeMut.isPending || confirmMut.isPending}
                className="gap-1"
              >
                <AlertTriangle className="h-4 w-4" /> Contestar
              </Button>
              <Button
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending || disputeMut.isPending || bestPartial}
                className="gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmMut.isPending ? "Confirmando..." : "Confirmar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KindBadge({ kind }: { kind: "goal" | "yellow_card" | "red_card" }) {
  if (kind === "goal") {
    return (
      <Badge variant="outline" className="gap-1 shrink-0">
        <Goal className="h-3 w-3" /> Gol
      </Badge>
    );
  }
  if (kind === "yellow_card") {
    return (
      <Badge variant="outline" className="gap-1 shrink-0">
        <Square className="h-3 w-3 fill-yellow-400 text-yellow-400" /> CA
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 shrink-0">
      <Square className="h-3 w-3 fill-destructive text-destructive" /> CV
    </Badge>
  );
}

// Suprime warning de import não usado
void Star;
