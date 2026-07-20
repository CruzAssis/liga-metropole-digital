import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Users, CheckCircle, AlertTriangle, MapPin, Trash2 } from "lucide-react";
import { Spinner, SkeletonAdminCardList } from "@/components/AppSkeletons";

const supabaseAny = supabase as any;

export const Route = createFileRoute("/_authenticated/admin/ligas")({
  component: LigasPage,
});

// ── Subprefeituras de SP mapeadas para conferências ──────────────────────────
type Subprefeitura = {
  label: string;
  zona: "norte" | "sul" | "leste" | "oeste" | "centro";
  conference_number: number;
  conference_name: string;
};

const SUBPREFEITURAS: Subprefeitura[] = [
  // Zona Norte
  { label: "Vila Maria/Vila Guilherme", zona: "norte", conference_number: 1, conference_name: "Conferência Norte 1" },
  { label: "Santana/Tucuruvi",          zona: "norte", conference_number: 2, conference_name: "Conferência Norte 2" },
  { label: "Casa Verde",                zona: "norte", conference_number: 3, conference_name: "Conferência Norte 3" },
  { label: "Jaçanã/Tremembé",           zona: "norte", conference_number: 4, conference_name: "Conferência Norte 4" },
  { label: "Perus/Anhanguera",          zona: "norte", conference_number: 5, conference_name: "Conferência Norte 5" },
  { label: "Pirituba/Jaraguá",          zona: "norte", conference_number: 6, conference_name: "Conferência Norte 6" },
  { label: "Freguesia/Brasilândia",     zona: "norte", conference_number: 7, conference_name: "Conferência Norte 7" },
  // Zona Leste
  { label: "Penha",                     zona: "leste", conference_number: 1,  conference_name: "Conferência Leste 1" },
  { label: "Mooca",                     zona: "leste", conference_number: 2,  conference_name: "Conferência Leste 2" },
  { label: "Vila Prudente",             zona: "leste", conference_number: 3,  conference_name: "Conferência Leste 3" },
  { label: "Aricanduva",                zona: "leste", conference_number: 4,  conference_name: "Conferência Leste 4" },
  { label: "Sapopemba",                 zona: "leste", conference_number: 5,  conference_name: "Conferência Leste 5" },
  { label: "São Mateus",                zona: "leste", conference_number: 6,  conference_name: "Conferência Leste 6" },
  { label: "Itaquera",                  zona: "leste", conference_number: 7,  conference_name: "Conferência Leste 7" },
  { label: "Guaianases",                zona: "leste", conference_number: 8,  conference_name: "Conferência Leste 8" },
  { label: "Cidade Tiradentes",         zona: "leste", conference_number: 9,  conference_name: "Conferência Leste 9" },
  { label: "Ermelino Matarazzo",        zona: "leste", conference_number: 10, conference_name: "Conferência Leste 10" },
  { label: "Itaim Paulista",            zona: "leste", conference_number: 11, conference_name: "Conferência Leste 11" },
  { label: "São Miguel",                zona: "leste", conference_number: 12, conference_name: "Conferência Leste 12" },
  // Zona Sul
  { label: "Ipiranga",                  zona: "sul", conference_number: 1, conference_name: "Conferência Sul 1" },
  { label: "Vila Mariana",              zona: "sul", conference_number: 2, conference_name: "Conferência Sul 2" },
  { label: "Jabaquara",                 zona: "sul", conference_number: 3, conference_name: "Conferência Sul 3" },
  { label: "Cidade Ademar",             zona: "sul", conference_number: 4, conference_name: "Conferência Sul 4" },
  { label: "Santo Amaro",               zona: "sul", conference_number: 5, conference_name: "Conferência Sul 5" },
  { label: "Campo Limpo",               zona: "sul", conference_number: 6, conference_name: "Conferência Sul 6" },
  { label: "M'Boi Mirim",               zona: "sul", conference_number: 7, conference_name: "Conferência Sul 7" },
  { label: "Parelheiros",               zona: "sul", conference_number: 8, conference_name: "Conferência Sul 8" },
  { label: "Capela do Socorro",         zona: "sul", conference_number: 9, conference_name: "Conferência Sul 9" },
  // Zona Oeste
  { label: "Lapa",                      zona: "oeste", conference_number: 1, conference_name: "Conferência Oeste 1" },
  { label: "Pinheiros",                 zona: "oeste", conference_number: 2, conference_name: "Conferência Oeste 2" },
  { label: "Butantã",                   zona: "oeste", conference_number: 3, conference_name: "Conferência Oeste 3" },
  // Centro
  { label: "Sé",                        zona: "centro", conference_number: 1, conference_name: "Conferência Centro" },
];

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte",
  sul: "Zona Sul",
  leste: "Zona Leste",
  oeste: "Zona Oeste",
  centro: "Centro",
};

