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
import { FileText, CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/sumulas")({
  component: AdminSumulasPage,
});

function AdminSumulasPage() {
  const { isAdmin, loading } = useIsAdmin();
  const list = useServerFn(adminListSumulasPending);
  const applyWO = useServerFn(adminApplyWO);
  const forceConfirm = useServerFn(adminForceConfirm);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sumulas"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const woMut = useMutation({
    mutationFn: async (args: { matchId: string; winner: "host" | "visitor" }) =>
      applyWO({ data: args }),
    onSuccess: () => {
      toast.success("WO aplicado");
      qc.invalidateQueries({ queryKey: ["admin-sumulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: async (matchId: string) => forceConfirm({ data: { matchId } }),
    onSuccess: () => {
      toast.success("Súmula confirmada");
      qc.invalidateQueries({ queryKey: ["admin-sumulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p>Acesso restrito.</p>
        <Link to="/" className="underline text-primary">Início</Link>
      </div>
    );
  }

  const matches = data?.matches ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="font-display text-4xl tracking-wide">Súmulas pendentes</h1>
      </div>

      {isLoading && <div className="text-muted-foreground">Carregando...</div>}
      {!isLoading && matches.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma súmula pendente.
        </div>
      )}

      <div className="space-y-3">
        {matches.map((m) => (
          <div key={m.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {m.stage === "group" ? `Rod. ${m.round}` : m.stage}
                  {m.group_label ? ` · ${m.group_label}` : ""}
                </Badge>
                <Badge
                  variant={
                    m.status === "disputed"
                      ? "destructive"
                      : m.status === "awaiting_confirmation"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {m.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {m.scheduled_at &&
                  new Date(m.scheduled_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 my-2">
              <div className="text-center flex-1 min-w-0">
                <div className="font-display text-lg truncate">{m.host?.name ?? "—"}</div>
              </div>
              <div className="font-mono font-bold text-2xl tabular-nums">
                {m.host_score ?? "–"} × {m.visitor_score ?? "–"}
              </div>
              <div className="text-center flex-1 min-w-0">
                <div className="font-display text-lg truncate">{m.visitor?.name ?? "—"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end mt-2">
              {(m.status === "disputed" || m.status === "awaiting_confirmation") &&
                m.host_score != null && (
                  <Button
                    size="sm"
                    onClick={() => confirmMut.mutate(m.id)}
                    disabled={confirmMut.isPending}
                    className="gap-1"
                  >
                    {confirmMut.isPending ? <><Spinner className="mr-1 h-4 w-4" />Aguarde...</> : <><CheckCircle2 className="h-4 w-4" /> Confirmar placar</>}
                  </Button>
                )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => woMut.mutate({ matchId: m.id, winner: "host" })}
                disabled={woMut.isPending}
                className="gap-1"
              >
                <XCircle className="h-4 w-4" /> WO p/ {m.host?.short_name}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => woMut.mutate({ matchId: m.id, winner: "visitor" })}
                disabled={woMut.isPending}
                className="gap-1"
              >
                <XCircle className="h-4 w-4" /> WO p/ {m.visitor?.short_name}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
