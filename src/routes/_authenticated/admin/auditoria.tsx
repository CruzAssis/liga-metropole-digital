import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListAuditLog, type AuditRow } from "@/lib/audit.functions";
import { RefreshCw, Search, FileClock, Download } from "lucide-react";
import { SkeletonAdminPage } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AuditoriaPage,
});

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  "user.role.grant": { label: "Papel concedido", tone: "bg-emerald-600" },
  "user.role.revoke": { label: "Papel removido", tone: "bg-amber-600" },
  "user.password_reset": { label: "Reset de senha", tone: "bg-sky-600" },
  "user.delete": { label: "Usuário excluído", tone: "bg-red-600" },
  "team.transfer": { label: "Titularidade transferida", tone: "bg-purple-600" },
  "team.delete": { label: "Time excluído", tone: "bg-red-600" },
  "team.update": { label: "Time editado", tone: "bg-blue-600" },
  "athlete.update": { label: "Atleta editado", tone: "bg-blue-600" },
  "athlete.delete": { label: "Atleta excluído", tone: "bg-red-600" },
  "match.update": { label: "Partida editada", tone: "bg-blue-600" },
  "match.annul": { label: "Placar anulado", tone: "bg-amber-600" },
  "venue.upsert": { label: "Local salvo", tone: "bg-blue-600" },
  "venue.delete": { label: "Local excluído", tone: "bg-red-600" },
  "config.update": { label: "Configuração pública salva", tone: "bg-blue-600" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AuditoriaPage() {
  const listFn = useServerFn(adminListAuditLog);
  const [actionFilter, setActionFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fromIso = fromDate ? new Date(fromDate + "T00:00:00").toISOString() : undefined;
  const toIso = toDate ? new Date(toDate + "T23:59:59.999").toISOString() : undefined;

  const { data, isLoading, refetch, isFetching } = useQuery<AuditRow[]>({
    queryKey: ["admin", "audit-log", fromIso ?? "", toIso ?? ""],
    queryFn: () =>
      listFn({ data: { from: fromIso ?? null, to: toIso ?? null } }) as unknown as Promise<AuditRow[]>,
  });

  const rows: AuditRow[] = data ?? [];

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "todos" && r.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          (r.actor_email ?? "").toLowerCase() +
          " " +
          (r.entity_id ?? "").toLowerCase() +
          " " +
          JSON.stringify(r.metadata ?? {}).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, actionFilter, search]);

  const uniqueActions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );

  if (isLoading) return <SkeletonAdminPage />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileClock className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Admin</p>
            <h1 className="text-xl sm:text-2xl font-black truncate">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Registro de todas as ações administrativas sensíveis.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (isFetching ? "animate-spin" : "")} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_180px]">
        <div>
          <Label className="text-xs">Buscar por e-mail, id ou metadados</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="admin@exemplo.com, uuid, palavra…"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Ação</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {uniqueActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a]?.label ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <div className="flex gap-1">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                title="Limpar datas"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg">
          <FileClock className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum registro encontrado</p>
          <p className="text-xs mt-1">Ações administrativas aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = ACTION_LABELS[r.action];
            return (
              <div
                key={r.id}
                className="rounded-lg border bg-card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-start"
              >
                <div className="flex-shrink-0 min-w-[160px]">
                  <Badge className={`${meta?.tone ?? "bg-slate-600"} text-white`}>
                    {meta?.label ?? r.action}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatDateTime(r.created_at)}
                  </p>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Autor:</span>{" "}
                    <span className="font-medium">{r.actor_email ?? r.actor_id ?? "sistema"}</span>
                  </p>
                  {(r.entity_type || r.entity_id) && (
                    <p className="text-xs text-muted-foreground break-all">
                      {r.entity_type ?? "—"}{r.entity_id ? ` · ${r.entity_id}` : ""}
                    </p>
                  )}
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto max-h-32">
                      {JSON.stringify(r.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