type Competition = {
  id: string;
  name: string;
  season: number | null;
  status: string;
  registration_status: string;
  max_teams: number;
  host_slots: number;
  visitor_slots: number;
  starts_at: string | null;
  draw_executed_at: string | null;
  full_notified_at: string | null;
  created_at: string;
  conference_name: string | null;
  subprefeitura: string | null;
  zona: string | null;
  conference_number: number | null;
  qualified_count: number;
  qualified_per_group: number;
  relegated_count: number;
  use_sides: boolean;
  double_round: boolean;
  points_win: number;
  points_draw: number;
  points_loss: number;
  regulation_notes: string | null;
};


type FillStats = {
  total_approved: number;
  host_a_approved: number;
  host_b_approved: number;
  visitor_a_approved: number;
  visitor_b_approved: number;
  max_teams: number;
  host_slots: number;
  visitor_slots: number;
  is_full: boolean;
  registration_status: string;
};


const REG_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open:      { label: "Aberta",         cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  closed:    { label: "Fechada",        cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  draw_ready:{ label: "Sorteio OK!",    cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  active:    { label: "Em andamento",   cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished:  { label: "Encerrada",      cls: "bg-muted text-muted-foreground border-border" },
};

const emptyForm = {
  subprefeitura: "",
  name: "",
  season: String(new Date().getFullYear()),
  max_teams: "80",
  host_slots: "40",
  visitor_slots: "40",
  starts_at: "",
  registration_status: "open",
  qualified_count: "8",
  qualified_per_group: "2",
  relegated_count: "10",
  use_sides: true,
  double_round: false,
  points_win: "3",
  points_draw: "1",
  points_loss: "0",
  yellows_for_suspension: "3",
  red_suspension_games: "1",
  direct_red_suspension_games: "2",
  regulation_notes: "",
};



function LigasPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [stats, setStats] = useState<Record<string, FillStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitions")
      .select("id,name,season,status,registration_status,max_teams,host_slots,visitor_slots,starts_at,draw_executed_at,full_notified_at,created_at,conference_name,subprefeitura,zona,conference_number,qualified_count,qualified_per_group,relegated_count,use_sides,double_round,points_win,points_draw,points_loss,regulation_notes")

      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar ligas");
    else {
      const list = (data ?? []) as unknown as Competition[];
      setCompetitions(list);
      const statsMap: Record<string, FillStats> = {};
      await Promise.all(
        list.map(async (c) => {
          const { data: s } = await supabase.rpc("competition_fill_stats", { _competition_id: c.id });
          if (s && s.length > 0) statsMap[c.id] = s[0] as FillStats;
        }),
      );
      setStats(statsMap);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // When subprefeitura is selected, auto-fill conference fields
  const handleSubprefeituraChange = (label: string) => {
    const sp = SUBPREFEITURAS.find((s) => s.label === label);
    if (sp) {
      setForm((f) => ({
        ...f,
        subprefeitura: label,
        name: sp.conference_name,
      }));
    } else {
      setForm((f) => ({ ...f, subprefeitura: label }));
    }
  };

  const handleEdit = (c: Competition) => {
    setEditId(c.id);
    setForm({
      subprefeitura: c.subprefeitura ?? "",
      name: c.name,
      season: c.season != null ? String(c.season) : "",
      max_teams: String(c.max_teams),
      host_slots: String(c.host_slots),
      visitor_slots: String(c.visitor_slots),
      starts_at: c.starts_at ?? "",
      registration_status: c.registration_status,
      qualified_count: String(c.qualified_count ?? 8),
      qualified_per_group: String((c as any).qualified_per_group ?? 2),
      relegated_count: String(c.relegated_count ?? 10),
      use_sides: c.use_sides ?? true,
      double_round: (c as any).double_round ?? false,
      points_win: String((c as any).points_win ?? 3),
      points_draw: String((c as any).points_draw ?? 1),
      points_loss: String((c as any).points_loss ?? 0),
      regulation_notes: c.regulation_notes ?? "",
    });

  };


  const handleCancel = () => {
    setEditId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome da liga"); return; }
    const max = parseInt(form.max_teams, 10);
    const host = parseInt(form.host_slots, 10);
    const visitor = parseInt(form.visitor_slots, 10);
    const qualified = parseInt(form.qualified_count, 10);
    const relegated = parseInt(form.relegated_count, 10);
    if (!max || !host || !visitor) { toast.error("Números de vagas inválidos"); return; }
    if (host + visitor !== max) { toast.error(`Vagas Mandante (${host}) + Visitante (${visitor}) deve somar ${max}`); return; }
    if (isNaN(qualified) || qualified < 0) { toast.error("Quantidade de classificados inválida"); return; }
    if (isNaN(relegated) || relegated < 0) { toast.error("Quantidade de rebaixados inválida"); return; }
    if (qualified + relegated > max) { toast.error(`Classificados (${qualified}) + Rebaixados (${relegated}) não podem exceder ${max} times`); return; }

    setSaving(true);
    try {
      const sp = SUBPREFEITURAS.find((s) => s.label === form.subprefeitura);
      const payload = {
        name: form.name.trim(),
        season: form.season.trim() ? parseInt(form.season.trim(), 10) : new Date().getFullYear(),
        max_teams: max,
        host_slots: host,
        visitor_slots: visitor,
        starts_at: form.starts_at || null,
        registration_status: form.registration_status,
        subprefeitura: form.subprefeitura || null,
        conference_name: sp?.conference_name ?? form.name.trim(),
        zona: sp?.zona ?? null,
        conference_number: sp?.conference_number ?? null,
        qualified_count: qualified,
        qualified_per_group: parseInt(form.qualified_per_group, 10) || 2,
        relegated_count: relegated,
        use_sides: form.use_sides,
        double_round: form.double_round,
        points_win: parseInt(form.points_win, 10) || 3,
        points_draw: parseInt(form.points_draw, 10) || 1,
        points_loss: parseInt(form.points_loss, 10) || 0,
        regulation_notes: form.regulation_notes.trim() || null,
      };



      if (editId) {
        const { error } = await supabaseAny.from("competitions").update(payload).eq("id", editId);
        if (error) toast.error("Erro ao salvar", { description: error.message });
        else { toast.success("Liga atualizada"); handleCancel(); void load(); }
      } else {
        const { error } = await supabaseAny.from("competitions").insert({ ...payload, status: "enrollment" });
        if (error) toast.error("Erro ao criar liga", { description: error.message });
        else { toast.success("Liga criada!"); handleCancel(); void load(); }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado ao salvar';
      toast.error('Erro ao salvar liga', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: Competition) => {
    const next = c.registration_status === "open" ? "closed" : "open";
    const { error } = await supabase.from("competitions").update({ registration_status: next }).eq("id", c.id);
    if (error) toast.error("Erro ao alterar status");
    else { toast.success(`Liga ${next === "open" ? "reaberta" : "fechada"} para inscrições`); void load(); }
  };

  const handleDelete = async (c: Competition) => {
    if (!confirm(`Excluir a liga "${c.conference_name ?? c.name}"?\n\nEssa ação removerá a competição permanentemente. Times, partidas e grupos vinculados podem ser afetados.`)) return;
    const { error } = await supabaseAny.from("competitions").delete().eq("id", c.id);
    if (error) toast.error("Erro ao excluir liga", { description: error.message });
    else { toast.success("Liga excluída"); void load(); }
  };

  // Group subprefeituras by zona for the dropdown optgroups
  const zonas = ["norte", "leste", "sul", "oeste", "centro"] as const;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">Configuração de Conferências</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Crie e configure conferências por subprefeitura. A Liga Metrópole cobre 32 subprefeituras de SP.
        </p>
      </div>


      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editId ? <Settings className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editId ? "Editar conferência" : "Nova conferência"}
          </CardTitle>
          <CardDescription>
            Selecione a subprefeitura — o nome da conferência é preenchido automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Subprefeitura dropdown */}
            <div className="sm:col-span-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Subprefeitura</Label>
              <select
                value={form.subprefeitura}
                onChange={(e) => handleSubprefeituraChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              >
                <option value="">— Selecione a subprefeitura —</option>
                {zonas.map((zona) => (
                  <optgroup key={zona} label={ZONA_LABELS[zona]}>
                    {SUBPREFEITURAS.filter((s) => s.zona === zona).map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.conference_name} — {s.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {form.subprefeitura && (() => {
                const sp = SUBPREFEITURAS.find((s) => s.label === form.subprefeitura);
                return sp ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {sp.conference_name} · {ZONA_LABELS[sp.zona]}
                  </p>
                ) : null;
              })()}
            </div>

            <div className="sm:col-span-2">
              <Label>Nome da conferência / liga</Label>
              <Input
                placeholder="Preenchido automaticamente pela subprefeitura"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Temporada</Label>
              <Input
                placeholder="2026"
                value={form.season}
                onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data de início prevista</Label>
              <Input
                type="date"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Total máximo de equipes</Label>
              <Input
                type="number"
                min={2}
                value={form.max_teams}
                onChange={(e) => setForm((f) => ({ ...f, max_teams: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status de inscrições</Label>
              <select
                value={form.registration_status}
                onChange={(e) => setForm((f) => ({ ...f, registration_status: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="open">Aberta para inscrições</option>
                <option value="closed">Fechada</option>
                <option value="draw_ready">Pronta para sorteio</option>
                <option value="active">Em andamento</option>
                <option value="finished">Encerrada</option>
              </select>
            </div>
            <div>
              <Label>Vagas para Mandantes</Label>
              <Input
                type="number"
                min={1}
                value={form.host_slots}
                onChange={(e) => setForm((f) => ({ ...f, host_slots: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Dividido automaticamente em Lado A e B</p>
            </div>
            <div>
              <Label>Vagas para Visitantes</Label>
              <Input
                type="number"
                min={1}
                value={form.visitor_slots}
                onChange={(e) => setForm((f) => ({ ...f, visitor_slots: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Dividido automaticamente em Lado A e B</p>
            </div>

            {/* Divisão por Lado A/B */}
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3 flex items-start gap-3">
              <input
                id="use_sides"
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.use_sides}
                onChange={(e) => setForm((f) => ({ ...f, use_sides: e.target.checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="use_sides" className="cursor-pointer">
                  Dividir times em Lado A e Lado B
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.use_sides
                    ? "Formato Liga Metrópole: confrontos apenas dentro do mesmo Lado, ranking separado por Lado."
                    : "Formato único: todos os times concorrem juntos, sem separação por Lado."}
                </p>
              </div>
            </div>

            {/* Classificação e rebaixamento */}
            <div>
              <Label>Times classificados (mata-mata)</Label>
              <Input
                type="number"
                min={0}
                value={form.qualified_count}
                onChange={(e) => setForm((f) => ({ ...f, qualified_count: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Quantos times do topo avançam para a fase eliminatória (0 = sem mata-mata).
              </p>
            </div>
            <div>
              <Label>Classificados por grupo</Label>
              <Input
                type="number"
                min={0}
                value={form.qualified_per_group}
                onChange={(e) => setForm((f) => ({ ...f, qualified_per_group: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Quantos times de cada grupo avançam para a próxima fase (ex.: 2 = os 2 melhores de cada grupo).
              </p>
            </div>
            <div>
              <Label>Times rebaixados</Label>
              <Input
                type="number"
                min={0}
                value={form.relegated_count}
                onChange={(e) => setForm((f) => ({ ...f, relegated_count: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Quantos times do final da tabela caem de divisão (0 = sem rebaixamento).
              </p>
            </div>

            {/* Formato de disputa */}
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3 flex items-start gap-3">
              <input
                id="double_round"
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.double_round}
                onChange={(e) => setForm((f) => ({ ...f, double_round: e.target.checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="double_round" className="cursor-pointer">
                  Turno e returno (ida e volta)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.double_round
                    ? "Cada dupla de times se enfrenta duas vezes (mando invertido no returno)."
                    : "Turno único: cada dupla de times se enfrenta apenas uma vez."}
                </p>
              </div>
            </div>

            {/* Pontuação */}
            <div>
              <Label>Pontos por vitória</Label>
              <Input
                type="number"
                min={0}
                value={form.points_win}
                onChange={(e) => setForm((f) => ({ ...f, points_win: e.target.value }))}
              />
            </div>
            <div>
              <Label>Pontos por empate</Label>
              <Input
                type="number"
                min={0}
                value={form.points_draw}
                onChange={(e) => setForm((f) => ({ ...f, points_draw: e.target.value }))}
              />
            </div>
            <div>
              <Label>Pontos por derrota</Label>
              <Input
                type="number"
                min={0}
                value={form.points_loss}
                onChange={(e) => setForm((f) => ({ ...f, points_loss: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Normalmente 0.</p>
            </div>

            <div className="sm:col-span-2">
              <Label>Regulamento / observações</Label>
              <textarea
                rows={4}
                value={form.regulation_notes}
                onChange={(e) => setForm((f) => ({ ...f, regulation_notes: e.target.value }))}
                placeholder="Regras específicas desta liga (critérios de desempate, disciplina, W.O., etc.)"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>


            {/* Feedback dinâmico */}
            {(() => {
              const max = parseInt(form.max_teams, 10) || 0;
              const q = parseInt(form.qualified_count, 10) || 0;
              const r = parseInt(form.relegated_count, 10) || 0;
              if (max <= 0) return null;
              const ok = q + r <= max;
              return (
                <div className={`sm:col-span-2 rounded-md p-3 text-sm ${ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-red-500/10 text-red-300 border border-red-500/30"}`}>
                  {ok ? (
                    <>Liga com <strong>{max}</strong> times: <strong>{q}</strong> avançam ao mata-mata, <strong>{r}</strong> são rebaixados{form.use_sides ? " (configuração aplicada por Lado)" : ""}.</>
                  ) : (
                    <>⚠ Configuração inválida: classificados ({q}) + rebaixados ({r}) excedem o total ({max}).</>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : editId ? "Salvar alterações" : "Criar conferência"}
            </Button>
            {editId && (
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conference list */}
      <div className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Conferências cadastradas</h2>
        {loading ? (
          <SkeletonAdminCardList count={3} />
        ) : competitions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma conferência criada ainda.</p>
        ) : (
          competitions.map((c) => {
            const s = stats[c.id];
            const rs = REG_STATUS_LABELS[c.registration_status] ?? REG_STATUS_LABELS.closed;
            const pct = s ? Math.round((s.total_approved / s.max_teams) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg">
                          {c.conference_name ?? c.name}
                        </span>
                        {c.season && <span className="text-muted-foreground text-sm">{c.season}</span>}
                        <Badge className={`border ${rs.cls}`}>{rs.label}</Badge>
                        {c.full_notified_at && (
                          <Badge className="border bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Liga Completa!
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {c.use_sides ? "Lados A/B" : "Pote único"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                          {c.qualified_count ?? 0} classificados ({(c as any).qualified_per_group ?? 2}/grupo)
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-300 border-red-500/30">
                          {c.relegated_count ?? 0} rebaixados
                        </Badge>
                      </div>

                      {c.subprefeitura && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {c.subprefeitura}
                          {c.zona && ` · ${ZONA_LABELS[c.zona] ?? c.zona}`}
                        </p>
                      )}
                      {c.starts_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Início previsto: {new Date(c.starts_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                        <Settings className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      {c.registration_status === "open" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(c)}
                        >
                          Fechar inscrições
                        </Button>
                      ) : (c.registration_status === "closed" || c.registration_status === "draw_ready") ? (
                        <Button
                          size="sm"
                          onClick={() => handleToggleStatus(c)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Ativar Liga (abrir inscrições)
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(c)}
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>

                  {s && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" /> Equipes aprovadas
                        </span>
                        <span className="font-mono">
                          {s.total_approved} / {s.max_teams}
                          {s.is_full && <CheckCircle className="inline h-4 w-4 ml-1 text-emerald-400" />}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={pct >= 100 ? "h-full bg-emerald-500" : "h-full bg-primary"}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Mandante A: <span className="text-foreground font-medium">{s.host_a_approved}</span> / {Math.floor(s.host_slots / 2)}</div>
                        <div>Mandante B: <span className="text-foreground font-medium">{s.host_b_approved}</span> / {Math.ceil(s.host_slots / 2)}</div>
                        <div>Visitante A: <span className="text-foreground font-medium">{s.visitor_a_approved}</span> / {Math.floor(s.visitor_slots / 2)}</div>
                        <div>Visitante B: <span className="text-foreground font-medium">{s.visitor_b_approved}</span> / {Math.ceil(s.visitor_slots / 2)}</div>
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
