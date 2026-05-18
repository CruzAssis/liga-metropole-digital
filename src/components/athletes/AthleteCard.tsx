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
      className="text-left rounded-lg border border-border bg-card p-4 hover:border-primary/60 transition-colors w-full"
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
          <div className="font-display text-xl tracking-wide truncate">
            {athlete.nickname || athlete.full_name || "Atleta sem nome"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
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
      <div className="font-display text-lg leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
