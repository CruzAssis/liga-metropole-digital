import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTeamPublicProfile, getTeamContact } from "@/lib/team-profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { buildWhatsAppLink, formatPhoneBR } from "@/lib/wa";
import { CheckCircle2, Mail, MessageCircle, MapPin, Calendar, Lock } from "lucide-react";

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
          { title: `${loaderData.team.name} · Liga Metrópole Várzea` },
          {
            name: "description",
            content: `Perfil do ${loaderData.team.name}: elenco, jogos e classificação na Liga Metrópole Várzea.`,
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
  const { team, groupLabel, athletes, matches } = data;

  const upcoming = matches.filter((m: Match) => ["scheduled", "awaiting_confirmation"].includes(m.status)).slice(0, 5);
  const results = matches.filter((m: Match) => ["confirmed", "wo"].includes(m.status)).slice(-5).reverse();

  return (
    <PublicShell>
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
        <div className="h-24 w-24 rounded-md border border-border bg-card overflow-hidden flex items-center justify-center shrink-0">
          {team.logo_url ? (
            <img src={team.logo_url} alt={`Escudo ${team.name}`} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl">{team.short_name?.[0] ?? "?"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-4xl tracking-wide">{team.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className="font-mono">{team.short_name}</Badge>
            <Badge variant={team.registration_type === "host" ? "default" : "secondary"}>
              {team.registration_type === "host" ? "Mandante" : "Visitante"}
            </Badge>
            {groupLabel && <Badge variant="outline">Grupo {groupLabel}</Badge>}
          </div>
        </div>
      </header>

      {/* Contact */}
      <ContactSection slug={team.slug ?? ""} teamName={team.name} />

      {/* Athletes */}
      <Section title={`Elenco (${athletes.length})`}>
        {athletes.length === 0 ? (
          <EmptyText>Nenhum atleta cadastrado.</EmptyText>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {athletes.map((a) => (
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
        )}
      </Section>

      {/* Upcoming */}
      <Section title="Próximos jogos">
        {upcoming.length === 0 ? (
          <EmptyText>Sem jogos agendados.</EmptyText>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {upcoming.map((m) => (
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
        )}
      </Section>

      {/* Results */}
      <Section title="Últimos resultados">
        {results.length === 0 ? (
          <EmptyText>Sem resultados ainda.</EmptyText>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {results.map((m) => (
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
        )}
      </Section>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link to="/ranking">Ver classificação completa</Link>
        </Button>
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
                  href={buildWhatsAppLink(contact.phone, `Olá! Sobre a Liga Metrópole Várzea — ${teamName}.`) ?? "#"}
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
