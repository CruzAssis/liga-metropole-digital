import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTeamMatches,
  confirmSumula,
  disputeSumula,
} from "@/lib/sumula.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Flag,
  MessageCircle,
  ClipboardEdit,
  Eye,
} from "lucide-react";
import { buildWhatsAppLink } from "@/lib/wa";
import { SumulaDialog } from "./SumulaDialog";

const HOURS_TO_CONFIRM = 48;

type Match = {
  id: string;
  stage: string;
  round: number;
  group_label: string | null;
  host_score: number | null;
  visitor_score: number | null;
  status: string;
  scheduled_at: string | null;
  venue: string | null;
  host_filled_at: string | null;
  visitor_confirmed_at: string | null;
  host: { name: string; short_name: string; slug: string | null; logo_url: string | null; manager_name: string | null; manager_phone: string | null } | null;
  visitor: { name: string; short_name: string; slug: string | null; logo_url: string | null; manager_name: string | null; manager_phone: string | null } | null;
  is_host: boolean;
};

const statusMeta: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "outline" },
  awaiting_confirmation: { label: "Aguardando confirmação", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  disputed: { label: "Contestado", variant: "destructive" },
  wo: { label: "WO", variant: "destructive" },
  live: { label: "Ao vivo", variant: "destructive" },
};

