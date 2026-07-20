import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell, CheckCircle, XCircle, Clock, RefreshCw, Mail, MessageSquare, Send, Megaphone, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SkeletonAdminList } from "@/components/AppSkeletons";
import {
  listNotificacoes,
  getNotificacoesStats,
  markNotificacaoSent,
  broadcastWhatsapp,
  listTemplates,
  upsertTemplate,
  TEMPLATE_VARIABLES,
  TIPO_LABELS, STATUS_LABELS, CANAL_LABELS,
  type NotificacaoTipo, type NotificacaoCanal, type NotificacaoStatus, type NotificacaoLog,
  type NotificationTemplate,
} from "@/lib/notificacoes.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  component: AdminNotificacoesPage,
});

function statusBadge(status: NotificacaoStatus) {
  if (status === "enviado") return (
    <Badge className="bg-green-900/40 text-green-400 border-green-700 gap-1">
      <CheckCircle className="w-3 h-3" /> Enviado
    </Badge>
  );
  if (status === "falhou") return (
    <Badge className="bg-red-900/40 text-red-400 border-red-700 gap-1">
      <XCircle className="w-3 h-3" /> Falhou
    </Badge>
  );
  return (
    <Badge className="bg-yellow-900/40 text-yellow-400 border-yellow-700 gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </Badge>
  );
}

