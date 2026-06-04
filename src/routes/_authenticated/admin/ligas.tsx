import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Users, CheckCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ligas")({
  component: LigasPage,
});

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
  open:       { label: "Aberta",      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  closed:     { label: "Fechada",     cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  draw_ready: { label: "Sorteio OK!", cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  active:     { label: "Em andamento",cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished:   { label: "Encerrada",  cls: "bg-muted text-muted-foreground border-border" },
};

const emptyForm = {
  name: "",
  season: String(new Date().getFullYear()),
  max_teams: "80",
  host_slots: "40",
  visitor_slots: "40",
  starts_at: "",
  registration_status: "open",
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
      .select("id,name,season,status,registration_status,max_teams,host_slots,visitor_slots,starts_at,draw_executed_at,full_notified_at,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar ligas");
    else {
      const list = (data ?? []) as Competition[];
      setCompetitions(list);
      // Load fill stats for each
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

  const handleEdit = (c: Competition) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      season: c.season ?? "",
      max_teams: String(c.max_teams),
      host_slots: String(c.host_slots),
      visitor_slots: String(c.visitor_slots),
      starts_at: c.starts_at ?? "",
      registration_status: c.registration_status,
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
    if (!max || !host || !visitor) { toast.error("Numeros de vagas invalidos"); return; }
    if (host + visitor !== max) { toast.error(`Vagas Mandante (${host}) + Visitante (${visitor}) deve somar ${max}`); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      season: form.season.trim() || null,
      max_teams: max,
      host_slots: host,
      visitor_slots: visitor,
      starts_at: form.starts_at || null,
      registration_status: form.registration_status,
    };

    if (editId) {
      const { error } = await supabase.from("competitions").update(payload).eq("id", editId);
      if (error) toast.error("Erro ao salvar", { description: error.message });
      else { toast.success("Liga atualizada"); handleCancel(); void load(); }
    } else {
      const { error } = await supabase.from("competitions").insert({ ...payload, status: "registration" });
      if (error) toast.error("Erro ao criar liga", { description: error.message });
      else { toast.success("Liga criada!"); handleCancel(); void load(); }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (c: Competition) => {
    const next = c.registration_status === "open" ? "closed" : "open";
    const { error } = await supabase
      .from("competitions")
      .update({ registration_status: next })
      .eq("id", c.id);
    if (error) toast.error("Erro ao alterar status");
    else { toast.success(`Liga ${next === "open" ? "reaberta" : "fechada"} para inscricoes`); void load(); }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Configuracao de Ligas</h1>
        <p className="text-muted-foreground">
          Crie e configure ligas. Defina vagas, formato e status de inscricoes.
        </p>
      </div>

      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editId ? <Settings className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editId ? "Editar liga" : "Nova liga"}
          </CardTitle>
          <CardDescription>
            Vagas Mandante + Visitante devem somar o total maximo de equipes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome da liga</Label>
              <Input
                placeholder="Ex: Liga Metropole Varzea 2026"
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
              <Label>Data de inicio prevista</Label>
              <Input
                type="date"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Total maximo de equipes</Label>
              <Input
                type="number"
                min={2}
                value={form.max_teams}
                onChange={(e) => setForm((f) => ({ ...f, max_teams: e.target.value }))}
              />
            </div>
            <div>
              <Label>Status de inscricoes</Label>
              <select
                value={form.registration_status}
                onChange={(e) => setForm((f) => ({ ...f, registration_status: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="open">Aberta para inscricoes</option>
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
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editId ? "Salvar alteracoes" : "Criar liga"}
            </Button>
            {editId && (
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* League list */}
      <div className="space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Ligas cadastradas</h2>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : competitions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma liga criada ainda.</p>
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
                        <span className="font-semibold text-lg">{c.name}</span>
                        {c.season && <span className="text-muted-foreground text-sm">{c.season}</span>}
                        <Badge className={`border ${rs.cls}`}>{rs.label}</Badge>
                        {c.full_notified_at && (
                          <Badge className="border bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Liga Completa!
                          </Badge>
                        )}
                      </div>
                      {c.starts_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Inicio previsto: {new Date(c.starts_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                        <Settings className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      {(c.registration_status === "open" || c.registration_status === "closed") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(c)}
                        >
                          {c.registration_status === "open" ? "Fechar inscricoes" : "Reabrir inscricoes"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Fill progress */}
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
