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
  Users, UserPlus, CalendarDays, Copy, Share2,
  Shield, Trophy, Pencil, Gavel,
} from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TeamMatchesSection } from "@/components/matches/TeamMatchesSection";
import { TeamCustomizationCard } from "@/components/teams/TeamCustomizationCard";
import { TeamHomeVenueCard } from "@/components/teams/TeamHomeVenueCard";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { getMyTeamPagamentos, type PagamentoStatus } from "@/lib/pagamentos.functions";
import { updateTeamByDirector } from "@/lib/team-profile.functions";
import { publicUrl } from "@/lib/public-url";

import { formatPhoneBR } from "@/lib/wa";
import { WelcomeAthleteModal } from "@/components/WelcomeAthleteModal";
import homeBg from "@/assets/home-bg.png.asset.json";


// ─── Ligas abertas para inscrição ────────────────────────────────────────────
type OpenLeague = {
  id: string;
  name: string;
  conference_name: string | null;
  subprefeitura: string | null;
  season: number | null;
  host_slots: number;
  visitor_slots: number;
  starts_at: string | null;
};

function OpenLeaguesCard() {
  const [leagues, setLeagues] = useState<OpenLeague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id,name,conference_name,subprefeitura,season,host_slots,visitor_slots,starts_at")
        .eq("registration_status", "open")
        .order("created_at", { ascending: false });
      setLeagues((data ?? []) as unknown as OpenLeague[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (leagues.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#1565F5]/40 bg-[#1565F5]/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-[#1565F5]" />
        <h2 className="font-display text-2xl tracking-wide">Ligas com inscrições abertas</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Inscreva seu time em uma das conferências disponíveis abaixo.
      </p>
      <div className="space-y-2">
        {leagues.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {l.conference_name ?? l.name}{l.season ? ` · ${l.season}` : ""}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {l.subprefeitura ? `${l.subprefeitura} · ` : ""}
                {l.host_slots} Mandantes + {l.visitor_slots} Visitantes
                {l.starts_at ? ` · Início ${new Date(l.starts_at).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <Button asChild size="sm" className="bg-[#1565F5] hover:bg-blue-600 text-white shrink-0">
              <Link to="/inscricao">Inscrever-se</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  invite_code: string | null;
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

// ─── Pagamento Status Badge ───────────────────────────────────────────────────
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

// ─── Painel Financeiro do Diretor ─────────────────────────────────────────────
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
    return val > 0 ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
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
          Seu time está inadimplente. Entre em contato com a organização da liga para regularizar.
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Histórico — 6 meses</p>
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
          Último pagamento: {new Date(mesAtual.data_pagamento).toLocaleDateString("pt-BR")}
          {mesAtual.metodo ? " · " + mesAtual.metodo.toUpperCase() : ""}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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
    if (data) {
      const { data: code } = await supabase.rpc("get_my_team_invite_code", { _team_id: data.id });
      setTeam({ ...(data as Team), invite_code: (code as string | null) ?? null });
    } else {
      setTeam(null);
    }
    setLoading(false);
  };

  useEffect(() => { void loadTeam(); }, [user]);

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="relative -mx-4 -my-6 sm:-mx-6 px-4 sm:px-6 py-6 min-h-screen">
      <WelcomeAthleteModal name={user?.user_metadata?.full_name as string | undefined} />
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: `url(${homeBg.url})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/85 to-background"
      />

      <div className="max-w-3xl mx-auto space-y-8">

      {/* ─── HERO: Painel do Diretor (time aprovado) ─── */}
      {team?.status === "approved" ? (
        <DirectorHeroCard team={team} onSaved={loadTeam} />

      ) : (
        <div>
          <h1 className="font-display text-4xl tracking-wide">Minha conta</h1>
          <p className="text-muted-foreground mt-1">Seus dados de contato e o status do seu time.</p>
          <div className="mt-4 flex gap-3 flex-wrap">
            <Link to="/onboarding" className="inline-flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors border border-zinc-700">
              Completar/Editar perfil
            </Link>
            <Link to="/inscricao" className="inline-flex items-center gap-2 text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
              Inscrever meu time
            </Link>
          </div>
        </div>
      )}

      {/* Ligas abertas — visível para diretores com time inscrito */}
      {team && team.status !== "approved" && <OpenLeaguesCard />}

      {!team ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h2 className="font-display text-3xl tracking-wide">Você ainda não inscreveu um time</h2>
          <p className="mt-2 text-muted-foreground">Faça a inscrição para participar da Liga Metrópole.</p>
          <Button asChild className="mt-6"><Link to="/inscricao">Inscrever meu time</Link></Button>
        </div>
      ) : team.status !== "approved" ? (
        <TeamCard team={team} />
      ) : null}

      {/* Painel Financeiro — visível para diretores de times aprovados */}
      {team?.status === "approved" && <TeamFinanceiroCard />}

      {team?.status === "approved" && (
        <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 group">
          <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm font-medium text-zinc-300 hover:text-white">
            <span>Configurações do time</span>
            <span className="text-zinc-500 group-open:rotate-180 transition-transform">⌄</span>
          </summary>
          <div className="p-4 space-y-6 border-t border-zinc-800">
            <TeamCustomizationCard
              teamId={team.id} logoUrl={team.logo_url} bannerUrl={team.banner_url}
              primaryColor={team.primary_color} onSaved={loadTeam}
            />
            <TeamHomeVenueCard teamId={team.id} />
            <TeamMatchesSection />
          </div>
        </details>
      )}

      <DirectorContactCard />

      </div>
    </div>
  );
}

// ─── Hero do Diretor: card central + 3 botões grandes ────────────────────────
function DirectorHeroCard({ team, onSaved }: { team: Team; onSaved: () => void | Promise<void> }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);


  return (
    <>
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div className="flex items-center gap-4">
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.name}
              className="h-16 w-16 rounded-xl object-cover border border-zinc-700"
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-[#1565F5]/20 border border-[#1565F5]/40 flex items-center justify-center font-display text-2xl text-[#5B9BFF]">
              {team.short_name}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-zinc-500 font-medium">Painel do Diretor</p>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white truncate">
              {team.name}
            </h1>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            title="Editar dados do time"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-[#1565F5]/60 text-white px-3 py-2 text-sm transition-colors"
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Editar Dados do Time</span>
          </button>
        </div>


        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/elenco"
            className="group flex flex-col items-center justify-center gap-3 rounded-xl bg-[#1565F5] hover:bg-[#0f4fc6] active:bg-[#0d44a8] text-white px-4 py-6 text-center transition-all shadow-lg shadow-[#1565F5]/20 hover:shadow-[#1565F5]/40 hover:-translate-y-0.5"
          >
            <Users className="h-8 w-8" />
            <span className="font-semibold text-base">Meus Jogadores</span>
          </Link>

          <button
            onClick={() => setInviteOpen(true)}
            className="group flex flex-col items-center justify-center gap-3 rounded-xl bg-[#1565F5] hover:bg-[#0f4fc6] active:bg-[#0d44a8] text-white px-4 py-6 text-center transition-all shadow-lg shadow-[#1565F5]/20 hover:shadow-[#1565F5]/40 hover:-translate-y-0.5"
          >
            <UserPlus className="h-8 w-8" />
            <span className="font-semibold text-base">Convidar Atleta</span>
          </button>

          <Link
            to="/agenda"
            className="group flex flex-col items-center justify-center gap-3 rounded-xl bg-[#1565F5] hover:bg-[#0f4fc6] active:bg-[#0d44a8] text-white px-4 py-6 text-center transition-all shadow-lg shadow-[#1565F5]/20 hover:shadow-[#1565F5]/40 hover:-translate-y-0.5"
          >
            <CalendarDays className="h-8 w-8" />
            <span className="font-semibold text-base">Agenda de Jogos</span>
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {team.slug ? (
            <Link
              to="/times/$slug"
              params={{ slug: team.slug }}
              className="group flex items-center justify-center gap-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#1565F5]/60 text-white px-4 py-4 text-center transition-all"
            >
              <Shield className="h-6 w-6 text-[#5B9BFF]" />
              <span className="font-semibold text-base">Meu Time</span>
            </Link>
          ) : (
            <div className="flex items-center justify-center gap-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 px-4 py-4 text-center cursor-not-allowed">
              <Shield className="h-6 w-6" />
              <span className="font-semibold text-base">Meu Time</span>
            </div>
          )}

          <Link
            to="/ranking"
            className="group flex items-center justify-center gap-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#1565F5]/60 text-white px-4 py-4 text-center transition-all"
          >
            <Trophy className="h-6 w-6 text-[#5B9BFF]" />
            <span className="font-semibold text-base">Ranking da Conferência</span>
          </Link>

          <Link
            to="/arbitros-avaliar"
            className="group flex items-center justify-center gap-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-[#1565F5]/60 text-white px-4 py-4 text-center transition-all sm:col-span-2"
          >
            <Gavel className="h-6 w-6 text-[#5B9BFF]" />
            <span className="font-semibold text-base">Avaliar Árbitros</span>
          </Link>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Convidar atleta</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Compartilhe o link. Quem abrir se cadastra e entra automaticamente no {team.name}.
            </DialogDescription>
          </DialogHeader>
          {team.invite_code ? (
            <InviteShareBox code={team.invite_code} teamName={team.name} />
          ) : (
            <p className="text-sm text-zinc-400">Código de convite indisponível.</p>
          )}
        </DialogContent>
      </Dialog>

      <EditTeamDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        team={team}
        onSaved={onSaved}
      />
    </>
  );
}

function EditTeamDialog({
  open, onOpenChange, team, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team: Team;
  onSaved: () => void | Promise<void>;
}) {
  const updateFn = useServerFn(updateTeamByDirector);
  const [form, setForm] = useState({
    name: team.name,
    short_name: team.short_name,
    lado: "A" as "A" | "B",
    registration_type: team.registration_type,
    home_venue: "",
    home_time: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("lado, home_venue, home_time")
        .eq("id", team.id)
        .maybeSingle();
      const v = data as { lado: "A" | "B" | null; home_venue: string | null; home_time: string | null } | null;
      setForm({
        name: team.name,
        short_name: team.short_name,
        lado: (v?.lado ?? "A"),
        registration_type: team.registration_type,
        home_venue: v?.home_venue ?? "",
        home_time: v?.home_time ? v.home_time.slice(0, 5) : "",
      });
    })();
  }, [open, team.id, team.name, team.short_name, team.registration_type]);

  const save = async () => {
    if (!form.name.trim() || !form.short_name.trim()) {
      toast.error("Preencha nome e sigla.");
      return;
    }
    if (form.registration_type === "host" && !form.home_venue.trim()) {
      toast.error("Informe o estádio/arena do mandante.");
      return;
    }
    setSaving(true);
    try {
      await updateFn({
        data: {
          team_id: team.id,
          name: form.name.trim(),
          short_name: form.short_name.trim().toUpperCase(),
          lado: form.lado,
          registration_type: form.registration_type,
          home_venue: form.home_venue.trim() || null,
          home_time: form.home_time || null,
        },
      });
      toast.success("Dados do time atualizados!");
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Editar dados do time</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Corrija informações do seu clube. As mudanças refletem imediatamente em rankings e listagens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-name">Nome do time</Label>
            <Input id="edit-name" value={form.name} maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edit-short">Sigla (2–10 letras)</Label>
            <Input id="edit-short" value={form.short_name} maxLength={10}
              onChange={(e) => setForm({ ...form, short_name: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label>Conferência (Lado)</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["A", "B"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setForm({ ...form, lado: l })}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    form.lado === l ? "border-[#1565F5] bg-[#1565F5]/15 text-white" : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                  }`}>
                  Lado {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Mando</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([["host","Mandante"],["visitor","Visitante"]] as const).map(([v,label]) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, registration_type: v })}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    form.registration_type === v ? "border-[#1565F5] bg-[#1565F5]/15 text-white" : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {form.registration_type === "host" && (
            <>
              <div>
                <Label htmlFor="edit-venue">Estádio / Arena</Label>
                <Input id="edit-venue" value={form.home_venue} maxLength={120}
                  onChange={(e) => setForm({ ...form, home_venue: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-time">Horário padrão</Label>
                <Input id="edit-time" type="time" value={form.home_time}
                  onChange={(e) => setForm({ ...form, home_time: e.target.value })} />
              </div>
            </>
          )}
          <p className="text-xs text-zinc-500">
            A subprefeitura é definida pela liga em que o seu time está inscrito. Para trocar de subprefeitura, peça suporte à organização.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#1565F5] hover:bg-blue-600 text-white">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function InviteShareBox({ code, teamName }: { code: string; teamName: string }) {
  const url = publicUrl(`/convite/${code}`);
  const waMessage = encodeURIComponent(
    `Olá! Você foi convidado(a) para se juntar ao time ${teamName} na Liga Metrópole. Clique no link e crie sua conta de jogador: ${url}`,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <div className="space-y-3">
      <code className="block text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2.5 text-zinc-300 break-all">
        {url}
      </code>
      <div className="flex gap-2">
        <Button
          onClick={copy}
          variant="outline"
          className="flex-1 bg-transparent border-zinc-700 text-zinc-200 hover:bg-white/5 hover:text-white gap-2"
        >
          <Copy className="h-4 w-4" /> Copiar link
        </Button>
        <Button
          asChild
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <a href={`https://wa.me/?text=${waMessage}`} target="_blank" rel="noopener noreferrer">
            <Share2 className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Código: <span className="font-mono font-semibold text-zinc-400">{code}</span>
      </p>
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
            Sigla: <span className="font-mono">{team.short_name}</span> · Tipo:{" "}
            {team.registration_type === "host" ? "Mandante" : "Visitante"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Inscrito em {new Date(team.created_at).toLocaleDateString("pt-BR")}</p>
          {team.status === "approved" && team.slug && (
            <Button asChild variant="outline" size="sm" className="mt-3 gap-1">
              <Link to="/times/$slug" params={{ slug: team.slug }}>
                <ExternalLink className="h-3 w-3" /> Ver perfil público
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
          As 40 vagas de {team.registration_type === "host" ? "Mandante" : "Visitante"} já foram preenchidas. Você está na sala de espera.
        </div>
      )}
      {team.status === "pending" && (
        <div className="mt-6 rounded-md border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          Sua inscrição está em análise pela organização da liga.
        </div>
      )}
      {team.invite_code && <InviteLinkBlock code={team.invite_code} teamName={team.name} />}
    </div>
  );
}

function InviteLinkBlock({ code, teamName }: { code: string; teamName: string }) {
  const url = publicUrl(`/convite/${code}`);
  const waMessage = encodeURIComponent(
    `Olá! Você foi convidado(a) para se juntar ao time ${teamName} na Liga Metrópole. Clique no link e crie sua conta de jogador: ${url}`,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  };
  return (
    <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Convide seus jogadores</p>
        <p className="text-xs text-muted-foreground mt-1">
          Compartilhe o link abaixo. Quem abrir vai se cadastrar e entrar automaticamente no seu time.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-0 text-xs font-mono bg-background border border-border rounded px-3 py-2 truncate">
          {url}
        </code>
        <Button size="sm" variant="outline" onClick={copy}>Copiar</Button>
        <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <a href={`https://wa.me/?text=${waMessage}`} target="_blank" rel="noopener noreferrer">
            Enviar no WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Código: <span className="font-mono font-semibold">{code}</span>
      </p>
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
          <h2 className="font-display text-2xl tracking-wide">Diretor / técnico</h2>
        </div>
        {!editing && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !editing ? (
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{data?.full_name || "—"}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{data?.phone ? formatPhoneBR(data.phone) : "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">E-mail</dt><dd className="font-medium">{data?.email || "—"}</dd></div>
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">WhatsApp (DDD + número, só dígitos)</Label>
            <Input id="phone" inputMode="numeric" maxLength={11} placeholder="11987654321"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Trocar o e-mail vai exigir reconfirmação.</p>
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
          href={`mailto:shelderdouglasdacruz@gmail.com?subject=Solicitacao%20de%20exclusao%20de%20conta&body=Ola%2C%20gostaria%20de%20solicitar%20a%20exclusao%20da%20minha%20conta%20na%20Liga%20Metropole.%0A%0AEmail%3A%20${data?.email || ''}`}
          className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm border border-red-900/40 hover:border-red-700 rounded px-3 py-1.5 transition-colors"
        >
          Solicitar exclusao de conta
        </a>
      </div>
    </div>
  );
          }
