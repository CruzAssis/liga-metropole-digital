import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Goal, Square, Star, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getSumulaContext, fillSumula, identifyBestOpponent } from "@/lib/sumula.functions";

type Kind = "goal" | "yellow_card" | "red_card";
type EventDraft = {
  uid: string;
  team_id: string;
  athlete_id: string | null;
  kind: Kind;
  minute: string;
};

type Athlete = { id: string; full_name: string | null; nickname: string | null };

type BestVote = {
  id: string;
  voter_team_id: string;
  opponent_team_id: string;
  jersey_number: number;
  rating: number;
  note: string | null;
  opponent_athlete_id: string | null;
  identified_name: string | null;
  identified_at: string | null;
};

function newUid() {
  return Math.random().toString(36).slice(2);
}

function labelAthlete(a: Athlete) {
  return a.nickname?.trim() || a.full_name?.trim() || "(sem nome)";
}

export function SumulaDialog({
  matchId,
  open,
  onOpenChange,
  onSaved,
}: {
  matchId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const ctxFn = useServerFn(getSumulaContext);
  const fillFn = useServerFn(fillSumula);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sumula-ctx", matchId],
    queryFn: () => ctxFn({ data: { matchId } }),
    enabled: open,
  });

  const [hostScore, setHostScore] = useState("0");
  const [visitorScore, setVisitorScore] = useState("0");
  const [events, setEvents] = useState<EventDraft[]>([]);
  const [bestJersey, setBestJersey] = useState("");
  const [bestRating, setBestRating] = useState("");
  const [bestNote, setBestNote] = useState("");

  useEffect(() => {
    if (!data) return;
    setHostScore(String(data.match.host_score ?? 0));
    setVisitorScore(String(data.match.visitor_score ?? 0));
    setEvents(
      (data.events ?? []).map((e) => ({
        uid: e.id,
        team_id: e.team_id,
        athlete_id: e.athlete_id,
        kind: e.kind as Kind,
        minute: e.minute == null ? "" : String(e.minute),
      })),
    );
    const myVote = (data.bestVotes as BestVote[] | undefined)?.find(
      (v) => v.voter_team_id === data.host?.id,
    );
    if (myVote) {
      setBestJersey(String(myVote.jersey_number));
      setBestRating(String(myVote.rating));
      setBestNote(myVote.note ?? "");
    } else {
      setBestJersey("");
      setBestRating("");
      setBestNote("");
    }
  }, [data]);

  const hostId = data?.host?.id;
  const visitorId = data?.visitor?.id;
  const validEvents = events.filter((e) => e.team_id && e.athlete_id);
  const hostGoals = validEvents.filter((e) => e.kind === "goal" && e.team_id === hostId).length;
  const visitorGoals = validEvents.filter((e) => e.kind === "goal" && e.team_id === visitorId).length;
  const hScoreNum = parseInt(hostScore, 10);
  const vScoreNum = parseInt(visitorScore, 10);
  const scoreValid = !Number.isNaN(hScoreNum) && !Number.isNaN(vScoreNum) && hScoreNum >= 0 && vScoreNum >= 0;
  const goalsMatch = hostGoals === hScoreNum && visitorGoals === vScoreNum;
  const hasIncompleteEvent = events.some((e) => !e.athlete_id);

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

  const mut = useMutation({
    mutationFn: async () => {
      if (!scoreValid) throw new Error("Placar inválido");
      if (hasIncompleteEvent) throw new Error("Selecione o atleta em todos os eventos lançados");
      if (!goalsMatch) {
        throw new Error(
          `Gols lançados (${hostGoals}×${visitorGoals}) não batem com o placar (${hScoreNum}×${vScoreNum})`,
        );
      }
      if (bestPartial) {
        throw new Error("Preencha o número da camisa e a nota do melhor jogador adversário, ou deixe ambos em branco");
      }
      return fillFn({
        data: {
          matchId,
          hostScore: hScoreNum,
          visitorScore: vScoreNum,
          events: validEvents.map((e) => ({
            team_id: e.team_id,
            athlete_id: e.athlete_id,
            kind: e.kind,
            minute: e.minute === "" ? null : parseInt(e.minute, 10),
          })),
          bestOpponent: bestComplete
            ? {
                jersey_number: bestJerseyNum!,
                rating: bestRatingNum!,
                note: bestNote.trim() || null,
              }
            : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Súmula enviada. Aguardando confirmação do visitante.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
      qc.invalidateQueries({ queryKey: ["sumula-ctx", matchId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addEvent = (teamId: string, kind: Kind) => {
    setEvents((cur) => [...cur, { uid: newUid(), team_id: teamId, athlete_id: "", kind, minute: "" }]);
  };
  const removeEvent = (uid: string) => setEvents((cur) => cur.filter((e) => e.uid !== uid));
  const patchEvent = (uid: string, patch: Partial<EventDraft>) =>
    setEvents((cur) => cur.map((e) => (e.uid === uid ? { ...e, ...patch } : e)));

  const canEdit = !!data?.isHostManager && ["scheduled", "awaiting_confirmation"].includes(data?.match.status ?? "");

  // Votos recebidos pelo time do usuário (visitante votou no mandante quando isHostManager,
  // ou mandante votou no visitante quando isVisitorManager)
  const myTeamId = data?.isHostManager ? data?.host?.id : data?.isVisitorManager ? data?.visitor?.id : null;
  const myAthletes = data?.isHostManager ? data?.hostAthletes : data?.visitorAthletes;
  const receivedVotes = useMemo(
    () => ((data?.bestVotes ?? []) as BestVote[]).filter((v) => v.opponent_team_id === myTeamId),
    [data?.bestVotes, myTeamId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">
            {canEdit ? "Lançar súmula" : "Súmula do jogo"}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <ScoreBlock
                teamName={data.host?.name ?? "Mandante"}
                value={hostScore}
                onChange={setHostScore}
                disabled={!canEdit}
              />
              <ScoreBlock
                teamName={data.visitor?.name ?? "Visitante"}
                value={visitorScore}
                onChange={setVisitorScore}
                disabled={!canEdit}
              />
            </div>

            {data.host && (
              <TeamEventsBlock
                teamName={data.host.short_name}
                teamId={data.host.id}
                athletes={data.hostAthletes}
                events={events.filter((e) => e.team_id === data.host!.id)}
                canEdit={canEdit}
                onAdd={(kind) => addEvent(data.host!.id, kind)}
                onRemove={removeEvent}
                onPatch={patchEvent}
              />
            )}

            {data.visitor && (
              <TeamEventsBlock
                teamName={data.visitor.short_name}
                teamId={data.visitor.id}
                athletes={data.visitorAthletes}
                events={events.filter((e) => e.team_id === data.visitor!.id)}
                canEdit={canEdit}
                onAdd={(kind) => addEvent(data.visitor!.id, kind)}
                onRemove={removeEvent}
                onPatch={patchEvent}
              />
            )}

            {/* Melhor jogador adversário — mandante vota no visitante */}
            {data.visitor && (
              <BestOpponentBlock
                opponentName={data.visitor.short_name}
                jersey={bestJersey}
                rating={bestRating}
                note={bestNote}
                onJersey={setBestJersey}
                onRating={setBestRating}
                onNote={setBestNote}
                canEdit={canEdit}
              />
            )}

            {/* Indicações recebidas (do adversário) */}
            {receivedVotes.length > 0 && myTeamId && (
              <ReceivedVotesBlock
                matchId={matchId}
                votes={receivedVotes}
                athletes={myAthletes ?? []}
              />
            )}

            {canEdit && scoreValid && !goalsMatch && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Gols lançados ({hostGoals}×{visitorGoals}) não batem com o placar ({hScoreNum}×{vScoreNum}).
                Ajuste o placar ou os eventos de gol antes de enviar.
              </div>
            )}
            {canEdit && hasIncompleteEvent && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Há eventos sem atleta selecionado.
              </div>
            )}
            {canEdit && bestPartial && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Preencha número da camisa e nota do melhor jogador adversário, ou deixe ambos em branco.
              </div>
            )}

            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                Apenas o mandante pode editar a súmula. Status atual: {data.match.status}.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canEdit && (
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !scoreValid || !goalsMatch || hasIncompleteEvent || bestPartial}
            >
              {mut.isPending ? "Enviando..." : "Enviar súmula"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBlock({
  teamName,
  value,
  onChange,
  disabled,
}: {
  teamName: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{teamName}</Label>
      <Input
        type="number"
        min={0}
        max={50}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="text-center font-mono text-2xl h-14"
      />
    </div>
  );
}

function TeamEventsBlock({
  teamName,
  teamId,
  athletes,
  events,
  canEdit,
  onAdd,
  onRemove,
  onPatch,
}: {
  teamName: string;
  teamId: string;
  athletes: Athlete[];
  events: EventDraft[];
  canEdit: boolean;
  onAdd: (kind: Kind) => void;
  onRemove: (uid: string) => void;
  onPatch: (uid: string, patch: Partial<EventDraft>) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="font-display text-lg">{teamName}</div>
        {canEdit && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onAdd("goal")} className="gap-1 h-7 text-xs">
              <Goal className="h-3 w-3" /> Gol
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAdd("yellow_card")} className="gap-1 h-7 text-xs">
              <Square className="h-3 w-3 fill-yellow-400 text-yellow-400" /> Amarelo
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAdd("red_card")} className="gap-1 h-7 text-xs">
              <Square className="h-3 w-3 fill-destructive text-destructive" /> Vermelho
            </Button>
          </div>
        )}
      </div>

      {events.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum evento lançado.</p>
      )}

      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.uid} className="flex items-center gap-2">
            <KindBadge kind={ev.kind} />
            <Select
              value={ev.athlete_id || undefined}
              onValueChange={(v) => onPatch(ev.uid, { athlete_id: v })}
              disabled={!canEdit}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Selecione o atleta" />
              </SelectTrigger>
              <SelectContent>
                {athletes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {labelAthlete(a)}
                  </SelectItem>
                ))}
                {athletes.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Sem atletas cadastrados
                  </div>
                )}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              max={200}
              placeholder="min"
              value={ev.minute}
              onChange={(e) => onPatch(ev.uid, { minute: e.target.value })}
              disabled={!canEdit}
              className="w-16 h-9 text-center font-mono"
            />
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemove(ev.uid)}
                className="h-9 w-9 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <input type="hidden" value={teamId} readOnly />
          </div>
        ))}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: Kind }) {
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

export function BestOpponentBlock({
  opponentName,
  jersey,
  rating,
  note,
  onJersey,
  onRating,
  onNote,
  canEdit,
}: {
  opponentName: string;
  jersey: string;
  rating: string;
  note: string;
  onJersey: (v: string) => void;
  onRating: (v: string) => void;
  onNote: (v: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-primary" />
        <div className="font-display text-base">
          Melhor jogador adversário <span className="text-muted-foreground text-sm">({opponentName})</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Indique pelo número da camisa. O diretor adversário vai identificar o nome do atleta depois.
        Deixe em branco se não quiser indicar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nº da camisa</Label>
          <Input
            type="number"
            min={0}
            max={999}
            value={jersey}
            onChange={(e) => onJersey(e.target.value)}
            disabled={!canEdit}
            placeholder="ex: 10"
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">Nota (0 a 10)</Label>
          <Input
            type="number"
            step="0.5"
            min={0}
            max={10}
            value={rating}
            onChange={(e) => onRating(e.target.value)}
            disabled={!canEdit}
            placeholder="ex: 8.5"
            className="font-mono"
          />
        </div>
      </div>
      <div className="mt-2">
        <Label className="text-xs">Comentário (opcional)</Label>
        <Input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          disabled={!canEdit}
          placeholder="ex: ditou o ritmo do meio campo"
          maxLength={280}
        />
      </div>
    </div>
  );
}

function ReceivedVotesBlock({
  matchId,
  votes,
  athletes,
}: {
  matchId: string;
  votes: BestVote[];
  athletes: Athlete[];
}) {
  const identifyFn = useServerFn(identifyBestOpponent);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (input: { voteId: string; athleteId: string | null; name: string | null }) =>
      identifyFn({ data: input }),
    onSuccess: () => {
      toast.success("Jogador identificado.");
      qc.invalidateQueries({ queryKey: ["sumula-ctx", matchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <UserCheck className="h-4 w-4 text-primary" />
        <div className="font-display text-base">Indicações do adversário ao seu time</div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        O adversário indicou seu(s) melhor(es) jogador(es) por número de camisa. Identifique quem é.
      </p>
      <div className="space-y-3">
        {votes.map((v) => (
          <ReceivedVoteRow key={v.id} vote={v} athletes={athletes} onSubmit={(payload) => mut.mutate(payload)} />
        ))}
      </div>
    </div>
  );
}

function ReceivedVoteRow({
  vote,
  athletes,
  onSubmit,
}: {
  vote: BestVote;
  athletes: Athlete[];
  onSubmit: (payload: { voteId: string; athleteId: string | null; name: string | null }) => void;
}) {
  const [athleteId, setAthleteId] = useState<string>(vote.opponent_athlete_id ?? "");
  const [name, setName] = useState<string>(vote.identified_name ?? "");

  return (
    <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">#{vote.jersey_number}</Badge>
          <Badge className="gap-1">
            <Star className="h-3 w-3" /> {Number(vote.rating).toFixed(1)}
          </Badge>
          {vote.identified_at && <Badge variant="secondary">Identificado</Badge>}
        </div>
      </div>
      {vote.note && <p className="text-xs text-muted-foreground">"{vote.note}"</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Atleta do elenco</Label>
          <Select value={athleteId || undefined} onValueChange={setAthleteId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {labelAthlete(a)}
                </SelectItem>
              ))}
              {athletes.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">Sem atletas</div>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ou digite o nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do jogador" maxLength={120} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            onSubmit({
              voteId: vote.id,
              athleteId: athleteId || null,
              name: name.trim() || null,
            })
          }
          disabled={!athleteId && !name.trim()}
        >
          Salvar identificação
        </Button>
      </div>
    </div>
  );
}
