import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, CheckCircle, XCircle, Clock, RefreshCw, Mail, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listNotificacoes,
  getNotificacoesStats,
  TIPO_LABELS,
  STATUS_LABELS,
  CANAL_LABELS,
  type NotificacaoTipo,
  type NotificacaoCanal,
  type NotificacaoStatus,
  type NotificacaoLog,
} from "@/lib/notificacoes.functions";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  component: AdminNotificacoesPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: NotificacaoStatus) {
  if (status === "enviado") {
    return (
      <Badge className="bg-green-900/40 text-green-400 border-green-700 gap-1">
        <CheckCircle className="w-3 h-3" /> Enviado
      </Badge>
    );
  }
  if (status === "falhou") {
    return (
      <Badge className="bg-red-900/40 text-red-400 border-red-700 gap-1">
        <XCircle className="w-3 h-3" /> Falhou
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-900/40 text-yellow-400 border-yellow-700 gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </Badge>
  );
}

function tipoBadge(tipo: NotificacaoTipo) {
  const colors: Record<NotificacaoTipo, string> = {
    team_approved: "bg-blue-900/40 text-blue-400 border-blue-700",
    jogo_agendado: "bg-purple-900/40 text-purple-400 border-purple-700",
    sumula_disponivel: "bg-orange-900/40 text-orange-400 border-orange-700",
    sumula_prazo_alerta: "bg-red-900/40 text-red-300 border-red-700",
    destaque_publicado: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  };
  return (
    <Badge className={`${colors[tipo]} text-xs`}>
      {TIPO_LABELS[tipo]}
    </Badge>
  );
}

function canalIcon(canal: NotificacaoCanal) {
  if (canal === "email") return <Mail className="w-3.5 h-3.5 text-zinc-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-green-400" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-zinc-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────

function NotificacaoRow({ log }: { log: NotificacaoLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-b border-zinc-800 py-3 px-4 hover:bg-zinc-800/30 cursor-pointer transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: tipo + canal + destinatário */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {tipoBadge(log.tipo)}
          <span className="flex items-center gap-1">
            {canalIcon(log.canal)}
            <span className="text-xs text-zinc-500">{CANAL_LABELS[log.canal]}</span>
          </span>
          <span className="text-sm text-zinc-300 truncate max-w-[200px]">
            {log.destinatario_nome ?? log.destinatario_email ?? "—"}
          </span>
          {log.destinatario_email && (
            <span className="text-xs text-zinc-500 truncate max-w-[180px]">
              ({log.destinatario_email})
            </span>
          )}
        </div>

        {/* Right: status + date */}
        <div className="flex items-center gap-3 shrink-0">
          {statusBadge(log.status)}
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {formatDate(log.created_at)}
          </span>
        </div>
      </div>

      {/* Subject preview */}
      {log.assunto && (
        <p className="text-xs text-zinc-400 mt-1 truncate">{log.assunto}</p>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-2 text-xs border-t border-zinc-700 pt-3">
          {log.corpo_preview && (
            <div>
              <p className="text-zinc-500 font-medium mb-1">Prévia do corpo:</p>
              <p className="text-zinc-300 whitespace-pre-wrap bg-zinc-800 rounded p-2">
                {log.corpo_preview}
              </p>
            </div>
          )}
          {log.erro_mensagem && (
            <div>
              <p className="text-red-400 font-medium mb-1">Erro:</p>
              <p className="text-red-300 bg-red-950/30 rounded p-2">{log.erro_mensagem}</p>
            </div>
          )}
          <div className="flex gap-4 text-zinc-500">
            <span>ID: <span className="text-zinc-400 font-mono">{log.id.slice(0, 8)}...</span></span>
            {log.enviado_em && (
              <span>Enviado em: <span className="text-zinc-400">{formatDate(log.enviado_em)}</span></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function AdminNotificacoesPage() {
  const [filterTipo, setFilterTipo] = useState<NotificacaoTipo | "all">("all");
  const [filterStatus, setFilterStatus] = useState<NotificacaoStatus | "all">("all");
  const [filterCanal, setFilterCanal] = useState<NotificacaoCanal | "all">("all");

  const listFn = useServerFn(listNotificacoes);
  const statsFn = useServerFn(getNotificacoesStats);

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["notificacoes-stats"],
    queryFn: () => statsFn({}),
  });

  const {
    data: logsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notificacoes-log", filterTipo, filterStatus, filterCanal],
    queryFn: () =>
      listFn({
        data: {
          limit: 100,
          tipo: filterTipo !== "all" ? (filterTipo as NotificacaoTipo) : undefined,
          status: filterStatus !== "all" ? (filterStatus as NotificacaoStatus) : undefined,
          canal: filterCanal !== "all" ? (filterCanal as NotificacaoCanal) : undefined,
        },
      }),
  });

  const logs = logsData?.logs ?? [];

  const handleRefresh = () => {
    refetch();
    refetchStats();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-[#1565F5]" />
          <div>
            <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-sm text-zinc-400">Histórico de emails e alertas enviados</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard
            label="Total enviados"
            value={statsData.total}
            icon={<Bell className="w-4 h-4 text-blue-400" />}
            color="bg-blue-950/40"
          />
          <StatsCard
            label="Entregues"
            value={statsData.enviados}
            icon={<CheckCircle className="w-4 h-4 text-green-400" />}
            color="bg-green-950/40"
          />
          <StatsCard
            label="Falharam"
            value={statsData.falhos}
            icon={<XCircle className="w-4 h-4 text-red-400" />}
            color="bg-red-950/40"
          />
          <StatsCard
            label="Pendentes"
            value={statsData.pendentes}
            icon={<Clock className="w-4 h-4 text-yellow-400" />}
            color="bg-yellow-950/40"
          />
        </div>
      )}

      {/* Filters */}
      <Card className="bg-zinc-900 border-zinc-800 mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-zinc-400">Filtrar:</span>

            {/* Tipo filter */}
            <Select
              value={filterTipo}
              onValueChange={(v) => setFilterTipo(v as NotificacaoTipo | "all")}
            >
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700 text-sm h-8">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as NotificacaoStatus | "all")}
            >
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-sm h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Canal filter */}
            <Select
              value={filterCanal}
              onValueChange={(v) => setFilterCanal(v as NotificacaoCanal | "all")}
            >
              <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-sm h-8">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(CANAL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-zinc-500 ml-auto">
              {logs.length} registro{logs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Log List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-0 px-4 pt-4">
          <CardTitle className="text-base text-zinc-200">
            Últimos 100 envios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-2">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando notificações...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nenhuma notificação encontrada</p>
              <p className="text-xs mt-1">
                As notificações aparecerão aqui quando forem enviadas
              </p>
            </div>
          ) : (
            <div>
              {logs.map((log) => (
                <NotificacaoRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
