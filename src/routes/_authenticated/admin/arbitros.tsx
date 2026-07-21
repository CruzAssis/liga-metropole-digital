import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListReferees,
  adminUpsertReferee,
  adminDeleteReferee,
  adminListAssignments,
  adminAssignReferee,
  adminRemoveAssignment,
  type RefereeRow,
  type MatchAssignmentRow,
} from "@/lib/referees.functions";
import { adminListMatches } from "@/lib/admin-matches.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gavel, Users, X, ArrowLeft } from "lucide-react";
import { SkeletonAdminList } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/arbitros")({
  component: AdminArbitrosPage,
});

const ROLE_LABEL: Record<string, string> = {
  principal: "Principal",
  assistente_1: "Assistente 1",
  assistente_2: "Assistente 2",
  mesa: "Mesa",
  reserva: "Reserva",
};

type FormState = {
  id?: string;
  full_name: string;
  nickname: string;
  whatsapp: string;
  city: string;
  photo_url: string;
  notes: string;
  active: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  nickname: "",
  whatsapp: "",
  city: "",
  photo_url: "",
  notes: "",
  active: true,
};

function AdminArbitrosPage() {
  const [tab, setTab] = useState<"lista" | "escala">("lista");
  const [items, setItems] = useState<RefereeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const list = useServerFn(adminListReferees);
  const upsert = useServerFn(adminUpsertReferee);
  const remove = useServerFn(adminDeleteReferee);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await list());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(r: RefereeRow) {
    setForm({
      id: r.id,
      full_name: r.full_name,
      nickname: r.nickname ?? "",
      whatsapp: r.whatsapp ?? "",
      city: r.city ?? "",
      photo_url: r.photo_url ?? "",
      notes: r.notes ?? "",
      active: r.active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.full_name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: form.id,
          full_name: form.full_name.trim(),
          nickname: form.nickname.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          city: form.city.trim() || null,
          photo_url: form.photo_url.trim() || null,
          notes: form.notes.trim() || null,
          active: form.active,
        } as any,
      });
      toast.success(form.id ? "Árbitro atualizado" : "Árbitro cadastrado");
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: RefereeRow) {
    if (!confirm(`Excluir o árbitro "${r.full_name}"?`)) return;
    try {
      await remove({ data: { id: r.id } });
      toast.success("Árbitro excluído");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/dashboard">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
      </Button>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-black">Central de Árbitros</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro, escala e avaliações.</p>
        </div>
        {tab === "lista" && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo árbitro
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "lista" ? "default" : "outline"} size="sm" onClick={() => setTab("lista")}>
          <Users className="h-4 w-4 mr-1" /> Cadastro
        </Button>
        <Button variant={tab === "escala" ? "default" : "outline"} size="sm" onClick={() => setTab("escala")}>
          <Gavel className="h-4 w-4 mr-1" /> Escala por partida
        </Button>
      </div>

      {tab === "lista" ? (
        loading ? (
          <SkeletonAdminList rows={5} />
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Gavel className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="font-semibold">Nenhum árbitro cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro para poder escalar em partidas.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                {r.photo_url ? (
                  <img src={r.photo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Gavel className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate flex items-center gap-2">
                    {r.full_name}
                    {r.nickname && <span className="text-xs text-muted-foreground">"{r.nickname}"</span>}
                    {!r.active && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[r.city, r.whatsapp].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(r)}
                  className="text-muted-foreground hover:text-primary p-2"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  className="text-muted-foreground hover:text-destructive p-2"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <EscalaTab referees={items.filter((r) => r.active)} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar árbitro" : "Novo árbitro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Apelido</Label>
                <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="11999999999"
              />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="active" />
              <Label htmlFor="active">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Escala tab ---
function EscalaTab({ referees }: { referees: RefereeRow[] }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [assignments, setAssignments] = useState<MatchAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("principal");
  const [refereeId, setRefereeId] = useState<string>("");

  const listMatchesFn = useServerFn(adminListMatches);
  const listAssignFn = useServerFn(adminListAssignments);
  const assignFn = useServerFn(adminAssignReferee);
  const removeAssignFn = useServerFn(adminRemoveAssignment);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await listMatchesFn();
        setMatches(rows as any[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, [listMatchesFn]);

  const loadAssignments = useCallback(
    async (mid: string) => {
      if (!mid) {
        setAssignments([]);
        return;
      }
      try {
        setAssignments(await listAssignFn({ data: { match_id: mid } }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      }
    },
    [listAssignFn],
  );

  useEffect(() => {
    loadAssignments(selectedMatch);
  }, [selectedMatch, loadAssignments]);

  async function handleAssign() {
    if (!selectedMatch || !refereeId) {
      toast.error("Selecione partida e árbitro");
      return;
    }
    try {
      await assignFn({ data: { match_id: selectedMatch, referee_id: refereeId, role: role as any } });
      toast.success("Árbitro escalado");
      setRefereeId("");
      await loadAssignments(selectedMatch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover essa escalação?")) return;
    try {
      await removeAssignFn({ data: { id } });
      await loadAssignments(selectedMatch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  if (loading) return <SkeletonAdminList rows={4} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <Label className="mb-2 block">Partida</Label>
        <Select value={selectedMatch} onValueChange={setSelectedMatch}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar partida" />
          </SelectTrigger>
          <SelectContent>
            {matches.slice(0, 100).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>
                {(m.host_name ?? m.host?.name ?? "?") + " × " + (m.visitor_name ?? m.visitor?.name ?? "?")}
                {m.scheduled_at ? ` — ${new Date(m.scheduled_at).toLocaleString()}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMatch && (
        <>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold">Escalar árbitro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={refereeId} onValueChange={setRefereeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Árbitro" />
                </SelectTrigger>
                <SelectContent>
                  {referees.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign}>
                <Plus className="h-4 w-4 mr-1" /> Escalar
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold mb-3">Escala atual</h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum árbitro escalado.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 border-b border-border/50 pb-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                      {ROLE_LABEL[a.role] ?? a.role}
                    </span>
                    <span className="flex-1 truncate">{a.referee?.full_name ?? "—"}</span>
                    <button
                      onClick={() => handleRemove(a.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      aria-label="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
