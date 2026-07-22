import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SkeletonTeamGrid, EmptyTimes } from "@/components/AppSkeletons";
import { ArrowRight, Search, MapPin, User, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

type PublicTeam = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  registration_type: string | null;
  lado: "A" | "B" | null;
  subprefeitura: string | null;
  manager_name: string | null;
};

type SortKey = "name-asc" | "name-desc" | "sigla-asc" | "subpref-asc" | "lado-asc";
type LadoFilter = "" | "A" | "B";

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Nome (A-Z)" },
  { value: "name-desc", label: "Nome (Z-A)" },
  { value: "sigla-asc", label: "Sigla (A-Z)" },
  { value: "subpref-asc", label: "Subprefeitura" },
  { value: "lado-asc", label: "Lado (A → B)" },
];

type ClubesSearch = { page: number; size: PageSize; sort: SortKey; q: string; lado: LadoFilter };

export const Route = createFileRoute("/clubes")({
  validateSearch: (search: Record<string, unknown>): ClubesSearch => {
    const rawSize = Number(search.size);
    const size = (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawSize) ? (rawSize as PageSize) : 12;
    const sort = SORT_OPTIONS.some((o) => o.value === search.sort) ? (search.sort as SortKey) : "name-asc";
    const lado = search.lado === "A" || search.lado === "B" ? search.lado : "";
    const page = Math.max(1, Number(search.page) || 1);
    return { page, size, sort, q: typeof search.q === "string" ? search.q : "", lado };
  },
  component: ClubesPage,
  head: () => ({
    meta: [
      { title: "Clubes aprovados · Liga Metrópole" },
      { name: "description", content: "Lista pública dos clubes aprovados na Liga Metrópole, com escudo, sigla e nome do gestor responsável." },
      { property: "og:title", content: "Clubes aprovados · Liga Metrópole" },
      { property: "og:description", content: "Conheça os clubes participantes da Liga Metrópole e seus gestores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function ClubeCard({ t }: { t: PublicTeam }) {
  const inner = (
    <>
      <div
        className="h-16 w-16 rounded-xl bg-muted overflow-hidden grid place-items-center ring-1 ring-border shrink-0 group-hover:ring-primary/40 transition-all"
        style={t.primary_color && !t.logo_url ? { backgroundColor: `${t.primary_color}22` } : undefined}
      >
        {t.logo_url ? (
          <img src={t.logo_url} alt={t.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-3xl text-muted-foreground">{t.short_name?.[0] ?? "?"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg sm:text-xl tracking-wide uppercase leading-tight truncate">{t.name}</div>
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
        {t.manager_name && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">Gestor: <span className="text-foreground/90">{t.manager_name}</span></span>
          </div>
        )}
      </div>
      {t.slug && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </>
  );

  const baseCls = "group flex items-start gap-4 rounded-xl border border-border bg-card p-4";
  return t.slug ? (
    <Link to="/times/$slug" params={{ slug: t.slug }} className={`${baseCls} card-hover`}>
      {inner}
    </Link>
  ) : (
    <div className={baseCls}>{inner}</div>
  );
}

function ClubesPage() {
  const [teams, setTeams] = useState<PublicTeam[] | null>(null);
  const [query, setQuery] = useState("");
  const [lado, setLado] = useState<"" | "A" | "B">("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_public_teams");
      if (error) {
        console.error(error);
        setTeams([]);
        return;
      }
      setTeams((data ?? []) as PublicTeam[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return [];
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (lado && t.lado !== lado) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.short_name.toLowerCase().includes(q) ||
        (t.manager_name ?? "").toLowerCase().includes(q) ||
        (t.subprefeitura ?? "").toLowerCase().includes(q)
      );
    });
  }, [teams, query, lado]);

  if (!teams) {
    return (
      <PublicShell>
        <PageHeader title="Clubes" description="Carregando clubes aprovados..." />
        <SkeletonTeamGrid count={6} />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <PageHeader
        eyebrow={`${teams.length} clube${teams.length !== 1 ? "s" : ""} aprovado${teams.length !== 1 ? "s" : ""}`}
        title="Clubes da Liga"
        description="Todos os clubes confirmados na Liga Metrópole, com escudo, sigla e gestor responsável."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por clube, sigla, gestor ou subprefeitura…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {(["", "A", "B"] as const).map((v) => (
            <button
              key={v || "all"}
              onClick={() => setLado(v)}
              className={`px-3 py-1.5 rounded text-xs font-semibold tracking-widest uppercase transition ${
                lado === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "" ? "Todos" : `Lado ${v}`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyTimes />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => <ClubeCard key={t.id} t={t} />)}
        </div>
      )}
    </PublicShell>
  );
}
