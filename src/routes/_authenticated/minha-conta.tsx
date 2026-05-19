import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ExternalLink, User2 } from "lucide-react";
import { TeamAthletesSection } from "@/components/athletes/TeamAthletesSection";
import { TeamMatchesSection } from "@/components/matches/TeamMatchesSection";
import { TeamCustomizationCard } from "@/components/teams/TeamCustomizationCard";
import { TeamHomeVenueCard } from "@/components/teams/TeamHomeVenueCard";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { formatPhoneBR } from "@/lib/wa";

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
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

  const loadTeam = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("teams")
      .select("id,name,short_name,slug,logo_url,banner_url,primary_color,registration_type,status,rejected_reason,created_at")
      .eq("manager_id", user.id)
      .maybeSingle();
    setTeam((data as Team | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Minha conta</h1>
        <p className="text-muted-foreground mt-1">Seus dados de contato e o status do seu time.</p>
      </div>

      <DirectorContactCard />

      {!team ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h2 className="font-display text-3xl tracking-wide">Você ainda não inscreveu um time</h2>
          <p className="mt-2 text-muted-foreground">
            Faça a inscrição para participar da Liga Metrópole Várzea.
          </p>
          <Button asChild className="mt-6">
            <Link to="/inscricao">Inscrever meu time</Link>
          </Button>
        </div>
      ) : (
        <TeamCard team={team} />
      )}

      {team?.status === "approved" && (
        <>
          <TeamCustomizationCard
            teamId={team.id}
            logoUrl={team.logo_url}
            bannerUrl={team.banner_url}
            primaryColor={team.primary_color}
            onSaved={loadTeam}
          />
          <TeamAthletesSection />
          <TeamMatchesSection />
        </>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const meta = statusMeta[team.status];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-5">
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={`Escudo ${team.name}`}
            className="h-24 w-24 rounded-md object-cover border border-border"
          />
          <TeamHomeVenueCard teamId={team.id} onSaved={loadTeam} />
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
          {team.status === "approved" && team.slug && (
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
              <Link to="/times/$slug" params={{ slug: team.slug }}>
                <ExternalLink className="h-3 w-3" />
                Ver perfil público
              </Link>
            </Button>
          )}
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
  );
}

function DirectorContactCard() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyProfile);
  const update = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile() });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });

  useEffect(() => {
    if (data) setForm({ full_name: data.full_name, phone: data.phone, email: data.email });
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => update({ data: form }),
    onSuccess: () => {
      toast.success("Dados atualizados!");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <User2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">Diretor / técnico</h2>
        </div>
        {!editing && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !editing ? (
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="font-medium">{data?.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd className="font-medium">{data?.phone ? formatPhoneBR(data.phone) : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{data?.email || "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (DDD + número, só dígitos)</Label>
            <Input
              id="phone"
              inputMode="numeric"
              maxLength={11}
              placeholder="11987654321"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Trocar o e-mail vai exigir reconfirmação.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
