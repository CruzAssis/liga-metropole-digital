import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTeamMatches,
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
import { ConfirmSumulaDialog } from "./ConfirmSumulaDialog";

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
  const dispute = useServerFn(disputeSumula);
  const [sumulaOpen, setSumulaOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const meta = statusMeta[match.status] ?? statusMeta.scheduled;

  const disputeMut = useMutation({
    mutationFn: async () => dispute({ data: { matchId: match.id } }),
    onSuccess: () => {
      toast.success("Contestação enviada à organização.");
      qc.invalidateQueries({ queryKey: ["my-team-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canFill = match.is_host && ["scheduled", "awaiting_confirmation"].includes(match.status);
  const canView = !canFill && match.host_score != null;

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {match.status === "scheduled" && !match.is_host && (
            <span>Aguardando o mandante preencher.</span>
          )}
          {match.status === "awaiting_confirmation" && match.is_host && match.host_filled_at && (
            <>
              <Clock className="h-3 w-3" />
              Enviado em {new Date(match.host_filled_at).toLocaleString("pt-BR")}
            </>
          )}
          {match.status === "awaiting_confirmation" && !match.is_host && (
            <Deadline filledAt={match.host_filled_at} />
          )}
          {match.status === "disputed" && (
            <span className="text-destructive">Contestado — aguardando organização.</span>
          )}
        </div>

        <div className="flex gap-2">
          {canFill && (
            <Button size="sm" onClick={() => setSumulaOpen(true)} className="gap-1">
              <ClipboardEdit className="h-4 w-4" />
              {match.status === "scheduled" ? "Lançar súmula" : "Editar súmula"}
            </Button>
          )}
          {canView && (
            <Button size="sm" variant="outline" onClick={() => setSumulaOpen(true)} className="gap-1">
              <Eye className="h-4 w-4" /> Ver súmula
            </Button>
          )}
          {match.status === "awaiting_confirmation" && !match.is_host && (
            <>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="gap-1"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmar súmula
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
            </>
          )}
        </div>
      </div>

      {sumulaOpen && (
        <SumulaDialog
          matchId={match.id}
          open={sumulaOpen}
          onOpenChange={setSumulaOpen}
        />
      )}
      {confirmOpen && (
        <ConfirmSumulaDialog
          matchId={match.id}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
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
    <span className={expired ? "text-destructive" : ""}>
      {expired
        ? "Prazo expirado — a organização pode confirmar automaticamente."
        : `Confirme em ~${hours}h ou será confirmado automaticamente.`}
    </span>
  );
}
