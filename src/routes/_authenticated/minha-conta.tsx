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
import {
  ClipboardList, ExternalLink, User2, DollarSign,
  CheckCircle, Clock, AlertTriangle, CreditCard,
} from "lucide-react";
import { TeamAthletesSection } from "@/components/athletes/TeamAthletesSection";
import { TeamMatchesSection } from "@/components/matches/TeamMatchesSection";
import { TeamCustomizationCard } from "@/components/teams/TeamCustomizationCard";
import { TeamHomeVenueCard } from "@/components/teams/TeamHomeVenueCard";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { getMyTeamPagamentos, type PagamentoStatus } from "@/lib/pagamentos.functions";
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
  pending: { label: "Em anÃ¡lise", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  waitlist: { label: "Sala de espera", variant: "outline" },
};

export const Route = createFileRoute("/_authenticated/minha-conta")({
  component: MinhaContaPage,
});

// âââ Pagamento Status Badge âââââââââââââââââââââââââââââââââââââââââââââââââââ
function PagStatusBadge({ status, dias }: { status: PagamentoStatus; dias: number }) {
  if (status === "pago") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800/40 font-medium">
      <CheckCircle className="h-3 w-3" /> Pago
    </span>
  );
  if (status === "atrasado" || dias > 30) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-900/30 text-red-400 border border-red-800/40 font-medium">
      <AlertTriangle className="h-3 w-3" /> Inadimplente {dias > 0 ? "(" + dias + "d)" : ""}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/40 font-medium">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}

