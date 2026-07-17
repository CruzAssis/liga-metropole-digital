import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListSumulasPending,
  adminApplyWO,
  adminForceConfirm,
} from "@/lib/sumula.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Eye } from "lucide-react";
import { Spinner } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/sumulas")({
  component: AdminSumulasPage,
});

function msToLabel(ms: number): string {
  if (ms <= 0) return "Prazo expirado";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h restantes`;
  return `${h}h ${m}m restantes`;
}

function sumulaStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "scheduled": return { label: "Aberta", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    case "awaiting_confirmation": return { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    case "confirmed": return { label: "Concluída", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    case "disputed": return { label: "Disputada", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    case "wo": return { label: "WO", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
    default: return { label: status, color: "bg-zinc-700 text-zinc-300" };
  }
}

function AdminSumulasPage() {
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const fetchList = useServerFn(adminListSumulasPending);
  const applyWOFn = useServerFn(adminApplyWO);
  const forceConfirmFn = useServerFn(adminForceConfirm);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["admin-sumulas"],
    queryFn: async () => { const r = await fetchList(); return r.matches ?? []; },
    refetchInterval: 30_000,
    enabled: isAdmin,
  });

  const woMut = useMutation({
    mutationFn: ({ matchId, winner }: { matchId: string; winner: "host" | "visitor" }) => applyWOFn({ data: { matchId, winner } }),
    onSuccess: () => { toast.success("WO aplicado"); qc.invalidateQueries({ queryKey: ["admin-sumulas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (matchId: string) => forceConfirmFn({ data: { matchId } }),
    onSuccess: () => { toast.success("Sumula confirmada"); qc.invalidateQueries({ queryKey: ["admin-sumulas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();

  if (!isAdmin) return null;

  const openMatches = matches.filter(m => m.status === "scheduled");
  const inProgressMatches = matches.filter(m => m.status === "awaiting_confirmation" || m.status === "disputed");
  const expiredMatches = matches.filter(m => {
    if (!m.scheduled_at) return false;
    const deadline = new Date(m.scheduled_at).getTime() + 72 * 3600 * 1000;
    return deadline < now && (m.status === "scheduled" || m.status === "awaiting_confirmation");
  });

  const renderMatch = (m: (typeof matches)[0]) => {
    const deadline = m.scheduled_at
      ? new Date(m.scheduled_at).getTime() + 72 * 3600 * 1000
      : null;
    const ms = deadline ? deadline - now : null;
    const expired = ms !== null && ms <= 0;
    const critical = ms !== null && ms > 0 && ms < 6 * 3600 * 1000;
    const statusInfo = sumulaStatusLabel(m.status);

    return (
      <div key={m.id} className={`bg-zinc-900 border rounded-lg p-4 ${expired ? "border-red-700/50" : "border-zinc-800"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm">
              {m.host?.name ?? m.host_team_id.substring(0,8)} {m.host_score ?? "–"} x {m.visitor_score ?? "–"} {m.visitor?.name ?? m.visitor_team_id.substring(0,8)}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {m.stage} · Rodada {m.round}
              {m.scheduled_at && (" · " + new Date(m.scheduled_at).toLocaleString("pt-BR"))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs border rounded px-2 py-0.5 ${statusInfo.color}`}>{statusInfo.label}</span>
            {ms !== null && (
              <span className={`flex items-center gap-1 text-xs ${expired ? "text-red-400" : critical ? "text-orange-400" : "text-zinc-500"}`}>
                {expired ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {msToLabel(ms)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to="/partidas/$id" params={{ id: m.id }}>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Eye className="h-3 w-3" /> Ver partida
            </Button>
          </Link>
          {(m.status === "scheduled" || m.status === "awaiting_confirmation") && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-red-800 text-red-400 hover:bg-red-950"
                disabled={woMut.isPending}
                onClick={() => { const w = window.confirm("WO para qual time?\nOK = Mandante ganha | Cancelar = Visitante ganha"); woMut.mutate({ matchId: m.id, winner: w ? "host" : "visitor" }); }}
              >
                <XCircle className="h-3 w-3 mr-1" /> Aplicar WO
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-green-800 text-green-400 hover:bg-green-950"
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate(m.id)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar sumula
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-white">Sumulas Digitais</h1>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1">Gerencie sumulas abertas, em andamento e concluidas</p>
      </div>


      {isLoading && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {!isLoading && (
        <>
          {expiredMatches.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-display text-lg text-red-400 mb-3">
                <AlertTriangle className="h-4 w-4" /> Prazo Expirado ({expiredMatches.length})
              </h2>
              <div className="space-y-3">{expiredMatches.map(renderMatch)}</div>
            </section>
          )}

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg text-yellow-400 mb-3">
              <FileText className="h-4 w-4" /> Abertas ({openMatches.length})
            </h2>
            {openMatches.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">Nenhuma sumula aberta no momento.</p>
            ) : (
              <div className="space-y-3">{openMatches.map(renderMatch)}</div>
            )}
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg text-blue-400 mb-3">
              <Clock className="h-4 w-4" /> Em Andamento ({inProgressMatches.length})
            </h2>
            {inProgressMatches.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">Nenhuma sumula em andamento.</p>
            ) : (
              <div className="space-y-3">{inProgressMatches.map(renderMatch)}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
