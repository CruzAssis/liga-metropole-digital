import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, Plus } from "lucide-react";
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
  draw_executed_at: string | null;
  created_at: string;
};

function SorteioPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSeason, setNewSeason] = useState<string>(String(new Date().getFullYear()));
  const [creating, setCreating] = useState(false);
  const drawFn = useServerFn(executeDraw);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitions")
      .select("id, name, status, draw_executed_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar competições", { description: error.message });
    else setCompetitions((data as Competition[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const seasonNum = parseInt(newSeason, 10);
    if (!Number.isFinite(seasonNum)) {
      toast.error("Temporada inválida");
      return;
    }
    setCreating(true);
    const { error } = await supabase
      .from("competitions")
      .insert({ name: newName.trim(), season: seasonNum });
    setCreating(false);
    if (error) {
      toast.error("Erro ao criar competição", { description: error.message });
      return;
    }
    toast.success("Competição criada");
    setNewName("");
    void load();
  };

  const handleDraw = async (id: string) => {
    setRunning(id);
    try {
      const result = await drawFn({ data: { competitionId: id } });
      toast.success("Sorteio executado!", {
        description: `${result.groups_created} grupos · ${result.matches_created} partidas`,
      });
      void load();
    } catch (err) {
      let msg = "Falha ao executar sorteio";
      if (err instanceof Response) {
        try {
          const body = await err.json();
          msg = body.error ?? msg;
          if (body.hosts !== undefined) msg += ` (mandantes: ${body.hosts}, visitantes: ${body.visitors})`;
        } catch { /* noop */ }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error("Erro", { description: msg });
    } finally {
      setRunning(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; className: string }> = {
      registration: { label: "Inscrições", className: "bg-yellow-500/20 text-yellow-300" },
      group_stage: { label: "Fase de Grupos", className: "bg-primary/20 text-primary" },
      knockout: { label: "Mata-mata", className: "bg-purple-500/20 text-purple-300" },
      finished: { label: "Finalizada", className: "bg-muted text-muted-foreground" },
    };
    const v = map[s] ?? { label: s, className: "bg-muted" };
    return <Badge className={v.className}>{v.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Sorteio</h1>
        <p className="text-muted-foreground">
          Gere os grupos e o calendário das 400 partidas a partir dos times aprovados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova competição</CardTitle>
          <CardDescription>Crie a competição antes de executar o sorteio.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Nome da competição (ex: Liga Metrópole 2026)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Criar
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Competições</h2>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : competitions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma competição criada ainda.</p>
        ) : (
          competitions.map((c) => {
            const drawn = c.draw_executed_at !== null;
            return (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {statusBadge(c.status)}
                    </div>
                    {drawn && (
                      <p className="text-xs text-muted-foreground">
                        Sorteio em {new Date(c.draw_executed_at!).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={drawn || running === c.id}>
                        <Shuffle className="h-4 w-4 mr-1" />
                        {drawn ? "Já sorteada" : running === c.id ? "Sorteando..." : "Executar Sorteio"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar sorteio</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é definitiva e não pode ser desfeita. Serão criados 16 grupos e 400 partidas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDraw(c.id)}>
                          Executar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
