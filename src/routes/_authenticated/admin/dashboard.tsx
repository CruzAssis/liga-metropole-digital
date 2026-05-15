import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
});

type Team = {
  id: string;
  name: string;
  short_name: string;
  registration_type: "host" | "visitor";
  status: "pending" | "approved" | "rejected" | "waitlist";
  created_at: string;
  logo_url: string | null;
};

function AdminDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id,name,short_name,registration_type,status,created_at,logo_url")
        .order("created_at", { ascending: false });
      setTeams((data as Team[]) ?? []);
    })();
  }, []);

  const total = teams.length;
  const byTypeStatus = (type: "host" | "visitor", status: Team["status"]) =>
    teams.filter((t) => t.registration_type === type && t.status === status).length;

  const approvalRate = total
    ? Math.round((teams.filter((t) => t.status === "approved").length / total) * 100)
    : 0;

  const recent = teams.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Painel Admin</h1>
        <p className="text-muted-foreground">Visão geral das inscrições da liga.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Inscrições recebidas" value={total} />
        <MetricCard
          label="Mandantes"
          value={`${byTypeStatus("host", "approved")} / ${byTypeStatus("host", "pending")} / ${byTypeStatus("host", "waitlist")}`}
          hint="aprov. / pend. / espera"
        />
        <MetricCard
          label="Visitantes"
          value={`${byTypeStatus("visitor", "approved")} / ${byTypeStatus("visitor", "pending")} / ${byTypeStatus("visitor", "waitlist")}`}
          hint="aprov. / pend. / espera"
        />
        <MetricCard label="Taxa de aprovação" value={`${approvalRate}%`} />
      </div>

      <Card className="p-6 bg-card border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Triagem de Inscrições</h2>
          <p className="text-sm text-muted-foreground">
            Aprove ou rejeite times e gerencie a sala de espera.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/admin/triagem">
            <ClipboardList className="mr-2 h-5 w-5" /> Ir para a triagem
          </Link>
        </Button>
      </Card>

      <Card className="p-6 bg-card border-border">
        <h2 className="font-display text-2xl tracking-wide mb-4">Últimas inscrições</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                {t.logo_url ? (
                  <img src={t.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{t.name} <span className="text-muted-foreground">· {t.short_name}</span></div>
                  <div className="text-xs text-muted-foreground">
                    {t.registration_type === "host" ? "Mandante" : "Visitante"} ·{" "}
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5 bg-card border-border">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-4xl mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function StatusBadge({ status }: { status: Team["status"] }) {
  const map = {
    pending: { label: "Em análise", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejeitado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    waitlist: { label: "Sala de espera", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  } as const;
  const m = map[status];
  return (
    <span className={`text-xs px-2 py-1 rounded border ${m.cls}`}>{m.label}</span>
  );
}