const TIPO_COLORS: Record<NotificacaoTipo, string> = {
  team_approved: "bg-blue-900/40 text-blue-400 border-blue-700",
  jogo_agendado: "bg-purple-900/40 text-purple-400 border-purple-700",
  sumula_disponivel: "bg-orange-900/40 text-orange-400 border-orange-700",
  sumula_prazo_alerta: "bg-red-900/40 text-red-300 border-red-700",
  destaque_publicado: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  broadcast: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

function canalIcon(canal: NotificacaoCanal) {
  if (canal === "email") return <Mail className="w-3.5 h-3.5 text-zinc-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-green-400" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatsCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
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

function NotificacaoRow({ log, onMarkSent }: {
  log: NotificacaoLog;
  onMarkSent: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canOpenWhatsapp = log.canal === "whatsapp" && !!log.whatsapp_url;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!log.whatsapp_url) return;
    window.open(log.whatsapp_url, "_blank", "noopener,noreferrer");
    if (log.status !== "enviado") onMarkSent(log.id);
  };

  return (
    <div
      className="border-b border-zinc-800 py-3 px-4 hover:bg-zinc-800/30 cursor-pointer transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge className={`${TIPO_COLORS[log.tipo]} text-xs`}>{TIPO_LABELS[log.tipo]}</Badge>
          <span className="flex items-center gap-1">
            {canalIcon(log.canal)}
            <span className="text-xs text-zinc-500">{CANAL_LABELS[log.canal]}</span>
          </span>
          <span className="text-sm text-zinc-300 truncate max-w-[200px]">
            {log.destinatario_nome ?? log.destinatario_email ?? log.destinatario_phone ?? "—"}
          </span>
          {log.destinatario_phone && (
            <span className="text-xs text-zinc-500">
              (+{log.destinatario_phone})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {statusBadge(log.status)}
          <span className="text-xs text-zinc-500 hidden sm:inline">{formatDate(log.created_at)}</span>
        </div>
      </div>

      {log.corpo_preview && (
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{log.corpo_preview}</p>
      )}

      {canOpenWhatsapp && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={handleOpen}
            className="bg-green-700 hover:bg-green-600 text-white gap-1.5 h-7 text-xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {log.status === "enviado" ? `Reenviar (${log.send_count})` : "Abrir WhatsApp"}
          </Button>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 text-xs border-t border-zinc-700 pt-3">
          {log.corpo_preview && (
            <div>
              <p className="text-zinc-500 font-medium mb-1">Mensagem:</p>
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
          <div className="flex flex-wrap gap-4 text-zinc-500">
            <span>ID: <span className="text-zinc-400 font-mono">{log.id.slice(0, 8)}</span></span>
            <span>Envios: <span className="text-zinc-400">{log.send_count}</span></span>
            {log.enviado_em && (
              <span>Último envio: <span className="text-zinc-400">{formatDate(log.enviado_em)}</span></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"directors_all" | "custom">("directors_all");
  const [customList, setCustomList] = useState("");
  const broadcastFn = useServerFn(broadcastWhatsapp);

  const mut = useMutation({
    mutationFn: async () => {
      const custom = audience === "custom"
        ? customList
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line) => {
              const parts = line.split(",").map((p) => p.trim());
              return { nome: parts[0] || null, phone: parts[1] || parts[0] };
            })
        : undefined;
      return broadcastFn({
        data: {
          message,
          audience,
          custom_contacts: custom,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${res.count} notificação(ões) enfileirada(s). Abra cada uma no painel para enviar via WhatsApp.`);
      setOpen(false);
      setMessage("");
      setCustomList("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#1565F5] hover:bg-[#1252c9] gap-2" size="sm">
          <Megaphone className="w-4 h-4" />
          Nova mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar mensagem em massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Público-alvo</label>
            <Select value={audience} onValueChange={(v) => setAudience(v as "directors_all" | "custom")}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="directors_all">Todos os diretores de times</SelectItem>
                <SelectItem value="custom">Lista personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === "custom" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Contatos (um por linha, formato: <span className="font-mono">Nome, telefone</span>)
              </label>
              <Textarea
                value={customList}
                onChange={(e) => setCustomList(e.target.value)}
                placeholder={"João Silva, 11987654321\nMaria Souza, 11912345678"}
                className="bg-zinc-800 border-zinc-700 h-24 font-mono text-xs"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Mensagem ({message.length}/1000)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder="Ex.: Reunião de diretores hoje às 20h no clube..."
              className="bg-zinc-800 border-zinc-700 h-32"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || message.trim().length < 3}
            className="bg-[#1565F5] hover:bg-[#1252c9] gap-2"
          >
            <Send className="w-4 h-4" />
            Enfileirar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NotificacaoTipo>("team_approved");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const listFn = useServerFn(listTemplates);
  const saveFn = useServerFn(upsertTemplate);

  const { data, refetch } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: () => listFn({}),
    enabled: open,
  });

  const templates = data?.templates ?? [];
  const current = templates.find((t) => t.tipo === selected);

  // Sync form when selection or data changes
  const syncKey = `${selected}:${current?.updated_at ?? ""}`;
  useMemo(() => {
    if (current) {
      setAssunto(current.assunto ?? "");
      setMensagem(current.mensagem);
    }
    return syncKey;
  }, [syncKey, current]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { tipo: selected, assunto: assunto || null, mensagem } }),
    onSuccess: () => {
      toast.success("Template salvo");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vars = TEMPLATE_VARIABLES[selected] ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2">
          <FileText className="w-4 h-4" /> Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Templates de notificação</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure o texto enviado em cada evento. Use variáveis entre chaves.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
            <Select value={selected} onValueChange={(v) => setSelected(v as NotificacaoTipo)}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {Object.entries(TIPO_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Variáveis disponíveis</label>
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMensagem((m) => m + `{${v}}`)}
                  className="text-xs font-mono px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-blue-300"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Assunto (opcional)</label>
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
              placeholder="Ex.: Status do time: {status}"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Mensagem ({mensagem.length}/2000)
            </label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value.slice(0, 2000))}
              className="bg-zinc-800 border-zinc-700 h-40 font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
            Fechar
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || mensagem.trim().length < 1}
            className="bg-[#1565F5] hover:bg-[#1252c9]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminNotificacoesPage() {
  const [filterTipo, setFilterTipo] = useState<NotificacaoTipo | "all">("all");
  const [filterStatus, setFilterStatus] = useState<NotificacaoStatus | "all">("all");
  const [filterCanal, setFilterCanal] = useState<NotificacaoCanal | "all">("all");

  const listFn = useServerFn(listNotificacoes);
  const statsFn = useServerFn(getNotificacoesStats);
  const markSentFn = useServerFn(markNotificacaoSent);

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["notificacoes-stats"],
    queryFn: () => statsFn({}),
  });

  const { data: logsData, isLoading, refetch } = useQuery({
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

  const markSentMut = useMutation({
    mutationFn: (id: string) => markSentFn({ data: { id } }),
    onSuccess: () => {
      refetch();
      refetchStats();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRefresh = () => {
    refetch();
    refetchStats();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Bell className="w-6 h-6 text-[#1565F5] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Notificações</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Central de disparos e histórico de mensagens
            </p>
          </div>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <BroadcastDialog onDone={handleRefresh} />
          <Button
            variant="outline" size="sm" onClick={handleRefresh}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>

      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard label="Total" value={statsData.total} icon={<Bell className="w-4 h-4 text-blue-400" />} color="bg-blue-950/40" />
          <StatsCard label="Enviados" value={statsData.enviados} icon={<CheckCircle className="w-4 h-4 text-green-400" />} color="bg-green-950/40" />
          <StatsCard label="Falharam" value={statsData.falhos} icon={<XCircle className="w-4 h-4 text-red-400" />} color="bg-red-950/40" />
          <StatsCard label="Pendentes" value={statsData.pendentes} icon={<Clock className="w-4 h-4 text-yellow-400" />} color="bg-yellow-950/40" />
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800 mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-zinc-400">Filtrar:</span>
            <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as NotificacaoTipo | "all")}>
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700 text-sm h-8"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as NotificacaoStatus | "all")}>
              <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700 text-sm h-8"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCanal} onValueChange={(v) => setFilterCanal(v as NotificacaoCanal | "all")}>
              <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-sm h-8"><SelectValue placeholder="Canal" /></SelectTrigger>
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

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-0 px-4 pt-4">
          <CardTitle className="text-base text-zinc-200">Últimos 100 envios</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-2">
          {isLoading ? (
            <div className="p-3"><SkeletonAdminList rows={6} /></div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nenhuma notificação encontrada</p>
              <p className="text-xs mt-1">As notificações aparecerão aqui automaticamente</p>
            </div>
          ) : (
            <div>
              {logs.map((log) => (
                <NotificacaoRow key={log.id} log={log} onMarkSent={(id) => markSentMut.mutate(id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
