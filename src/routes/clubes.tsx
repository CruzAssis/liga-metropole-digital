import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SkeletonTeamGrid, EmptyTimes } from "@/components/AppSkeletons";
import { ArrowRight, Search, MapPin, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

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
  const navigate = useNavigate({ from: "/clubes" });
  const { page, size, sort, q, lado } = Route.useSearch();

  const [teams, setTeams] = useState<PublicTeam[] | null>(null);
  const [queryInput, setQueryInput] = useState(q);

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

  // Debounce query input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (queryInput !== q) {
        navigate({ search: (prev: ClubesSearch) => ({ ...prev, q: queryInput, page: 1 }) });
      }
    }, 250);
    return () => clearTimeout(t);
     
  }, [queryInput]);

  const filteredSorted = useMemo(() => {
    if (!teams) return [];
    const needle = q.trim().toLowerCase();
    const list = teams.filter((t) => {
      if (lado && t.lado !== lado) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.short_name.toLowerCase().includes(needle) ||
        (t.manager_name ?? "").toLowerCase().includes(needle) ||
        (t.subprefeitura ?? "").toLowerCase().includes(needle)
      );
    });
    const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    list.sort((a, b) => {
      switch (sort) {
        case "name-desc": return cmp(b.name, a.name);
        case "sigla-asc": return cmp(a.short_name, b.short_name);
        case "subpref-asc": return cmp(a.subprefeitura ?? "\uffff", b.subprefeitura ?? "\uffff") || cmp(a.name, b.name);
        case "lado-asc": return cmp(a.lado ?? "\uffff", b.lado ?? "\uffff") || cmp(a.name, b.name);
        case "name-asc":
        default: return cmp(a.name, b.name);
      }
    });
    return list;
  }, [teams, q, lado, sort]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * size;
  const pageItems = filteredSorted.slice(start, start + size);

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

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por clube, sigla, gestor ou subprefeitura…"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {(["", "A", "B"] as const).map((v) => (
            <button
              key={v || "all"}
              onClick={() => navigate({ search: (prev: ClubesSearch) => ({ ...prev, lado: v, page: 1 }) })}
              className={`px-3 py-1.5 rounded text-xs font-semibold tracking-widest uppercase transition ${
                lado === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "" ? "Todos" : `Lado ${v}`}
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={sort}
            onChange={(e) => navigate({ search: (prev: ClubesSearch) => ({ ...prev, sort: e.target.value as SortKey, page: 1 }) })}
            className="h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Ordenar clubes"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total === 0 ? "Nenhum resultado" : `Mostrando ${start + 1}–${Math.min(start + size, total)} de ${total}`}
        </span>
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-widest font-semibold">Por página</span>
          <select
            value={size}
            onChange={(e) => navigate({ search: (prev: ClubesSearch) => ({ ...prev, size: Number(e.target.value) as PageSize, page: 1 }) })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Itens por página"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {total === 0 ? (
        <EmptyTimes />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((t) => <ClubeCard key={t.id} t={t} />)}
          </div>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-1" aria-label="Paginação">
              <button
                onClick={() => navigate({ search: (prev: ClubesSearch) => ({ ...prev, page: Math.max(1, safePage - 1) }) })}
                disabled={safePage <= 1}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-semibold uppercase tracking-widest hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              {getPageWindow(safePage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => navigate({ search: (prev: ClubesSearch) => ({ ...prev, page: p as number }) })}
                    aria-current={p === safePage ? "page" : undefined}
                    className={`h-9 min-w-9 rounded-md border px-3 text-xs font-semibold transition ${
                      p === safePage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => navigate({ search: (prev: ClubesSearch) => ({ ...prev, page: Math.min(totalPages, safePage + 1) }) })}
                disabled={safePage >= totalPages}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-semibold uppercase tracking-widest hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Próxima página"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </PublicShell>
  );
}

function getPageWindow(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const push = (n: number | "…") => out.push(n);
  const add = new Set<number>([1, total, current, current - 1, current + 1]);
  const pages = [...add].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) push("…");
    push(p);
    prev = p;
  }
  return out;
}