export function TeamMatchesSection() {
  const list = useServerFn(listMyTeamMatches);
  const { data, isLoading } = useQuery({
    queryKey: ["my-team-matches"],
    queryFn: () => list(),
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando jogos...</div>;
  }

  const matches = (data?.matches ?? []) as Match[];
  const pending = matches.filter((m) =>
    ["scheduled", "awaiting_confirmation", "disputed"].includes(m.status),
  );
  const done = matches.filter((m) => ["confirmed", "wo"].includes(m.status));

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">Súmulas</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Mandante preenche o placar. Visitante confirma em até {HOURS_TO_CONFIRM}h.
        </p>

        <div className="mt-4 space-y-3">
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum jogo cadastrado ainda. Aguarde o sorteio.
            </p>
          )}
          {pending.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </div>

      {done.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-display text-xl tracking-wide mb-3">Histórico</h3>
          <ul className="divide-y divide-border">
            {done.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{m.host?.short_name}</span>
                  <span className="font-mono">
                    {m.host_score}×{m.visitor_score}
                  </span>
                  <span className="font-medium truncate">{m.visitor?.short_name}</span>
                </div>
                <Badge variant={statusMeta[m.status]?.variant ?? "outline"}>
                  {statusMeta[m.status]?.label ?? m.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const qc = useQueryClient();
  const fill = useServerFn(fillSumula);
  const confirm = useServerFn(confirmSumula);
  const dispute = useServerFn(disputeSumula);

  const meta = statusMeta[match.status] ?? statusMeta.scheduled;

  const fillMut = useMutation({
    mutationFn: async (args: { hostScore: number; visitorScore: number }) =>
      fill({ data: { matchId: match.id, ...args } }),
    onSuccess: () => {
      toast.success("Placar enviado. Aguardando confirmação do visitante.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmMut = useMutation({
    mutationFn: async () => confirm({ data: { matchId: match.id } }),
    onSuccess: () => {
      toast.success("Súmula confirmada.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disputeMut = useMutation({
    mutationFn: async () => dispute({ data: { matchId: match.id } }),
    onSuccess: () => {
      toast.success("Contestação enviada à organização.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {match.stage === "group" ? `Rod. ${match.round}` : match.stage}
            {match.group_label ? ` · ${match.group_label}` : ""}
          </Badge>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {match.is_host ? (
            <Badge variant="outline" className="gap-1">
              <Flag className="h-3 w-3" /> Mandante
            </Badge>
          ) : (
            <Badge variant="outline">Visitante</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {match.scheduled_at &&
            new Date(match.scheduled_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          {match.venue ? ` · ${match.venue}` : ""}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 my-2">
        <div className="text-center flex-1 min-w-0">
          <div className="font-display text-lg truncate">{match.host?.name ?? "—"}</div>
        </div>
        <div className="font-mono font-bold text-2xl tabular-nums whitespace-nowrap">
          {match.host_score ?? "–"} × {match.visitor_score ?? "–"}
        </div>
        <div className="text-center flex-1 min-w-0">
          <div className="font-display text-lg truncate">{match.visitor?.name ?? "—"}</div>
        </div>
      </div>

      <OpponentContact match={match} />

      {match.status === "scheduled" && match.is_host && (
        <FillForm onSubmit={(h, v) => fillMut.mutate({ hostScore: h, visitorScore: v })} loading={fillMut.isPending} />
      )}
      {match.status === "scheduled" && !match.is_host && (
        <p className="text-xs text-muted-foreground text-center">
          Aguardando o mandante preencher o placar.
        </p>
      )}

      {match.status === "awaiting_confirmation" && match.is_host && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Enviado em {match.host_filled_at && new Date(match.host_filled_at).toLocaleString("pt-BR")}.
          Pode reenviar caso precise corrigir:
          <FillForm
            compact
            onSubmit={(h, v) => fillMut.mutate({ hostScore: h, visitorScore: v })}
            loading={fillMut.isPending}
            initialHost={match.host_score ?? 0}
            initialVisitor={match.visitor_score ?? 0}
          />
        </div>
      )}

      {match.status === "awaiting_confirmation" && !match.is_host && (
        <div className="space-y-2">
          <Deadline filledAt={match.host_filled_at} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => confirmMut.mutate()}
              disabled={confirmMut.isPending}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" /> Confirmar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => disputeMut.mutate()}
              disabled={disputeMut.isPending}
              className="gap-1"
            >
              <AlertTriangle className="h-4 w-4" /> Contestar
            </Button>
          </div>
        </div>
      )}

      {match.status === "disputed" && (
        <p className="text-xs text-destructive">
          Súmula contestada. A organização vai analisar e decidir.
        </p>
      )}
    </div>
  );
}

function OpponentContact({ match }: { match: Match }) {
  const opponent = match.is_host ? match.visitor : match.host;
  if (!opponent || !opponent.manager_phone) return null;
  const myName = match.is_host ? match.host?.short_name : match.visitor?.short_name;
  const dateStr = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleDateString("pt-BR")
    : "(data a definir)";
  const text = `Olá! Sou do ${myName ?? "time"} (Liga Metrópole Várzea). Vamos combinar nosso jogo contra ${opponent.short_name} — ${dateStr}${match.venue ? ` em ${match.venue}` : ""}.`;
  const link = buildWhatsAppLink(opponent.manager_phone, text);
  if (!link) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground truncate">
        Adversário: <span className="font-medium">{opponent.manager_name ?? opponent.name}</span>
      </span>
      <Button asChild size="sm" variant="outline" className="gap-1">
        <a href={link} target="_blank" rel="noreferrer">
          <MessageCircle className="h-3 w-3" /> Falar no WhatsApp
        </a>
      </Button>
    </div>
  );
}

function Deadline({ filledAt }: { filledAt: string | null }) {
  if (!filledAt) return null;
  const deadline = new Date(filledAt).getTime() + HOURS_TO_CONFIRM * 3600 * 1000;
  const remaining = deadline - Date.now();
  const hours = Math.max(0, Math.floor(remaining / 3600000));
  const expired = remaining <= 0;
  return (
    <p className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
      {expired
        ? "Prazo expirado — a organização pode confirmar automaticamente."
        : `Confirme em ~${hours}h ou será confirmado automaticamente.`}
    </p>
  );
}

function FillForm({
  onSubmit,
  loading,
  compact,
  initialHost = 0,
  initialVisitor = 0,
}: {
  onSubmit: (h: number, v: number) => void;
  loading: boolean;
  compact?: boolean;
  initialHost?: number;
  initialVisitor?: number;
}) {
  const [host, setHost] = useState(String(initialHost));
  const [visitor, setVisitor] = useState(String(initialVisitor));

  const handle = () => {
    const h = parseInt(host, 10);
    const v = parseInt(visitor, 10);
    if (Number.isNaN(h) || Number.isNaN(v) || h < 0 || v < 0) {
      toast.error("Placar inválido");
      return;
    }
    onSubmit(h, v);
  };

  return (
    <div className={`flex items-end gap-2 ${compact ? "" : "mt-2"}`}>
      {!compact && (
        <>
          <div>
            <Label className="text-xs">Mandante</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-20 text-center font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Visitante</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={visitor}
              onChange={(e) => setVisitor(e.target.value)}
              className="w-20 text-center font-mono"
            />
          </div>
        </>
      )}
      {compact && (
        <>
          <Input
            type="number"
            min={0}
            max={50}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-14 text-center font-mono h-8"
          />
          <span>×</span>
          <Input
            type="number"
            min={0}
            max={50}
            value={visitor}
            onChange={(e) => setVisitor(e.target.value)}
            className="w-14 text-center font-mono h-8"
          />
        </>
      )}
      <Button size={compact ? "sm" : "default"} onClick={handle} disabled={loading}>
        {loading ? "Enviando..." : "Enviar placar"}
      </Button>
    </div>
  );
}
