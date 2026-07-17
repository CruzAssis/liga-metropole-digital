import { Star, Trophy, Target } from "lucide-react";
import { AthleteAvatar } from "./AthleteAvatar";

export type AthleteCardData = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  position: string | null;
  photo_url: string | null;
  verified: boolean;
  team_name?: string | null;
  avg_rating?: number | null;
  total_evaluations?: number | null;
  goals?: number | null;
};

const STAR_MAX = 6;

export function AthleteCard({
  athlete,
  onClick,
}: {
  athlete: AthleteCardData;
  onClick?: () => void;
}) {
  const hasRating = (athlete.total_evaluations ?? 0) > 0;
  const avg = hasRating ? Number(athlete.avg_rating ?? 0).toFixed(1) : "—";
  const times = athlete.total_evaluations ?? 0;
  const goals = athlete.goals ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-hover text-left rounded-xl border border-border bg-card p-4 w-full"
    >
      <div className="flex items-center gap-3">
        <AthleteAvatar
          photoUrl={athlete.photo_url}
          name={athlete.full_name}
          nickname={athlete.nickname}
          verified={athlete.verified}
          size={56}
        />
        <div className="min-w-0">
          <div className="font-display text-2xl tracking-wide uppercase leading-none truncate">
            {athlete.nickname || athlete.full_name || "Atleta sem nome"}
          </div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground truncate mt-1.5 font-semibold">
            {athlete.team_name ?? "Sem time"}
            {athlete.position ? ` · ${athlete.position}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat
          icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
          label="Estrelas"
          value={hasRating ? `${avg}/${STAR_MAX.toFixed(1)}` : "—"}
        />
        <Stat
          icon={<Trophy className="h-3.5 w-3.5 text-amber-400" />}
          label="Destaque"
          value={String(times)}
        />
        <Stat
          icon={<Target className="h-3.5 w-3.5 text-blue-400" />}
          label="Gols"
          value={String(goals)}
        />
      </div>
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 py-2">
      <div className="stat-number text-lg flex items-center justify-center gap-1">
        {icon}
        <span>{value}</span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
        {label}
      </div>
    </div>
  );
}
