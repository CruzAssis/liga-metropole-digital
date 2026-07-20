import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/AppSkeletons";
import { getTeamPublicProfile, getTeamContact } from "@/lib/team-profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { buildWhatsAppLink, formatPhoneBR } from "@/lib/wa";
import { CheckCircle2, Mail, MessageCircle, MapPin, Calendar, Lock, Users, CalendarX, ShieldOff } from "lucide-react";


export const Route = createFileRoute("/times/$slug")({
  component: TeamProfilePage,
  loader: async ({ params }) => {
    const data = await getTeamPublicProfile({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.team.name} · Liga Metrópole` },
          {
            name: "description",
            content: `Perfil do ${loaderData.team.name}: elenco, jogos e classificação na Liga Metrópole.`,
          },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <PublicShell>
      <div className="py-20 text-center">
        <h1 className="font-display text-4xl tracking-wide">Time não encontrado</h1>
        <Button asChild className="mt-6">
          <Link to="/times">Voltar para Times</Link>
        </Button>
      </div>
    </PublicShell>
  ),
});

type LoaderData = NonNullable<Awaited<ReturnType<typeof getTeamPublicProfile>>>;
type Match = LoaderData["matches"][number];
type Athlete = LoaderData["athletes"][number];

function TeamProfilePage() {
  const data = Route.useLoaderData() as LoaderData;
  const { team, groupLabel, athletes, matches, supporterCount } = data;

  const upcoming = matches.filter((m: Match) => ["scheduled", "awaiting_confirmation"].includes(m.status));
  const results = matches.filter((m: Match) => ["confirmed", "wo"].includes(m.status)).slice().reverse();

  const [athletesVisible, setAthletesVisible] = useState(8);
  const [upcomingVisible, setUpcomingVisible] = useState(5);
  const [resultsVisible, setResultsVisible] = useState(5);


  const primaryStyle = team.primary_color
    ? ({ ["--team-primary" as string]: team.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <PublicShell>
      <div style={primaryStyle}>
        {/* Banner */}
        {team.banner_url ? (
          <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6 mb-6 h-40 sm:h-56 overflow-hidden relative">
            <img src={team.banner_url} alt={`Banner ${team.name}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          </div>
        ) : null}

        {/* Header */}
        <header
          className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8"
          style={team.primary_color ? { borderLeft: `4px solid ${team.primary_color}`, paddingLeft: "1rem" } : undefined}
        >
          <div className="h-24 w-24 rounded-md border border-border bg-card overflow-hidden flex items-center justify-center shrink-0">
            {team.logo_url ? (
              <img src={team.logo_url} alt={`Escudo ${team.name}`} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-3xl">{team.short_name?.[0] ?? "?"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="font-display text-4xl tracking-wide"
              style={team.primary_color ? { color: team.primary_color } : undefined}
            >
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className="font-mono">{team.short_name}</Badge>
              <Badge variant={team.registration_type === "host" ? "default" : "secondary"} className="uppercase">
                {team.registration_type === "host" ? "Mandante" : "Visitante"}
              </Badge>
              {team.lado && (
                <Badge
                  className={`uppercase font-bold tracking-widest ${
                    team.lado === "A"
                      ? "bg-primary/15 text-primary border border-primary/40 hover:bg-primary/20"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/20"
                  }`}
                >
                  Conferência: Lado {team.lado}
                </Badge>
              )}
              {groupLabel && <Badge variant="outline">Grupo {groupLabel}</Badge>}
              <Badge variant="outline" className="gap-1">
                <span className="text-primary">●</span> {supporterCount} torcedor{supporterCount === 1 ? "" : "es"}
              </Badge>
            </div>
            {team.registration_type === "host" && team.home_venue && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {team.home_venue}
                {team.home_time && <span> · {team.home_time.slice(0, 5)}</span>}
              </p>
            )}
          </div>
        </header>



      {/* Contact */}
      <ContactSection slug={team.slug ?? ""} teamName={team.name} />

      {/* Athletes */}
      <Section title={`Elenco (${athletes.length})`}>
        {athletes.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Nenhum atleta cadastrado" description="O elenco aparecerá aqui assim que os atletas concluírem o ID Metrópole." />
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {athletes.slice(0, athletesVisible).map((a: Athlete) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted overflow-hidden shrink-0">
                    {a.photo_url ? (
                      <img src={a.photo_url} alt={a.full_name ?? ""} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1">
                      {a.nickname || a.full_name}
                      {a.verified && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                    {a.position && <div className="text-xs text-muted-foreground truncate">{a.position}</div>}
                  </div>
                </div>
              ))}
            </div>
            {athletesVisible < athletes.length && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setAthletesVisible((v) => v + 8)}>
                  Ver mais ({athletes.length - athletesVisible})
                </Button>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Upcoming */}
      <Section title="Próximos jogos">
        {upcoming.length === 0 ? (
          <EmptyState icon={<CalendarX className="h-7 w-7" />} title="Sem jogos agendados" description="Assim que o sorteio da próxima rodada sair, os jogos aparecem aqui." />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {upcoming.slice(0, upcomingVisible).map((m: Match) => (
                <li key={m.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-xs">Rod. {m.round}</Badge>
                    <span className="font-medium truncate">{m.host?.short_name}</span>
                    <span className="text-muted-foreground">×</span>
                    <span className="font-medium truncate">{m.visitor?.short_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {m.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(m.scheduled_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {m.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {m.venue}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {upcomingVisible < upcoming.length && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setUpcomingVisible((v) => v + 5)}>
                  Ver mais ({upcoming.length - upcomingVisible})
                </Button>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Results */}
      <Section title="Últimos resultados">
        {results.length === 0 ? (
          <EmptyState icon={<ShieldOff className="h-7 w-7" />} title="Sem resultados ainda" description="Os resultados aparecem aqui após a súmula ser homologada." />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {results.slice(0, resultsVisible).map((m: Match) => (
                <li key={m.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{m.host?.short_name}</span>
                    <span className="font-mono font-bold">
                      {m.host_score}×{m.visitor_score}
                    </span>
                    <span className="font-medium truncate">{m.visitor?.short_name}</span>
                  </div>
                  {m.status === "wo" && <Badge variant="destructive">WO</Badge>}
                </li>
              ))}
            </ul>
            {resultsVisible < results.length && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setResultsVisible((v) => v + 5)}>
                  Ver mais ({results.length - resultsVisible})
                </Button>
              </div>
            )}
          </>
        )}
      </Section>


      {/* H2H */}
      <Section title="Histórico de confrontos (H2H)">
        <H2HBlock teamId={team.id} matches={matches} />
      </Section>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link to="/ranking">Ver classificação completa</Link>
        </Button>
      </div>
      </div>
    </PublicShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl tracking-wide mb-3">{title}</h2>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function ContactSection({ slug, teamName }: { slug: string; teamName: string }) {
  const { user, loading } = useAuth();
  const getContact = useServerFn(getTeamContact);
  const { data: contact } = useQuery({
    queryKey: ["team-contact", slug],
    queryFn: () => getContact({ data: { slug } }),
    enabled: !!user && !loading,
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-xl tracking-wide mb-3">Contato do diretor</h2>
      {!user ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>
            <Link to="/login" className="text-primary hover:underline">Faça login</Link> para ver
            WhatsApp e e-mail do responsável.
          </span>
        </div>
      ) : !contact ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {contact.full_name && (
            <p className="text-sm">
              Responsável: <span className="font-medium">{contact.full_name}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {contact.phone && (
              <Button asChild variant="default" size="sm" className="gap-2">
                <a
                  href={buildWhatsAppLink(contact.phone, `Olá! Sobre a Liga Metrópole — ${teamName}.`) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp · {formatPhoneBR(contact.phone)}
                </a>
              </Button>
            )}
            {contact.email && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={`mailto:${contact.email}`}>
                  <Mail className="h-4 w-4" /> {contact.email}
                </a>
              </Button>
            )}
            {!contact.phone && !contact.email && (
              <p className="text-sm text-muted-foreground">Sem dados de contato.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

type H2HMatch = LoaderData["matches"][number];

function H2HBlock({ teamId, matches }: { teamId: string; matches: H2HMatch[] }) {
  // Group played matches by opponent
  const played = matches.filter((m) => ["confirmed", "wo"].includes(m.status));
  if (played.length === 0) {
    return <EmptyText>Sem confrontos disputados ainda.</EmptyText>;
  }

  type Group = {
    opponentId: string;
    opponent: { name: string; short_name: string; slug: string | null; logo_url: string | null } | null;
    matches: H2HMatch[];
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
  };

  const groups = new Map<string, Group>();
  for (const m of played) {
    const opponentId = m.is_host ? m.visitor_team_id : m.host_team_id;
    const opponent = m.is_host ? m.visitor : m.host;
    const myScore = (m.is_host ? m.host_score : m.visitor_score) ?? 0;
    const oppScore = (m.is_host ? m.visitor_score : m.host_score) ?? 0;
    const g = groups.get(opponentId) ?? {
      opponentId,
      opponent,
      matches: [],
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
    };
    g.matches.push(m);
    g.gf += myScore;
    g.ga += oppScore;
    if (myScore > oppScore) g.w++;
    else if (myScore === oppScore) g.d++;
    else g.l++;
    groups.set(opponentId, g);
  }

  const list = Array.from(groups.values()).sort(
    (a, b) => b.matches.length - a.matches.length,
  );

  return (
    <div className="space-y-3">
      {list.map((g) => (
        <details
          key={g.opponentId}
          className="rounded-lg border border-border bg-card overflow-hidden group"
        >
          <summary className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/30 transition-colors list-none">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-md border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                {g.opponent?.logo_url ? (
                  <img src={g.opponent.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-mono text-xs">{g.opponent?.short_name?.[0] ?? "?"}</span>
                )}
              </div>
              <div className="min-w-0">
                {g.opponent?.slug ? (
                  <Link
                    to="/times/$slug"
                    params={{ slug: g.opponent.slug }}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {g.opponent.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium truncate block">
                    {g.opponent?.name ?? "Adversário"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {g.matches.length} {g.matches.length === 1 ? "jogo" : "jogos"} · {g.gf}–{g.ga} gols
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono shrink-0">
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                {g.w}V
              </Badge>
              <Badge variant="secondary">{g.d}E</Badge>
              <Badge variant="destructive">{g.l}D</Badge>
            </div>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {g.matches
              .slice()
              .sort((a, b) => {
                const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
                const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
                return tb - ta;
              })
              .map((m) => {
                const myScore = (m.is_host ? m.host_score : m.visitor_score) ?? 0;
                const oppScore = (m.is_host ? m.visitor_score : m.host_score) ?? 0;
                const result =
                  myScore > oppScore ? "V" : myScore === oppScore ? "E" : "D";
                const resultColor =
                  result === "V"
                    ? "bg-emerald-600 text-white"
                    : result === "E"
                      ? "bg-muted text-foreground"
                      : "bg-destructive text-destructive-foreground";
                return (
                  <li key={m.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-5 w-5 rounded flex items-center justify-center font-mono font-bold ${resultColor}`}
                      >
                        {result}
                      </span>
                      <span className="font-medium">
                        {m.is_host ? "Casa" : "Fora"}
                      </span>
                      <span className="font-mono font-bold">
                        {m.host_score}×{m.visitor_score}
                      </span>
                      {m.status === "wo" && <Badge variant="destructive" className="text-[10px]">WO</Badge>}
                      <Badge variant="outline" className="text-[10px]">Rod. {m.round}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.scheduled_at && (
                        <span className="text-muted-foreground">
                          {new Date(m.scheduled_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      <Link
                        to="/partidas/$id"
                        params={{ id: m.id }}
                        className="text-primary hover:underline font-medium"
                      >
                        Súmula →
                      </Link>
                    </div>
                  </li>
                );
              })}
          </ul>
        </details>
      ))}
    </div>
  );
}

