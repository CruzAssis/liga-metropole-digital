import { cn } from "@/lib/utils";
import { VerifiedSeal } from "./VerifiedSeal";

function initials(name?: string | null, fallback?: string | null): string {
  const src = (name ?? fallback ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AthleteAvatar({
  photoUrl,
  name,
  nickname,
  verified,
  size = 64,
  className,
}: {
  photoUrl?: string | null;
  name?: string | null;
  nickname?: string | null;
  verified?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={nickname ?? name ?? "Atleta"}
          className="h-full w-full rounded-full object-cover border border-border"
        />
      ) : (
        <div
          className="h-full w-full rounded-full bg-background/60 border border-border flex items-center justify-center font-display tracking-wider text-foreground/80"
          style={{ fontSize: size * 0.4 }}
        >
          {initials(nickname, name)}
        </div>
      )}
      {verified && <VerifiedSeal size={Math.max(16, Math.round(size * 0.3))} />}
    </div>
  );
}
