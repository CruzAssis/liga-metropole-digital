import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListMedia,
  upsertMedia,
  deleteMedia,
  type MediaItem,
  type MediaKind,
  type MediaPlatform,
} from "@/lib/media.functions";
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
import { Plus, Pencil, Trash2, Image as ImageIcon, Video, Sparkles, ExternalLink } from "lucide-react";
import { SkeletonAdminList } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/midia")({
  component: AdminMidiaPage,
  head: () => ({ meta: [{ title: "Mídia • Admin" }] }),
});

type FormState = {
  id?: string;
  kind: MediaKind;
  platform: MediaPlatform;
  url: string;
  thumbnail_url: string;
  title: string;
  caption: string;
  credit: string;
  team_id: string;
  match_id: string;
  competition_id: string;
  round_number: string;
  is_featured: boolean;
  is_published: boolean;
  display_order: string;
};

const emptyForm: FormState = {
  kind: "photo",
  platform: "upload",
  url: "",
  thumbnail_url: "",
  title: "",
  caption: "",
  credit: "",
  team_id: "",
  match_id: "",
  competition_id: "",
  round_number: "",
  is_featured: false,
  is_published: true,
  display_order: "0",
};

function KindIcon({ kind }: { kind: MediaKind }) {
  if (kind === "video") return <Video className="h-5 w-5 text-muted-foreground" />;
  if (kind === "embed") return <Sparkles className="h-5 w-5 text-muted-foreground" />;
  return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
}

function AdminMidiaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const list = useServerFn(adminListMedia);
  const upsert = useServerFn(upsertMedia);
  const remove = useServerFn(deleteMedia);

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

  function openEdit(m: MediaItem) {
    setForm({
      id: m.id,
      kind: m.kind,
      platform: (m.platform ?? "upload") as MediaPlatform,
      url: m.url,
      thumbnail_url: m.thumbnail_url ?? "",
      title: m.title ?? "",
      caption: m.caption ?? "",
      credit: m.credit ?? "",
      team_id: m.team_id ?? "",
      match_id: m.match_id ?? "",
      competition_id: m.competition_id ?? "",
      round_number: m.round_number != null ? String(m.round_number) : "",
      is_featured: m.is_featured,
      is_published: m.is_published,
      display_order: String(m.display_order ?? 0),
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.url.trim()) {
      toast.error("Informe a URL da mídia");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: form.id,
          kind: form.kind,
          platform: form.platform,
          url: form.url.trim(),
          thumbnail_url: form.thumbnail_url.trim() || null,
          title: form.title.trim() || null,
          caption: form.caption.trim() || null,
          credit: form.credit.trim() || null,
          team_id: form.team_id.trim() || null,
          match_id: form.match_id.trim() || null,
          competition_id: form.competition_id.trim() || null,
          round_number: form.round_number ? Number(form.round_number) : null,
          is_featured: form.is_featured,
          is_published: form.is_published,
          display_order: Number(form.display_order) || 0,
        } as any,
      });
      toast.success(form.id ? "Mídia atualizada" : "Mídia adicionada");
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: MediaItem) {
    if (!confirm(`Excluir "${m.title || m.url}"?`)) return;
    try {
      await remove({ data: { id: m.id } });
      toast.success("Mídia excluída");
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
          <h1 className="text-2xl sm:text-3xl font-black">Mídia & Conteúdo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fotos, vídeos e embeds (YouTube, Instagram) exibidos publicamente em /midia.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova mídia
        </Button>
      </div>

      {loading ? (
        <SkeletonAdminList rows={5} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhuma mídia cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione a primeira foto, vídeo ou post.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              {m.thumbnail_url || (m.kind === "photo" && m.platform === "upload") ? (
                <img
                  src={m.thumbnail_url || m.url}
                  alt=""
                  className="h-14 w-14 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded bg-muted flex items-center justify-center shrink-0">
                  <KindIcon kind={m.kind} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-2">
                  {m.title || m.url}
                  {m.is_featured && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Destaque
                    </span>
                  )}
                  {!m.is_published && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      rascunho
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.kind, m.platform, m.team?.name, m.round_number != null ? `Rodada ${m.round_number}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary p-2"
                aria-label="Abrir mídia"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => openEdit(m)}
                className="text-muted-foreground hover:text-primary p-2"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(m)}
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
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar mídia" : "Nova mídia"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as MediaKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="embed">Embed / Post</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plataforma</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v as MediaPlatform })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">Upload / URL direta</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="x">X (Twitter)</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL da mídia *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Para YouTube use o link do vídeo; para Instagram, a URL do post/reel.
              </p>
            </div>
            <div>
              <Label>Thumbnail (opcional)</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Legenda</Label>
              <Textarea
                rows={3}
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Crédito</Label>
                <Input value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
              </div>
              <div>
                <Label>Rodada</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.round_number}
                  onChange={(e) => setForm({ ...form, round_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Time (ID)</Label>
                <Input value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} />
              </div>
              <div>
                <Label>Partida (ID)</Label>
                <Input value={form.match_id} onChange={(e) => setForm({ ...form, match_id: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Competição (ID)</Label>
                <Input
                  value={form.competition_id}
                  onChange={(e) => setForm({ ...form, competition_id: e.target.value })}
                />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="feat"
                checked={form.is_featured}
                onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
              />
              <Label htmlFor="feat">Destaque da rodada</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="pub"
                checked={form.is_published}
                onCheckedChange={(v) => setForm({ ...form, is_published: v })}
              />
              <Label htmlFor="pub">Publicado (visível ao público)</Label>
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
