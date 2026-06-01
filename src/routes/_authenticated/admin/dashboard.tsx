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
  lado: "A" | "B";
  created_at: string;
  logo_url: string | null;
};

const SLOT_LIMIT = 20;
const TOTAL_LIMIT = 80;

function AdminDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id,name,short_name,registration_type,status,lado,created_at,logo_url")
        .order("created_at", { ascending: false });
      setTeams((data as Team[]) ?? []);
    })();
  }, []);

  const approved = teams.filter((t) => t.status === "approved");
  const pending = teams.filter((t) => t.status === "pending");
  const count = (type: "host" | "visitor", lado: "A" | "B") =>
    approved.filter((t) => t.registration_type === type && t.lado === lado).length;

  const recent = teams.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Painel Admin</h1>
        <p className="text-muted-foreground">Liga Metrópole Várzea 2026 · 80 vagas (40 Mandantes + 40 Visitantes).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["host", "visitor"] as const).flatMap((type) =>
          (["A", "B"] as const).map((lado) => {
            const c = count(type, lado);
            const pct = (c / SLOT_LIMIT) * 100;
            return (
              <Card key={`${type}-${lado}`} className="p-5 bg-card border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {type === "host" ? "Mandantes" : "Visitantes"} {lado}
                </div>
                <div className="font-display text-4xl mt-1 tabular-nums">
                  {c}
                  <span className="text-muted-foreground text-base font-normal">/{SLOT_LIMIT}</span>
                </div>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={c >= SLOT_LIMIT ? "bg-red-500 h-full" : "bg-primary h-full"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Card>
            );
          }),
        )}
      </div>

      <Card className="p-5 bg-card border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total inscritos</div>
          <div className="font-display text-4xl mt-1 tabular-nums">
            {approved.length}
            <span className="text-muted-foreground text-base font-normal">/{TOTAL_LIMIT}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {pending.length} aguardando triagem · fase atual: inscrições
          </div>
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
                  <div className="font-semibold">
                    {t.name} <span className="text-muted-foreground">· {t.short_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.registration_type === "host" ? "Mandante" : "Visitante"} · Lado {t.lado} ·{" "}
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

function StatusBadge({ status }: { status: Team["status"] }) {
  const map = {
    pending: { label: "Em análise", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejeitado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    waitlist: { label: "Sala de espera", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  } as const;
  const m = map[status];
  return <span className={`text-xs px-2 py-1 rounded border ${m.cls}`}>{m.label}</span>;
}
