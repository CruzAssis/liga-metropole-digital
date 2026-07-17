import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, Plus, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { executeDraw } from "@/lib/draw.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/sorteio")({
  component: SorteioPage,
});

type Competition = {
  id: string;
  name: string;
  status: string;
  registration_status: string;
  draw_executed_at: string | null;
  full_notified_at: string | null;
  created_at: string;
  max_teams: number;
  host_slots: number;
  visitor_slots: number;
};

type FillStats = {
  total_approved: number;
  host_a_approved: number;
  host_b_approved: number;
  visitor_a_approved: number;
  visitor_b_approved: number;
  max_teams: number;
  is_full: boolean;
};

const REG_STATUS = {
  open:       { label: "Inscricoes abertas",  cls: "bg-emerald-500/20 text-emerald-400" },
  closed:     { label: "Inscricoes fechadas", cls: "bg-zinc-500/20 text-zinc-400" },
  draw_ready: { label: "Pronta p/ sorteio",   cls: "bg-yellow-500/20 text-yellow-300" },
  active:     { label: "Em andamento",        cls: "bg-blue-500/20 text-blue-400" },
  finished:   { label: "Encerrada",           cls: "bg-muted text-muted-foreground" },
} as Record<string, { label: string; cls: string }>;

function SorteioPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [fillStats, setFillStats] = useState<Record<string, FillStats>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [firstRoundDate, setFirstRoundDate] = useState<string>("");
  const [intervalDays, setIntervalDays] = useState<string>("7");
  const drawFn = useServerFn(executeDraw);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitions")
      .select("id,name,status,registration_status,draw_executed_at,full_notified_at,created_at,max_teams,host_slots,visitor_slots")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar competicoes", { description: error.message });
    else {
      const list = (data as Competition[]) ?? [];
      setCompetitions(list);
      const stats: Record<string, FillStats> = {};
      await Promise.all(
        list.map(async (c) => {
          const { data: s } = await supabase.rpc("competition_fill_stats", { _competition_id: c.id });
          if (s && s.length > 0) stats[c.id] = s[0] as FillStats;
        }),
      );
      setFillStats(stats);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleDraw = async (id: string) => {
    if (!firstRoundDate) { toast.error("Informe a data da primeira rodada"); return; }
    const interval = parseInt(intervalDays, 10);
    if (!Number.isFinite(interval) || interval < 1) { toast.error("Intervalo invalido"); return; }
    setRunning(id);
    try {
      const result = await drawFn({ data: { competitionId: id, firstRoundDate, intervalDays: interval } });
      toast.success("Sorteio executado!", {
        description: `${result.matches_created} partidas geradas (${result.matches_per_lado} por Lado)`,
      });
      void load();
    } catch (err) {
      let msg = "Falha ao executar sorteio";
      if (err instanceof Response) {
        try { const b = await err.json(); msg = b.error ?? msg; if (b.counts) msg += ` (${JSON.stringify(b.counts)})`; } catch { /* noop */ }
      } else if (err instanceof Error) { msg = err.message; }
      toast.error("Erro", { description: msg });
    } finally { setRunning(null); }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">Sorteio</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Execute o sorteio quando uma liga estiver completa (status: Pronta p/ sorteio).
          Para configurar uma nova liga, acesse{" "}
          <Link to="/admin/ligas" className="underline text-primary">Configuracao de Ligas</Link>.
        </p>
      </div>


      {/* Draw calendar config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendario do sorteio</CardTitle>
          <CardDescription>Data da rodada 1 e intervalo entre rodadas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            value={firstRoundDate}
            onChange={(e) => setFirstRoundDate(e.target.value)}
            className="sm:flex-1"
          />
          <Input
            type="number"
            min={1}
            max={60}
            placeholder="Intervalo (dias)"
            className="sm:w-40"
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Competitions list */}
      <div className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Ligas</h2>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : competitions.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhuma liga criada.{" "}
            <Link to="/admin/ligas" className="underline text-primary">Criar liga</Link>
          </p>
        ) : (
          competitions.map((c) => {
            const drawn = c.draw_executed_at !== null;
            const rs = REG_STATUS[c.registration_status] ?? REG_STATUS.closed;
            const s = fillStats[c.id];
            const isFull = s?.is_full ?? (c.full_notified_at !== null);
            const drawReady = c.registration_status === "draw_ready";
            const pct = s ? Math.round((s.total_approved / s.max_teams) * 100) : 0;

            return (
              <Card key={c.id} className={drawReady && !drawn ? "border-yellow-500/40" : ""}>
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-lg">{c.name}</span>
                        <Badge className={rs.cls}>{rs.label}</Badge>
                        {isFull && !drawn && (
                          <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Liga Completa! Pronta para sorteio
                          </Badge>
                        )}
                        {drawn && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" /> Sorteio realizado
                          </Badge>
                        )}
                      </div>
                      {c.full_notified_at && !drawn && (
                        <p className="text-xs text-yellow-400">
                          Liga completa desde {new Date(c.full_notified_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                      {drawn && (
                        <p className="text-xs text-muted-foreground">
                          Sorteio em {new Date(c.draw_executed_at!).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/admin/ligas"><Settings className="h-4 w-4 mr-1" /> Configurar</Link>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            disabled={drawn || running === c.id || !drawReady}
                            variant={drawReady && !drawn ? "default" : "outline"}
                            size="sm"
                            title={!drawReady && !drawn ? "Disponivelsomente quando a liga estiver completa (status: Pronta p/ sorteio)" : undefined}
                          >
                            <Shuffle className="h-4 w-4 mr-1" />
                            {drawn ? "Ja sorteada" : running === c.id ? "Sorteando..." : "Realizar Sorteio"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar sorteio</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acao e definitiva. Serao criadas as partidas para todos as 20 rodadas
                              (Mandantes x Visitantes, Lado A com A, Lado B com B).
                              {!firstRoundDate && (
                                <span className="block mt-2 text-destructive font-medium">
                                  Atencao: voce nao informou a data da rodada 1!
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDraw(c.id)}>
                              Executar sorteio
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Fill progress */}
                  {s && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Equipes aprovadas</span>
                        <span className="font-mono">{s.total_approved} / {s.max_teams}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={pct >= 100 ? "h-full bg-emerald-500" : "h-full bg-primary"}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>Mand. A: <b className="text-foreground">{s.host_a_approved}</b>/{Math.floor(c.host_slots / 2)}</span>
                        <span>Mand. B: <b className="text-foreground">{s.host_b_approved}</b>/{Math.ceil(c.host_slots / 2)}</span>
                        <span>Visit. A: <b className="text-foreground">{s.visitor_a_approved}</b>/{Math.floor(c.visitor_slots / 2)}</span>
                        <span>Visit. B: <b className="text-foreground">{s.visitor_b_approved}</b>/{Math.ceil(c.visitor_slots / 2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
