import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListVenues,
  adminUpsertVenue,
  adminDeleteVenue,
  type VenueRow,
} from "@/lib/venues.functions";
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
import { Plus, Pencil, Trash2, MapPin, ExternalLink } from "lucide-react";
import { SkeletonAdminList } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/locais")({
  component: AdminLocaisPage,
});

type FormState = {
  id?: string;
  name: string;
  address: string;
  subprefeitura: string;
  bairro: string;
  lado: "" | "A" | "B";
  maps_link: string;
  photo_url: string;
  notes: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  address: "",
  subprefeitura: "",
  bairro: "",
  lado: "",
  maps_link: "",
  photo_url: "",
  notes: "",
  active: true,
};

function AdminLocaisPage() {
  const [items, setItems] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const list = useServerFn(adminListVenues);
  const upsert = useServerFn(adminUpsertVenue);
  const remove = useServerFn(adminDeleteVenue);

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

  function openEdit(v: VenueRow) {
    setForm({
      id: v.id,
      name: v.name,
      address: v.address ?? "",
      subprefeitura: v.subprefeitura ?? "",
      bairro: v.bairro ?? "",
      lado: (v.lado ?? "") as "" | "A" | "B",
      maps_link: v.maps_link ?? "",
      photo_url: v.photo_url ?? "",
      notes: v.notes ?? "",
      active: v.active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do local");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: form.id,
          name: form.name.trim(),
          address: form.address.trim() || null,
          subprefeitura: form.subprefeitura.trim() || null,
          bairro: form.bairro.trim() || null,
          lado: form.lado || null,
          maps_link: form.maps_link.trim() || null,
          photo_url: form.photo_url.trim() || null,
          notes: form.notes.trim() || null,
          active: form.active,
        } as any,
      });
      toast.success(form.id ? "Local atualizado" : "Local criado");
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: VenueRow) {
    if (!confirm(`Excluir o local "${v.name}"?`)) return;
    try {
      await remove({ data: { id: v.id } });
      toast.success("Local excluído");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-black">Locais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campos e ginásios exibidos publicamente na página /locais.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo local
        </Button>
      </div>

      {loading ? (
        <SkeletonAdminList rows={5} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhum local cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro para exibir na página pública.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              {v.photo_url ? (
                <img src={v.photo_url} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-2">
                  {v.name}
                  {!v.active && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      inativo
                    </span>
                  )}
                  {v.lado && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Lado {v.lado}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[v.subprefeitura, v.bairro, v.address].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {v.maps_link && (
                <a
                  href={v.maps_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-primary p-2"
                  aria-label="Abrir no mapa"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => openEdit(v)}
                className="text-muted-foreground hover:text-primary p-2"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(v)}
                className="text-muted-foreground hover:text-destructive p-2"
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar local" : "Novo local"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subprefeitura</Label>
                <Input
                  value={form.subprefeitura}
                  onChange={(e) => setForm({ ...form, subprefeitura: e.target.value })}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lado</Label>
                <Select
                  value={form.lado || "none"}
                  onValueChange={(v) => setForm({ ...form, lado: v === "none" ? "" : (v as "A" | "B") })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="A">Lado A</SelectItem>
                    <SelectItem value="B">Lado B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                  id="active"
                />
                <Label htmlFor="active">Ativo (visível ao público)</Label>
              </div>
            </div>
            <div>
              <Label>Link do mapa (Google Maps)</Label>
              <Input
                value={form.maps_link}
                onChange={(e) => setForm({ ...form, maps_link: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
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