// âââ Painel Financeiro do Diretor âââââââââââââââââââââââââââââââââââââââââââââ
function TeamFinanceiroCard() {
  const getPagFn = useServerFn(getMyTeamPagamentos);
  const [data, setData] = useState<{ meses: Array<{
    mes_referencia: string; status: PagamentoStatus; valor: number;
    data_pagamento: string | null; metodo: string | null; dias_atraso: number;
  }>; team_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPagFn({})
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">Carregando dados financeiros...</p>
    </div>
  );

  if (!data || !data.team_id) return null;

  const meses = data.meses ?? [];
  const mesAtual = meses[0];
  const statusAtual = mesAtual?.status ?? "pendente";
  const diasAtraso = mesAtual?.dias_atraso ?? 0;
  const inadimplente = statusAtual === "atrasado" || diasAtraso > 30;

  function fmtMes(mes: string) {
    const [y, m] = mes.split("-");
    const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return nomes[parseInt(m, 10) - 1] + "/" + y;
  }

  function fmtBRL(val: number) {
    return val > 0 ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "â";
  }

  return (
    <div className={`rounded-lg border bg-card p-6 space-y-4 ${inadimplente ? "border-red-800/50" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className={`h-5 w-5 ${inadimplente ? "text-red-400" : "text-primary"}`} />
          <h2 className="font-display text-2xl tracking-wide">Financeiro</h2>
        </div>
        <PagStatusBadge status={statusAtual} dias={diasAtraso} />
      </div>

      {inadimplente && (
        <div className="rounded-md border border-red-800/40 bg-red-900/10 p-4 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 inline mr-2 text-red-400" />
          Seu time estÃ¡ inadimplente. Entre em contato com a organizaÃ§Ã£o da liga para regularizar.
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">HistÃ³rico â 6 meses</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {meses.map((m) => {
            const s = m.status;
            const atrasado = s === "atrasado" || m.dias_atraso > 30;
            return (
              <div key={m.mes_referencia}
                className={`rounded-lg border p-2.5 text-center space-y-1.5 ${
                  s === "pago" ? "border-green-800/40 bg-green-900/10" :
                  atrasado ? "border-red-800/40 bg-red-900/10" :
                  "border-border bg-background/50"
                }`}>
                <p className="text-xs text-muted-foreground font-medium">{fmtMes(m.mes_referencia)}</p>
                {s === "pago"
                  ? <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                  : atrasado
                  ? <AlertTriangle className="h-4 w-4 text-red-400 mx-auto" />
                  : <Clock className="h-4 w-4 text-amber-400 mx-auto" />}
                <p className={`text-xs font-mono ${
                  s === "pago" ? "text-green-400" :
                  atrasado ? "text-red-400" : "text-amber-400"
                }`}>
                  {s === "pago" ? (m.metodo ? m.metodo.toUpperCase() : "Pago") : atrasado ? "Atrasado" : "Pendente"}
                </p>
                {m.valor > 0 && <p className="text-xs text-muted-foreground">{fmtBRL(m.valor)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {mesAtual?.status === "pago" && mesAtual.data_pagamento && (
        <p className="text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 inline mr-1" />
          Ãltimo pagamento: {new Date(mesAtual.data_pagamento).toLocaleDateString("pt-BR")}
          {mesAtual.metodo ? " Â· " + mesAtual.metodo.toUpperCase() : ""}
        </p>
      )}
    </div>
  );
}

// âââ Main Page ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  useEffect(() => { void loadTeam(); }, [user]);

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide">Minha conta</h1>
        <p className="text-muted-foreground mt-1">Seus dados de contato e o status do seu time.</p>
        <div className="mt-4 flex gap-3">
          <Link to="/onboarding" className="inline-flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors border border-zinc-700">
            Completar/Editar perfil
          </Link>
          <Link to="/inscricao" className="inline-flex items-center gap-2 text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
            Inscrever meu time
          </Link>
        </div>
      </div>

      <DirectorContactCard />

      {!team ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h2 className="font-display text-3xl tracking-wide">VocÃª ainda nÃ£o inscreveu um time</h2>
          <p className="mt-2 text-muted-foreground">FaÃ§a a inscriÃ§Ã£o para participar da Liga MetrÃ³pole.</p>
          <Button asChild className="mt-6"><Link to="/inscricao">Inscrever meu time</Link></Button>
        </div>
      ) : (
        <TeamCard team={team} />
      )}

      {/* Painel Financeiro â visÃ­vel para diretores de times aprovados */}
      {team?.status === "approved" && <TeamFinanceiroCard />}

      {team?.status === "approved" && (
        <>
          <TeamCustomizationCard
            teamId={team.id} logoUrl={team.logo_url} bannerUrl={team.banner_url}
            primaryColor={team.primary_color} onSaved={loadTeam}
          />
          <TeamHomeVenueCard teamId={team.id} />
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
          <img src={team.logo_url} alt={"Escudo " + team.name} className="h-24 w-24 rounded-md object-cover border border-border" />
        ) : (
          <div className="h-24 w-24 rounded-md border border-border bg-background/50 flex items-center justify-center font-display text-2xl">{team.short_name}</div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-3xl tracking-wide">{team.name}</h2>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sigla: <span className="font-mono">{team.short_name}</span> Â· Tipo:{" "}
            {team.registration_type === "host" ? "Mandante" : "Visitante"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Inscrito em {new Date(team.created_at).toLocaleDateString("pt-BR")}</p>
          {team.status === "approved" && team.slug && (
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
              <Link to="/times/$slug" params={{ slug: team.slug }}>
                <ExternalLink className="h-3 w-3" /> Ver perfil pÃºblico
              </Link>
            </Button>
          )}
        </div>
      </div>
      {team.status === "rejected" && team.rejected_reason && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <strong>Motivo da rejeiÃ§Ã£o:</strong> {team.rejected_reason}
        </div>
      )}
      {team.status === "waitlist" && (
        <div className="mt-6 rounded-md border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          As 40 vagas de {team.registration_type === "host" ? "Mandante" : "Visitante"} jÃ¡ foram preenchidas. VocÃª estÃ¡ na sala de espera.
        </div>
      )}
      {team.status === "pending" && (
        <div className="mt-6 rounded-md border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          Sua inscriÃ§Ã£o estÃ¡ em anÃ¡lise pela organizaÃ§Ã£o da liga.
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
    onSuccess: () => { toast.success("Dados atualizados!"); setEditing(false); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <User2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">Diretor / tÃ©cnico</h2>
        </div>
        {!editing && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !editing ? (
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{data?.full_name || "â"}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{data?.phone ? formatPhoneBR(data.phone) : "â"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">E-mail</dt><dd className="font-medium">{data?.email || "â"}</dd></div>
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (DDD + nÃºmero, sÃ³ dÃ­gitos)</Label>
            <Input id="phone" inputMode="numeric" maxLength={11} placeholder="11987654321"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Trocar o e-mail vai exigir reconfirmaÃ§Ã£o.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando..." : "Salvar"}</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Zona de perigo - LGPD */}
      <div className="border border-red-900/40 rounded-lg p-4 mt-6">
        <h3 className="text-red-400 font-semibold text-sm mb-1">Zona de perigo</h3>
        <p className="text-zinc-500 text-xs mb-3">
          A exclusao da conta remove permanentemente seus dados da Liga Metropole.
          O processo pode levar ate 30 dias conforme a LGPD.
        </p>
        <a
          href={`mailto:shelderdouglasdacruz@gmail.com?subject=Solicitacao%20de%20exclusao%20de%20conta&body=Ola%2C%20gostaria%20de%20solicitar%20a%20exclusao%20da%20minha%20conta%20na%20Liga%20Metropole.%0A%0AEmail%3A%20${profile?.email || ''}`}
          className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm border border-red-900/40 hover:border-red-700 rounded px-3 py-1.5 transition-colors"
        >
          Solicitar exclusao de conta
        </a>
      </div>
    </div>
  );
          }
