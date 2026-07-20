import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListAthletes, adminUpdateAthlete, adminDeleteAthlete } from "@/lib/admin-athletes.functions";
import { listAdminTeams } from "@/lib/admin-teams.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/atletas")({
  component: AdminAthletes,
});

function AdminAthletes() {
  const listFn = useServerFn(adminListAthletes);
  const updFn = useServerFn(adminUpdateAthlete);
  const delFn = useServerFn(adminDeleteAthlete);
  const teamsFn = useServerFn(listAdminTeams);

  const { data = [], isLoading, refetch } = useQuery({ queryKey: ["admin", "athletes"], queryFn: () => listFn() });
  const { data: teams = [] } = useQuery({ queryKey: ["admin", "teams"], queryFn: () => teamsFn() });

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("todos");
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data as any[]).filter((a) => {
      const matchesQ = !q || a.full_name?.toLowerCase().includes(q) || a.nickname?.toLowerCase().includes(q);
      const matchesTeam = teamFilter === "todos" || a.team_id === teamFilter;
      return matchesQ && matchesTeam;
    });
  }, [data, search, teamFilter]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await updFn({ data: {
        id: editing.id,
        full_name: editing.full_name,
        nickname: editing.nickname,
        position: editing.position,
        whatsapp: editing.whatsapp || null,
        team_id: editing.team_id || null,
        verified: !!editing.verified,
      } });
      toast.success("Atleta atualizado");
      setEditing(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await delFn({ data: { id: deleting.id } });
      toast.success("Atleta removido");
      setDeleting(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Gestão de Atletas</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou apelido..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="Time" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os times</SelectItem>
            {(teams as any[]).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Nenhum atleta encontrado.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-3">Atleta</th>
                <th className="text-left p-3 hidden md:table-cell">Time</th>
                <th className="text-left p-3 hidden sm:table-cell">Posição</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: any) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{a.full_name || <span className="text-muted-foreground italic">Sem nome</span>}</div>
                    {a.nickname && <div className="text-xs text-muted-foreground">"{a.nickname}"</div>}
                  </td>
                  <td className="p-3 hidden md:table-cell">{a.teams?.name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 hidden sm:table-cell">{a.position || "—"}</td>
                  <td className="p-3">
                    {a.verified ? <Badge className="bg-green-600">Verificado</Badge> : <Badge variant="outline">Pendente</Badge>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...a })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>Editar atleta</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={editing.full_name || ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div><Label>Apelido</Label><Input value={editing.nickname || ""} onChange={(e) => setEditing({ ...editing, nickname: e.target.value })} /></div>
              <div><Label>Posição</Label><Input value={editing.position || ""} onChange={(e) => setEditing({ ...editing, position: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={editing.whatsapp || ""} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></div>
              <div>
                <Label>Time</Label>
                <Select value={editing.team_id || ""} onValueChange={(v) => setEditing({ ...editing, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o time" /></SelectTrigger>
                  <SelectContent>
                    {(teams as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.verified} onChange={(e) => setEditing({ ...editing, verified: e.target.checked })} />
                Verificado
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atleta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {deleting?.full_name || deleting?.nickname} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
