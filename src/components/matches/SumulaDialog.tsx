import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Goal, Square } from "lucide-react";
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
import { getSumulaContext, fillSumula } from "@/lib/sumula.functions";

type Kind = "goal" | "yellow_card" | "red_card";
type EventDraft = {
  uid: string;
  team_id: string;
  athlete_id: string;
  kind: Kind;
  minute: string;
};

type Athlete = { id: string; full_name: string | null; nickname: string | null };

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
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      const h = parseInt(hostScore, 10);
      const v = parseInt(visitorScore, 10);
      if (Number.isNaN(h) || Number.isNaN(v) || h < 0 || v < 0) {
        throw new Error("Placar inválido");
      }
      return fillFn({
        data: {
          matchId,
          hostScore: h,
          visitorScore: v,
          events: events
            .filter((e) => e.team_id && e.athlete_id)
            .map((e) => ({
              team_id: e.team_id,
              athlete_id: e.athlete_id,
              kind: e.kind,
              minute: e.minute === "" ? null : parseInt(e.minute, 10),
            })),
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
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
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
            {/* hidden — só para suprimir warning de teamId não usado */}
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
