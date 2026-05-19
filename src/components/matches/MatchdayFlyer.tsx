import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type TeamLite = {
  name: string;
  short_name: string;
  logo_url: string | null;
};

export type MatchdayFlyerData = {
  host: TeamLite;
  visitor: TeamLite;
  round: number;
  stage: string;
  venue: string | null;
  scheduled_at: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: MatchdayFlyerData;
};

export function MatchdayFlyer({ open, onOpenChange, data }: Props) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [format, setFormat] = useState<"square" | "story">("square");

  const date = data.scheduled_at ? new Date(data.scheduled_at) : null;
  const dateStr = date
    ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }).toUpperCase()
    : "A DEFINIR";
  const timeStr = date
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const download = async () => {
    if (!flyerRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#020817",
      });
      const link = document.createElement("a");
      link.download = `matchday-${data.host.short_name}-vs-${data.visitor.short_name}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Flyer baixado!");
    } catch (e) {
      toast.error("Não foi possível gerar o flyer: " + (e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const isStory = format === "story";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Flyer da partida</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={format === "square" ? "default" : "outline"}
            onClick={() => setFormat("square")}
          >
            1:1 Feed
          </Button>
          <Button
            size="sm"
            variant={format === "story" ? "default" : "outline"}
            onClick={() => setFormat("story")}
          >
            9:16 Story
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-md bg-black/40 p-4 flex justify-center">
          <div
            ref={flyerRef}
            style={{
              width: isStory ? 360 : 480,
              height: isStory ? 640 : 480,
              background:
                "radial-gradient(ellipse at top, #0b3b2a 0%, #020817 55%, #000 100%)",
              position: "relative",
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: "white",
              overflow: "hidden",
              borderRadius: 16,
            }}
          >
            {/* Glow accents */}
            <div
              style={{
                position: "absolute",
                top: -80,
                left: -80,
                width: 240,
                height: 240,
                background: "radial-gradient(circle, #22ff88aa 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -80,
                right: -80,
                width: 240,
                height: 240,
                background: "radial-gradient(circle, #1e40afaa 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />

            {/* Diagonal stripes */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(34,255,136,0.04) 0 2px, transparent 2px 24px)",
              }}
            />

            <div
              style={{
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                padding: isStory ? "32px 24px" : "28px 24px",
              }}
            >
              {/* Header */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    border: "1px solid #22ff88",
                    borderRadius: 999,
                    fontSize: 11,
                    letterSpacing: 3,
                    color: "#22ff88",
                    fontWeight: 700,
                  }}
                >
                  LIGA METRÓPOLE · {data.stage === "group" ? `RODADA ${data.round}` : data.stage.toUpperCase()}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: isStory ? 28 : 24,
                    fontWeight: 900,
                    letterSpacing: 4,
                    textShadow: "0 0 18px rgba(34,255,136,0.5)",
                  }}
                >
                  MATCHDAY
                </div>
              </div>

              {/* Teams */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  margin: isStory ? "32px 0" : "20px 0",
                }}
              >
                <TeamColumn team={data.host} side="left" isStory={isStory} />
                <div
                  style={{
                    fontSize: isStory ? 64 : 52,
                    fontWeight: 900,
                    fontStyle: "italic",
                    color: "#22ff88",
                    textShadow: "0 0 24px rgba(34,255,136,0.7)",
                  }}
                >
                  VS
                </div>
                <TeamColumn team={data.visitor} side="right" isStory={isStory} />
              </div>

              {/* Footer info */}
              <div
                style={{
                  borderTop: "1px solid rgba(34,255,136,0.3)",
                  paddingTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <FlyerRow icon="📅" label={dateStr} />
                <FlyerRow icon="⏰" label={timeStr} />
                <FlyerRow icon="📍" label={data.venue || "Local a definir"} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={download} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" />
            {downloading ? "Gerando..." : "Baixar PNG"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamColumn({ team, side, isStory }: { team: TeamLite; side: "left" | "right"; isStory: boolean }) {
  const size = isStory ? 110 : 96;
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "2px solid #22ff88",
          boxShadow: `0 0 24px rgba(34,255,136,0.4), inset 0 0 12px rgba(${side === "left" ? "34,255,136" : "30,64,175"},0.3)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={team.name}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 24, fontWeight: 900 }}>{team.short_name}</span>
        )}
      </div>
      <div
        style={{
          fontSize: isStory ? 16 : 14,
          fontWeight: 800,
          letterSpacing: 1,
          lineHeight: 1.1,
          maxWidth: 130,
        }}
      >
        {team.name}
      </div>
    </div>
  );
}

function FlyerRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}
