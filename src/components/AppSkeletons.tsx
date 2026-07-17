// ─── App-wide Skeleton Loaders ───────────────────────────────────────────────
// Reutilizavel em ranking, resultados, agenda, times, atletas
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ShieldOff, Trophy, Users } from "lucide-react";

// ── Generic card row skeleton (match card / result card)
export function SkeletonMatchCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-6 w-14 rounded" />
        <Skeleton className="h-5 w-24 rounded" />
      </div>
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  );
}

// ── List of match card skeletons
export function SkeletonMatchList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMatchCard key={i} />
      ))}
    </div>
  );
}

// ── Ranking / standings table skeleton
export function SkeletonStandingsTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        {[10, 120, 24, 24, 24, 24, 24, 24].map((w, i) => (
          <Skeleton key={i} className="h-3 rounded" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5 border-b border-border last:border-0">
          <Skeleton className="h-4 w-5 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
          {[24, 24, 24, 24, 24, 24, 24].map((w, j) => (
            <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Team grid card skeleton
export function SkeletonTeamCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col items-center gap-3">
      <Skeleton className="h-20 w-20 rounded-full" />
      <Skeleton className="h-5 w-28 rounded" />
      <Skeleton className="h-4 w-16 rounded" />
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  );
}

export function SkeletonTeamGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTeamCard key={i} />
      ))}
    </div>
  );
}

// ── Athlete card skeleton
export function SkeletonAthleteCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonAthleteGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonAthleteCard key={i} />
      ))}
    </div>
  );
}

// ── Ranking tab skeleton (two tabs)
export function SkeletonRankingPage() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <SkeletonStandingsTable rows={10} />
    </div>
  );
}

// ── Empty state components ────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-4 text-center">
      {icon && (
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="font-display text-xl tracking-wide text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && action}
    </div>
  );
}

// Pre-built empty states for each section
export function EmptyRanking() {
  return (
    <EmptyState
      icon={<Trophy className="h-7 w-7" />}
      title="A temporada ainda nao comecou"
      description="A classificacao sera exibida assim que os jogos comecarem. Acompanhe as novidades!"
    />
  );
}

export function EmptyResultados({ rodada }: { rodada: number }) {
  return (
    <EmptyState
      icon={<ShieldOff className="h-7 w-7" />}
      title="Nenhum resultado ainda"
      description={`Nenhum resultado disponivel para a Rodada ${rodada}. Os resultados aparecem apos a confirmacao da sumula.`}
    />
  );
}

export function EmptyAgenda({ rodada }: { rodada: number }) {
  return (
    <EmptyState
      icon={<Calendar className="h-7 w-7" />}
      title="Nenhum jogo agendado"
      description={`Nenhum jogo agendado para a Rodada ${rodada}. O sorteio sera realizado em breve.`}
    />
  );
}

export function EmptyTimes() {
  return (
    <EmptyState
      icon={<Users className="h-7 w-7" />}
      title="Nenhum time cadastrado"
      description="Os times aprovados aparecerao aqui. As inscricoes podem estar abertas!"
    />
  );
}

export function EmptyAtletas() {
  return (
    <EmptyState
      icon={<Users className="h-7 w-7" />}
      title="Nenhum atleta cadastrado"
      description="Os atletas verificados aparecerao aqui apos realizarem seu ID Metropole."
    />
  );
}

// ── Admin: standardized section skeletons ────────────────────────────────────
// All admin secondary pages compose these three primitives (Header + Stats + Table/CardList)
// to guarantee identical dimensions/spacing across routes.

// Section: page header (title + subtitle + optional actions)
export function SkeletonAdminHeader({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2 min-w-0">
        <Skeleton className="h-7 w-56 max-w-full rounded" />
        <Skeleton className="h-4 w-72 max-w-full rounded" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}

// Section: KPI/totals row (2, 3 or 4 metrics)
export function SkeletonStatsRow({ count = 4 }: { count?: number }) {
  const gridCls =
    count === 2 ? "grid-cols-2" : count === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-3 sm:gap-4 ${gridCls}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 space-y-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-8 w-28 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

// Section: tabular list (rows share height/columns across pages)
export function SkeletonAdminRow() {
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 h-14 border-b border-zinc-800 last:border-0">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
      <Skeleton className="h-5 w-16 rounded hidden sm:block" />
      <Skeleton className="h-8 w-20 rounded shrink-0" />
    </div>
  );
}

export function SkeletonAdminList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonAdminRow key={i} />
      ))}
    </div>
  );
}

// Section: card list (ligas / sorteio-style detailed entities)
export function SkeletonAdminCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-5 w-48 max-w-full rounded" />
          <Skeleton className="h-3 w-32 max-w-full rounded" />
        </div>
        <Skeleton className="h-6 w-24 rounded" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonAdminCardList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonAdminCard key={i} />
      ))}
    </div>
  );
}

// Full-page composition — Header + Stats + Table (default) or CardList
export function SkeletonAdminPage({
  stats = 4,
  actions = 2,
  variant = "list",
  rows = 6,
  cards = 3,
}: {
  stats?: number;
  actions?: number;
  variant?: "list" | "cards";
  rows?: number;
  cards?: number;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SkeletonAdminHeader actions={actions} />
      {stats > 0 && <SkeletonStatsRow count={stats} />}
      {variant === "list" ? <SkeletonAdminList rows={rows} /> : <SkeletonAdminCardList count={cards} />}
    </div>
  );
}

// ── Loading button spinner ─────────────────────────────────────────────────────
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
