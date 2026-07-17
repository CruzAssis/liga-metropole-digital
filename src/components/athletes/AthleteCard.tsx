import { AthleteAvatar } from "./AthleteAvatar";

export type AthleteCardData = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  position: string | null;
  photo_url: string | null;
  verified: boolean;
  team_name?: string | null;
};

export function AthleteCard({
  athlete,
  onClick,
}: {
  athlete: AthleteCardData;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(21,101,245,0.35)] transition-all w-full"
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
        <Stat label="Gols" value="—" />
        <Stat label="Assist." value="—" />
        <Stat label="Nota" value="—" />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 py-2">
      <div className="stat-number text-xl">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">{label}</div>
    </div>
  );
}

