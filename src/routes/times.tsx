import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonTeamGrid, EmptyTimes } from "@/components/AppSkeletons";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, MapPin, Filter, Home, Plane } from "lucide-react";

const SUBPREFEITURAS = [
  "Aricanduva/Formosa/Carrão", "Butantã", "Campo Limpo", "Casa Verde/Cachoeirinha",
  "Cidade Ademar", "Cidade Tiradentes", "Ermelino Matarazzo", "Freguesia/Brasilândia",
  "Guaianases", "Ipiranga", "Itaim Paulista", "Itaquera", "Jabaquara", "Jaçanã/Tremembé",
  "Lapa", "M'Boi Mirim", "Mooca", "Parelheiros", "Penha", "Perus", "Pinheiros",
  "Pirituba/Jaraguá", "Santana/Tucuruvi", "Santo Amaro", "São Mateus", "São Miguel",
  "Sapopemba", "Sé", "Socorro", "Vila Maria/Vila Guilherme", "Vila Mariana", "Vila Prudente",
] as const;

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  registration_type: string;
  lado: "A" | "B" | null;
  subprefeitura: string | null;
};

export const Route = createFileRoute("/times")({
  component: TimesPage,
  head: () => ({
    meta: [
      { title: "Times · Liga Metrópole" },
      { name: "description", content: "Filtre times por subprefeitura, lado da conferência e mando na Liga Metrópole." },
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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-mono tracking-widest uppercase font-semibold">
            {t.short_name}
          </span>
          <LadoBadge lado={t.lado} />
          {t.subprefeitura && (
            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" /> {t.subprefeitura}
            </span>
          )}
        </div>
      </div>
      {t.slug && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </>
  );

  const baseCls =
    "group flex items-center gap-4 rounded-xl border border-border bg-card p-4";
  const linkCls = `${baseCls} card-hover`;

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

type LadoFilter = "" | "A" | "B";
type MandoFilter = "" | "host" | "visitor";

function TimesPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [subprefeitura, setSubprefeitura] = useState<string>("");
  const [lado, setLado] = useState<LadoFilter>("");
  const [mando, setMando] = useState<MandoFilter>("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, short_name, slug, logo_url, registration_type, lado, competitions:competition_id(subprefeitura)")
        .eq("status", "approved")
        .order("name");
      const rows: Team[] = (data ?? []).map((t: {
        id: string; name: string; short_name: string; slug: string | null;
        logo_url: string | null; registration_type: string; lado: "A" | "B" | null;
        competitions: { subprefeitura: string | null } | null;
      }) => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        slug: t.slug,
        logo_url: t.logo_url,
        registration_type: t.registration_type,
        lado: t.lado,
        subprefeitura: t.competitions?.subprefeitura ?? null,
      }));
      setTeams(rows);
    })();
  }, []);

  // Cascading filter: subpref → lado → mando → search
  const filtered = useMemo(() => {
    if (!teams || !subprefeitura) return [];
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (t.subprefeitura !== subprefeitura) return false;
      if (lado && t.lado !== lado) return false;
      if (mando && t.registration_type !== mando) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.short_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teams, subprefeitura, lado, mando, query]);

  if (!teams) {
    return (
      <PublicShell>
        <PageHeader title="Times" description="Buscando times da conferência..." />
        <SkeletonTeamGrid count={6} />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <PageHeader
        eyebrow="32 Subprefeituras · SP"
        title="Times"
        description="Filtre por subprefeitura, lado da conferência e mando para encontrar seu time."
      />

      {/* Filter bar */}
      <div className="mb-6 rounded-xl border border-border bg-card/60 backdrop-blur p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Subprefeitura */}
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Subprefeitura
            </span>
            <select
              value={subprefeitura}
              onChange={(e) => { setSubprefeitura(e.target.value); setLado(""); setMando(""); setQuery(""); }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Selecione —</option>
              {SUBPREFEITURAS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {/* 2. Lado */}
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Lado
            </span>
            <select
              value={lado}
              onChange={(e) => setLado(e.target.value as LadoFilter)}
              disabled={!subprefeitura}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Todos</option>
              <option value="A">Lado A</option>
              <option value="B">Lado B</option>
            </select>
          </label>

          {/* 3. Mando */}
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Mando
            </span>
            <select
              value={mando}
              onChange={(e) => setMando(e.target.value as MandoFilter)}
              disabled={!subprefeitura}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Todos</option>
              <option value="host">Mandante</option>
              <option value="visitor">Visitante</option>
            </select>
          </label>

          {/* 4. Search */}
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Nome do time
            </span>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!subprefeitura}
                className="pl-9 disabled:opacity-50"
              />
            </div>
          </label>
        </div>

        {subprefeitura && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> {subprefeitura}</Badge>
            {lado && <Badge className={lado === "A" ? "bg-primary/15 text-primary border border-primary/40" : "bg-amber-500/15 text-amber-400 border border-amber-500/40"}>Lado {lado}</Badge>}
            {mando && (
              <Badge variant="secondary" className="gap-1">
                {mando === "host" ? <><Home className="h-3 w-3" /> Mandante</> : <><Plane className="h-3 w-3" /> Visitante</>}
              </Badge>
            )}
            <span className="text-muted-foreground ml-auto">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { setSubprefeitura(""); setLado(""); setMando(""); setQuery(""); }}
              className="text-primary hover:underline"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Empty state — no subprefeitura */}
      {!subprefeitura ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 sm:p-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2">
            Selecione sua subprefeitura
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Escolha uma das 32 subprefeituras de SP no filtro acima para começar a ver os times, o ranking e a artilharia da sua região.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyTimes />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => <TeamCard key={t.id} t={t} />)}
        </div>
      )}
    </PublicShell>
  );
}
