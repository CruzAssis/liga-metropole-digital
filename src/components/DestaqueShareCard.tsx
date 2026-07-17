import { useState } from "react";
import { Share2, MessageCircle, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  type DestaqueShareData,
  whatsappShareUrl,
  copyMatchLink,
  nativeShare,
  matchUrl,
} from "@/lib/share";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DestaqueShareCardProps {
  data: DestaqueShareData;
  /** If true, shows the full card layout (public match page). Default: true */
  fullCard?: boolean;
}

// ─── Visual card component ────────────────────────────────────────────────────

export function DestaqueShareCard({ data, fullCard = true }: DestaqueShareCardProps) {
  const [copied, setCopied] = useState(false);
  const hasScore = data.scoreCasa !== null && data.scoreVisitante !== null;

  async function handleCopy() {
    const ok = await copyMatchLink(data.matchId);
    if (ok) {
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Não foi possível copiar o link");
    }
  }

  function handleWhatsApp() {
    window.open(whatsappShareUrl(data), "_blank", "noopener,noreferrer");
  }

  async function handleNativeShare() {
    await nativeShare(data);
  }

  const ratingColor =
    data.rating >= 9 ? "text-yellow-400" :
    data.rating >= 7 ? "text-green-400" :
    "text-zinc-300";

  if (!fullCard) {
    // Compact inline version — just the share buttons
    return (
      <div className="flex flex-wrap gap-2 items-center mt-3">
        <ShareButtons
          onWhatsApp={handleWhatsApp}
          onCopy={handleCopy}
          onNative={handleNativeShare}
          copied={copied}
          compact
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-700 bg-gradient-to-br from-zinc-900 via-zinc-900 to-blue-950/30 shadow-xl">
      {/* Header — Liga branding */}
      <div className="bg-[#1565F5] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Liga Metrópole shield */}
          <img
            src="/__l5e/assets-v1/3c66aee9-99bb-4064-8206-4d8a7d43a64d/liga-metropole-logo.png"
            alt="Liga Metrópole"
            className="w-8 h-8 object-contain shrink-0"
            draggable={false}
          />
          <span className="text-white font-bold text-sm tracking-wide uppercase">
            Liga Metrópole
          </span>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-xs font-semibold">
          ⭐ Destaque
        </Badge>
      </div>

      {/* Main content */}
      <div className="p-5 space-y-4">
        {/* Round + Stage info */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
            Rodada {data.rodada}
          </Badge>
          {data.stage && (
            <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
              {data.stage}
            </Badge>
          )}
          {data.conferencia && (
            <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-xs">
              {data.conferencia}
            </Badge>
          )}
        </div>

        {/* Match score */}
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-white font-semibold text-sm text-right flex-1 truncate">
            {data.teamCasa}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {hasScore ? (
              <>
                <span className="text-white font-black text-2xl w-7 text-center">
                  {data.scoreCasa}
                </span>
                <span className="text-zinc-500 font-bold text-lg">x</span>
                <span className="text-white font-black text-2xl w-7 text-center">
                  {data.scoreVisitante}
                </span>
              </>
            ) : (
              <span className="text-zinc-500 font-bold text-lg px-2">vs</span>
            )}
          </div>
          <span className="text-white font-semibold text-sm text-left flex-1 truncate">
            {data.teamVisitante}
          </span>
        </div>

        {/* Destaque player */}
        <div className="bg-zinc-800/60 rounded-xl p-4 flex items-center gap-4">
          {/* Avatar circle */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1565F5]/40 to-blue-900/60 border-2 border-[#1565F5]/50 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xl leading-none">
              {data.playerName
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">
              Destaque da Partida
            </p>
            <p className="text-white font-bold text-base truncate">{data.playerName}</p>
          </div>

          {/* Rating */}
          <div className="text-center shrink-0">
            <span className={`font-black text-3xl ${ratingColor}`}>
              {data.rating.toFixed(1)}
            </span>
            <p className="text-zinc-500 text-xs mt-0.5">Nota</p>
          </div>
        </div>

        {/* Share buttons */}
        <div className="pt-1">
          <p className="text-zinc-500 text-xs mb-2">Compartilhar</p>
          <ShareButtons
            onWhatsApp={handleWhatsApp}
            onCopy={handleCopy}
            onNative={handleNativeShare}
            copied={copied}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Share Buttons sub-component ─────────────────────────────────────────────

interface ShareButtonsProps {
  onWhatsApp: () => void;
  onCopy: () => void;
  onNative: () => void;
  copied: boolean;
  compact?: boolean;
}

function ShareButtons({ onWhatsApp, onCopy, onNative, copied, compact }: ShareButtonsProps) {
  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap gap-2">
      {/* WhatsApp */}
      <Button
        size={size}
        onClick={onWhatsApp}
        className="bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold"
      >
        <MessageCircle className="w-4 h-4" />
        {!compact && "WhatsApp"}
      </Button>

      {/* Copy link */}
      <Button
        size={size}
        variant="outline"
        onClick={onCopy}
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-400" />
            {!compact && "Copiado!"}
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            {!compact && "Copiar link"}
          </>
        )}
      </Button>

      {/* Native share — only if Web Share API available (mobile) */}
      {hasNativeShare && (
        <Button
          size={size}
          variant="outline"
          onClick={onNative}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
        >
          <Share2 className="w-4 h-4" />
          {!compact && "Compartilhar"}
        </Button>
      )}
    </div>
  );
}

// ─── Inline compact version for embedding in the sumula page ─────────────────

export function DestaqueInlineShare({ data }: { data: DestaqueShareData }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyMatchLink(data.matchId);
    if (ok) {
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 space-y-3">
      {/* Compact destaque info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1565F5]/20 border border-[#1565F5]/40 flex items-center justify-center shrink-0">
          <span className="text-[#1565F5] font-black text-xs">
            {data.playerName
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500">⭐ Destaque da Partida</p>
          <p className="text-white font-semibold text-sm truncate">{data.playerName}</p>
        </div>
        <span className="font-black text-xl text-yellow-400 shrink-0">
          {data.rating.toFixed(1)}
        </span>
      </div>

      {/* Share actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs font-semibold"
          onClick={() => window.open(whatsappShareUrl(data), "_blank", "noopener,noreferrer")}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Compartilhar no WhatsApp
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /> Copiado!</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copiar link</>
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-500 hover:text-zinc-300 gap-1.5 text-xs"
          onClick={() => window.open(matchUrl(data.matchId), "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver partida
        </Button>
      </div>
    </div>
  );
}
