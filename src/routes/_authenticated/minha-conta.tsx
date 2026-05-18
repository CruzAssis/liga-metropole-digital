import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { TeamAthletesSection } from "@/components/athletes/TeamAthletesSection";

type Team = {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  registration_type: "host" | "visitor";
  status: "pending" | "approved" | "rejected" | "waitlist";
  rejected_reason: string | null;
  created_at: string;
};

const statusMeta: Record<Team["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Em análise", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  waitlist: { label: "Sala de espera", variant: "outline" },
};

export const Route = createFileRoute("/_authenticated/minha-conta")({
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id,name,short_name,logo_url,registration_type,status,rejected_reason,created_at")
        .eq("manager_id", user.id)
        .maybeSingle();
      setTeam((data as Team | null) ?? null);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  if (!team) {
    return (
      <div className="max-w-xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
        <h2 className="font-display text-3xl tracking-wide">Você ainda não inscreveu um time</h2>
        <p className="mt-2 text-muted-foreground">
          Faça a inscrição para participar da Liga Metrópole Várzea.
        </p>
        <Button asChild className="mt-6">
          <Link to="/inscricao">Inscrever meu time</Link>
        </Button>
      </div>
    );
  }

  const meta = statusMeta[team.status];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-4xl tracking-wide">Minha conta</h1>
      <p className="text-muted-foreground mt-1">Acompanhe o status do seu time.</p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={`Escudo ${team.name}`}
              className="h-24 w-24 rounded-md object-cover border border-border"
            />
          ) : (
            <div className="h-24 w-24 rounded-md border border-border bg-background/50 flex items-center justify-center font-display text-2xl">
              {team.short_name}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-3xl tracking-wide">{team.name}</h2>
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sigla: <span className="font-mono">{team.short_name}</span> · Tipo:{" "}
              {team.registration_type === "host" ? "Mandante" : "Visitante"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Inscrito em {new Date(team.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {team.status === "rejected" && team.rejected_reason && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <strong>Motivo da rejeição:</strong> {team.rejected_reason}
          </div>
        )}

        {team.status === "waitlist" && (
          <div className="mt-6 rounded-md border border-border bg-background/50 p-4 text-sm text-muted-foreground">
            As 40 vagas de {team.registration_type === "host" ? "Mandante" : "Visitante"} já foram
            preenchidas. Você está na sala de espera e será chamado caso surja vaga.
          </div>
        )}

        {team.status === "pending" && (
          <div className="mt-6 rounded-md border border-border bg-background/50 p-4 text-sm text-muted-foreground">
            Sua inscrição está em análise pela organização da liga.
          </div>
        )}
      </div>

      {team.status === "approved" && <TeamAthletesSection />}
    </div>
  );
}
