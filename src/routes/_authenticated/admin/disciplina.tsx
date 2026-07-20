import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListActiveSuspensions,
  adminSetSuspensionActive,
  recomputeMatchDiscipline,
} from "@/lib/discipline.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ArrowLeft, RefreshCw, ShieldOff, ShieldCheck, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/disciplina")({
  component: DisciplinaAdminPage,
});

const REASON_LABEL: Record<string, string> = {
  accum_yellow: "Amarelos acumulados",
  red_card: "Cartão vermelho",
  direct_red: "Vermelho direto",
  manual: "Manual",
};

function REASON_TONE(reason: string) {
  return reason === "direct_red"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : reason === "red_card"
    ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
    : reason === "accum_yellow"
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
}

type Row = {
  id: string;
  athlete_id: string;
  team_id: string;
  origin_match_id: string | null;
  reason: string;
  games_total: number;
  games_remaining: number;
  active: boolean;
  created_at: string;
  athletes: { full_name: string; nickname: string | null; position: string | null } | null;
  teams: { name: string; short_name: string | null } | null;
  competitions: { name: string } | null;
};

function DisciplinaAdminPage() {
  const listFn = useServerFn(adminListActiveSuspensions);
  const setActiveFn = useServerFn(adminSetSuspensionActive);
  const recomputeFn = useServerFn(recomputeMatchDiscipline);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [matchIdInput, setMatchIdInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "discipline", "active"],
    queryFn: () => listFn(),
  });

  const rows = (data?.rows ?? []) as Row[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.athletes?.full_name ?? "").toLowerCase().includes(q) ||
      (r.athletes?.nickname ?? "").toLowerCase().includes(q) ||
      (r.teams?.name ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const clearMut = useMutation({
    mutationFn: (id: string) => setActiveFn({ data: { id, active: false } }),
    onSuccess: () => {
      toast.success("Suspensão anulada");
      qc.invalidateQueries({ queryKey: ["admin", "discipline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anular"),
  });

  const recomputeMut = useMutation({
    mutationFn: (matchId: string) => recomputeFn({ data: { match_id: matchId } }),
    onSuccess: () => {
      toast.success("Disciplina recalculada");
      setMatchIdInput("");
      qc.invalidateQueries({ queryKey: ["admin", "discipline"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recalcular"),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="ghost" className="text-zinc-300">
          <Link to="/admin/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl tracking-wide text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            Disciplina & Suspensões
          </h1>
          <p className="text-sm text-zinc-400">
            Suspensões ativas na liga. São recalculadas automaticamente quando uma súmula é homologada.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-200">Recalcular disciplina de uma partida</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={matchIdInput}
            onChange={(e) => setMatchIdInput(e.target.value)}
            placeholder="UUID da partida"
            className="max-w-md"
          />
          <Button
            onClick={() => matchIdInput && recomputeMut.mutate(matchIdInput.trim())}
            disabled={!matchIdInput || recomputeMut.isPending}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Recalcular
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base text-zinc-200">
              Suspensões ativas ({filtered.length})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atleta ou time"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-zinc-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              Nenhuma suspensão ativa no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Competição</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-center">Restantes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="text-sm font-medium text-zinc-100">
                          {r.athletes?.nickname || r.athletes?.full_name || "—"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {r.athletes?.position ?? ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">
                        {r.teams?.short_name || r.teams?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-400">
                        {r.competitions?.name ?? "Geral"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={REASON_TONE(r.reason)}>
                          {REASON_LABEL[r.reason] ?? r.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-lg font-semibold text-amber-300">
                          {r.games_remaining}
                        </span>
                        <span className="text-xs text-zinc-500"> / {r.games_total}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => clearMut.mutate(r.id)}
                          disabled={clearMut.isPending}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Anular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400 space-y-1">
          <p>• Cartões são registrados na súmula (kind: yellow_card, red_card, direct_red).</p>
          <p>• Ao homologar a súmula, o sistema cria as suspensões e decrementa as em curso.</p>
          <p>• Limite padrão: 3 amarelos → 1 jogo. Configure em cada Liga (Admin › Ligas).</p>
        </CardContent>
      </Card>
    </div>
  );
}
