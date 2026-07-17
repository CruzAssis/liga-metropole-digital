import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Spinner } from "@/components/AppSkeletons";
import { KeyRound, Users, Trophy, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/master-switch")({
  component: MasterSwitchPage,
});

type Settings = {
  master_registration_open: boolean;
  host_slots_limit: number;
  prospected_count: number;
};

type Stats = {
  master_open: boolean;
  host_limit: number;
  prospected: number;
  approved_hosts: number;
  pending_hosts: number;
  waitlist_hosts: number;
  total_teams: number;
  slots_remaining: number;
};

function MasterSwitchPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostLimit, setHostLimit] = useState(20);
  const [prospected, setProspected] = useState(33);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from("system_settings").select("*").eq("id", true).maybeSingle(),
      supabase.rpc("registration_dashboard_stats"),
    ]);
    if (s.data) {
      const d = s.data as unknown as Settings;
      setSettings(d);
      setHostLimit(d.host_slots_limit);
      setProspected(d.prospected_count);
    }
    if (r.data && Array.isArray(r.data) && r.data[0]) {
      setStats(r.data[0] as Stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Real-time refresh: refetch when teams change
    const channel = supabase
      .channel("master-switch-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function toggleMaster(next: boolean) {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ master_registration_open: next, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Falha ao alternar", { description: error.message });
      return;
    }
    toast.success(next ? "Liga ABERTA — cadastros liberados!" : "Liga em modo de espera");
    load();
  }

  async function saveLimits() {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({
        host_slots_limit: hostLimit,
        prospected_count: prospected,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
      return;
    }
    toast.success("Limites atualizados");
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const filledPct = stats
    ? Math.min(100, Math.round((stats.approved_hosts / Math.max(1, stats.host_limit)) * 100))
    : 0;
  const prospectPct = stats
    ? Math.min(100, Math.round(((stats.approved_hosts + stats.pending_hosts) / Math.max(1, stats.prospected)) * 100))
    : 0;

  const isOpen = settings?.master_registration_open ?? false;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <span className="min-w-0 truncate">Chave Mestra da Liga</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Controle exclusivo do Super-Admin para abrir/fechar cadastros e acompanhar as vagas.
        </p>
      </div>


      {/* Master switch */}
      <div
        className={`rounded-xl border p-6 ${
          isOpen ? "border-green-500/50 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/5"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Estado atual</div>
            <div className={`text-2xl font-bold ${isOpen ? "text-green-500" : "text-yellow-500"}`}>
              {isOpen ? "LIGA ABERTA" : "MODO DE ESPERA"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {isOpen
                ? `Cadastros liberados. Vagas de mandante são preenchidas até o limite de ${stats?.host_limit ?? 20}.`
                : "Novos cadastros ficam em lista de espera até você virar a chave."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isOpen} disabled={saving} onCheckedChange={toggleMaster} />
            <Label className="text-sm font-medium">{isOpen ? "ON" : "OFF"}</Label>
          </div>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Mandantes aprovados"
          value={`${stats?.approved_hosts ?? 0}/${stats?.host_limit ?? 20}`}
          accent="text-green-500"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={`${stats?.pending_hosts ?? 0}`}
          accent="text-yellow-500"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Lista de espera"
          value={`${stats?.waitlist_hosts ?? 0}`}
          accent="text-orange-500"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Vagas restantes"
          value={`${stats?.slots_remaining ?? 0}`}
          accent="text-primary"
        />
      </div>

      {/* Progress bars */}
      <div className="rounded-xl border p-5 space-y-4 bg-card">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Preenchimento das vagas ({stats?.host_limit ?? 20} mandantes)</span>
            <span className="font-medium">{filledPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${filledPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              Times prospectados que se cadastraram (
              {(stats?.approved_hosts ?? 0) + (stats?.pending_hosts ?? 0)}/{stats?.prospected ?? 33})
            </span>
            <span className="font-medium">{prospectPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${prospectPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Faltam <span className="font-semibold text-foreground">
              {Math.max(0, (stats?.prospected ?? 33) - ((stats?.approved_hosts ?? 0) + (stats?.pending_hosts ?? 0)))}
            </span>{" "}
            times prospectados a confirmarem a vaga.
          </p>
        </div>
      </div>

      {/* Limits */}
      <div className="rounded-xl border p-5 space-y-4 bg-card">
        <h2 className="font-semibold">Parâmetros</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="host_limit">Limite de mandantes fundadores</Label>
            <Input
              id="host_limit"
              type="number"
              min={1}
              value={hostLimit}
              onChange={(e) => setHostLimit(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prospected">Times prospectados</Label>
            <Input
              id="prospected"
              type="number"
              min={1}
              value={prospected}
              onChange={(e) => setProspected(Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={saveLimits} disabled={saving}>
          {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
          Salvar parâmetros
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={`flex items-center gap-1.5 text-xs ${accent}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
