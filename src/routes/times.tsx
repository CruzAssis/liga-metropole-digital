import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonTeamGrid, EmptyTimes } from "@/components/AppSkeletons";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search } from "lucide-react";

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  registration_type: string;
  lado: "A" | "B" | null;
};

export const Route = createFileRoute("/times")({
  component: TimesPage,
  head: () => ({
    meta: [
      { title: "Times · Liga Metrópole" },
      { name: "description", content: "Times aprovados da Liga Metrópole, filtrados por conferência (Lado A / Lado B)." },
    ],
  }),
});

function LadoBadge({ lado }: { lado: "A" | "B" | null }) {
  if (!lado) return null;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold tracking-widest ${
        lado === "A"
          ? "border-primary/40 text-primary bg-primary/5"
          : "border-amber-500/40 text-amber-400 bg-amber-500/5"
      }`}
    >
      LADO {lado}
    </Badge>
  );
}

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
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest uppercase font-semibold">
            {t.short_name}
          </span>
          <LadoBadge lado={t.lado} />
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

type Filter = "all" | "A" | "B";

function TimesPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, short_name, slug, logo_url, registration_type, lado")
        .eq("status", "approved")
        .order("name");
      setTeams((data ?? []) as Team[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return null;
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (filter !== "all" && t.lado !== filter) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.short_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teams, filter, query]);

  if (!teams) {
    return (
      <PublicShell>
        <PageHeader title="Times" description="Buscando times da conferência..." />
        <SkeletonTeamGrid count={6} />
      </PublicShell>
    );
  }

  const counts = {
    all: teams.length,
    A: teams.filter((t) => t.lado === "A").length,
    B: teams.filter((t) => t.lado === "B").length,
  };

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: counts.all },
    { key: "A", label: "Lado A", count: counts.A },
    { key: "B", label: "Lado B", count: counts.B },
  ];

  const list = filtered ?? [];
  const mandantes = list.filter((t) => t.registration_type === "host");
  const visitantes = list.filter((t) => t.registration_type === "visitor");

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Elenco 2026"
        title="Times"
        description={`${teams.length} time${teams.length !== 1 ? "s" : ""} aprovado${teams.length !== 1 ? "s" : ""} disputando a temporada.`}
      />

      {/* Conference filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={[
              "text-sm font-semibold px-4 py-2 rounded-full border transition-all",
              filter === t.key
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-6px_rgba(21,101,245,0.6)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
            ].join(" ")}
          >
            {t.label} <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar time por nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {list.length === 0 && <EmptyTimes />}

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
