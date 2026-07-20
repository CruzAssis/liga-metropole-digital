import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListMatches, adminUpdateMatch, adminAnnulMatch } from "@/lib/admin-matches.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Search, Calendar, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/partidas")({
  component: AdminPartidas,
});

const STATUSES = ["scheduled", "awaiting_confirmation", "confirmed", "closed", "disputed", "wo", "cancelled"] as const;

function statusBadge(s: string) {
  const map: Record<string, string> = {
    scheduled: "bg-yellow-500 text-black",
    awaiting_confirmation: "bg-blue-600 text-white",
    confirmed: "bg-green-600 text-white",
    closed: "bg-emerald-700 text-white",
    disputed: "bg-red-600 text-white",
    wo: "bg-zinc-600 text-white",
    cancelled: "bg-zinc-500 text-white",
  };
  return <Badge className={map[s] || ""}>{s}</Badge>;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function AdminPartidas() {
  const listFn = useServerFn(adminListMatches);
  const updFn = useServerFn(adminUpdateMatch);
  const annulFn = useServerFn(adminAnnulMatch);

  const { data = [], isLoading, refetch } = useQuery({ queryKey: ["admin", "matches"], queryFn: () => listFn() });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editing, setEditing] = useState<any>(null);
  const [annulling, setAnnulling] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data as any[]).filter((m) => {
      const names = `${m.host?.name || ""} ${m.visitor?.name || ""}`.toLowerCase();
      const matchQ = !q || names.includes(q);
      const matchS = statusFilter === "todos" || m.status === statusFilter;
      return matchQ && matchS;
    });
  }, [data, search, statusFilter]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await updFn({ data: {
        id: editing.id,
        scheduled_at: editing.scheduled_at || null,
        venue: editing.venue || null,
        host_score: editing.host_score === "" || editing.host_score == null ? null : Number(editing.host_score),
        visitor_score: editing.visitor_score === "" || editing.visitor_score == null ? null : Number(editing.visitor_score),
        status: editing.status,
      } });
      toast.success("Partida atualizada");
      setEditing(null);
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function annul() {
    if (!annulling) return;
    setBusy(true);
    try {
      await annulFn({ data: { id: annulling.id } });
      toast.success("Partida anulada");
      setAnnulling(null);
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Gestão de Partidas</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por time..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Nenhuma partida encontrada.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-3">Confronto</th>
                <th className="text-left p-3 hidden md:table-cell">Data</th>
                <th className="text-left p-3">Placar</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m: any) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{m.host?.name || "?"} vs {m.visitor?.name || "?"}</div>
                    <div className="text-xs text-muted-foreground">{m.stage || ""} {m.round ? `• Rodada ${m.round}` : ""}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3 font-mono">{m.host_score ?? "-"} × {m.visitor_score ?? "-"}</td>
                  <td className="p-3">{statusBadge(m.status)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost"><Link to="/sumula/$partidaId" params={{ partidaId: m.id }}><Eye className="h-4 w-4" /></Link></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...m, scheduled_at: toLocalInput(m.scheduled_at) })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setAnnulling(m)}><RotateCcw className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar partida</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={editing.scheduled_at || ""} onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div><Label>Local</Label><Input value={editing.venue || ""} onChange={(e) => setEditing({ ...editing, venue: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gols Mandante</Label><Input type="number" min={0} value={editing.host_score ?? ""} onChange={(e) => setEditing({ ...editing, host_score: e.target.value })} /></div>
                <div><Label>Gols Visitante</Label><Input type="number" min={0} value={editing.visitor_score ?? ""} onChange={(e) => setEditing({ ...editing, visitor_score: e.target.value })} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!annulling} onOpenChange={(o) => !o && setAnnulling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular partida?</AlertDialogTitle>
            <AlertDialogDescription>
              O placar e o status serão resetados. A partida voltará para "scheduled".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={annul} disabled={busy}>Anular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
