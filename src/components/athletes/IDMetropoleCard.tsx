import { Badge } from "@/components/ui/badge";
import { AthleteAvatar } from "./AthleteAvatar";
import { Instagram, MessageCircle } from "lucide-react";

export type IDMetropoleData = {
  full_name: string | null;
  nickname: string | null;
  position: string | null;
  photo_url: string | null;
  verified: boolean;
  team_name?: string | null;
  whatsapp?: string | null;
  instagram_handle?: string | null;
};

export function IDMetropoleCard({ athlete }: { athlete: IDMetropoleData }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-card p-6">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04] text-[8rem] font-display tracking-widest flex items-center justify-center text-primary select-none"
      >
        ID METRÓPOLE
      </div>

      <div className="relative flex flex-col items-center gap-4 text-center">
        <AthleteAvatar
          photoUrl={athlete.photo_url}
          name={athlete.full_name}
          nickname={athlete.nickname}
          verified={athlete.verified}
          size={112}
        />
        <div>
          <div className="font-display text-4xl tracking-wide">
            {athlete.nickname || athlete.full_name || "—"}
          </div>
          {athlete.full_name && athlete.nickname && (
            <div className="text-sm text-muted-foreground">{athlete.full_name}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {athlete.team_name ?? "Sem time"}
            {athlete.position ? ` · ${athlete.position}` : ""}
          </div>
        </div>

        <Badge variant={athlete.verified ? "default" : "secondary"}>
          {athlete.verified ? "✓ ID Metrópole Verificado" : "Cadastro Pendente"}
        </Badge>

        {(athlete.whatsapp || athlete.instagram_handle) && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {athlete.whatsapp && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4" /> {athlete.whatsapp}
              </span>
            )}
            {athlete.instagram_handle && (
              <span className="inline-flex items-center gap-1">
                <Instagram className="h-4 w-4" /> @{athlete.instagram_handle.replace(/^@/, "")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
