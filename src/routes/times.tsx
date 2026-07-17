import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonTeamGrid, EmptyTimes } from "@/components/AppSkeletons";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  registration_type: string;
};

export const Route = createFileRoute("/times")({
  component: TimesPage,
  head: () => ({
    meta: [
      { title: "Times · Liga Metrópole" },
      { name: "description", content: "Times aprovados da Liga Metrópole." },
    ],
  }),
});

function TeamCard({ t }: { t: Team }) {
  const inner = (
    <>
      <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden grid place-items-center ring-1 ring-border shrink-0 group-hover:ring-primary/40 transition-all">
        {t.logo_url ? (
          <img src={t.logo_url} alt={t.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl text-muted-foreground">{t.short_name?.[0] ?? "?"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl tracking-wide uppercase leading-tight truncate">{t.name}</div>
        <div className="text-[11px] text-muted-foreground font-mono tracking-widest uppercase mt-1 font-semibold">
          {t.short_name}
        </div>
      </div>
      {t.slug && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </>
  );

  const baseCls =
    "group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all";

  const linkCls = `${baseCls} hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(21,101,245,0.4)] hover:-translate-y-0.5`;

  return t.slug ? (
    <Link key={t.id} to="/times/$slug" params={{ slug: t.slug }} className={linkCls}>
      {inner}
    </Link>
  ) : (
    <div key={t.id} className={baseCls}>
      {inner}
    </div>
  );
}

function TimesPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, short_name, slug, logo_url, registration_type")
        .eq("status", "approved")
        .order("name");
      setTeams(data ?? []);
    })();
  }, []);

  if (!teams) {
    return (
      <PublicShell>
        <PageHeader title="Times" description="Buscando times da conferência..." />
        <SkeletonTeamGrid count={6} />
      </PublicShell>
    );
  }

  const mandantes = teams.filter((t) => t.registration_type === "host");
  const visitantes = teams.filter((t) => t.registration_type === "visitor");

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Elenco 2026"
        title="Times"
        description={`${teams.length} time${teams.length !== 1 ? "s" : ""} aprovado${teams.length !== 1 ? "s" : ""} disputando a temporada.`}
      />

      {teams.length === 0 && <EmptyTimes />}

      {[
        { label: "Mandantes", list: mandantes, variant: "default" as const },
        { label: "Visitantes", list: visitantes, variant: "secondary" as const },
      ].map(
        (group) =>
          group.list.length > 0 && (
            <section key={group.label} className="mb-10">
              <h2 className="font-display text-2xl tracking-wide mb-4 flex items-center gap-2.5">
                <span className="inline-block h-4 w-1 rounded-full bg-primary" />
                {group.label}
                <Badge variant={group.variant} className="ml-1">{group.list.length}</Badge>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.list.map((t) => <TeamCard key={t.id} t={t} />)}
              </div>
            </section>
          ),
      )}
    </PublicShell>
  );
}
