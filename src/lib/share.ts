// ─── Share utilities for Liga Metrópole ──────────────────────────────────────
// Used by DestaqueShareCard to share match highlights via WhatsApp, clipboard, etc.

const APP_BASE_URL = "https://ligametropole.app";

export interface DestaqueShareData {
  matchId: string;
  playerName: string;
  rating: number; // e.g. 9.2
  teamCasa: string;
  teamVisitante: string;
  scoreCasa: number | null;
  scoreVisitante: number | null;
  rodada: number | string;
  stage?: string; // e.g. "Fase de Grupos"
  conferencia?: string; // e.g. "Conferência Sul"
}

/** Full public URL for a match */
export function matchUrl(matchId: string): string {
  return `${APP_BASE_URL}/partida/${matchId}`;
}

/** WhatsApp deep link with pre-formatted message */
export function whatsappShareUrl(data: DestaqueShareData): string {
  const placar =
    data.scoreCasa !== null && data.scoreVisitante !== null
      ? ` (${data.scoreCasa}x${data.scoreVisitante})`
      : "";

  const text =
    `⚽ *Destaque da Rodada ${data.rodada} — Liga Metrópole*` +
    `

` +
    `🌟 *${data.playerName}* foi o destaque do jogo` +
    `
${data.teamCasa} x ${data.teamVisitante}${placar}` +
    `
com nota *${data.rating.toFixed(1)}*` +
    `

` +
    `🔗 Confira: ${matchUrl(data.matchId)}`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Copy the match link to clipboard. Returns true on success. */
export async function copyMatchLink(matchId: string): Promise<boolean> {
  const url = matchUrl(matchId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback for older browsers
    const el = document.createElement("textarea");
    el.value = url;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

/** Native Web Share API (Android/iOS "share sheet") — fallback to WhatsApp */
export async function nativeShare(data: DestaqueShareData): Promise<boolean> {
  const placar =
    data.scoreCasa !== null && data.scoreVisitante !== null
      ? ` ${data.scoreCasa}x${data.scoreVisitante}`
      : "";

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `Destaque da Rodada ${data.rodada} — Liga Metrópole`,
        text:
          `⚽ ${data.playerName} foi o destaque do jogo ` +
          `${data.teamCasa} x ${data.teamVisitante}${placar} com nota ${data.rating.toFixed(1)}`,
        url: matchUrl(data.matchId),
      });
      return true;
    } catch (e) {
      // User cancelled or API unavailable
      if ((e as Error).name !== "AbortError") {
        console.warn("[share] navigator.share failed:", e);
      }
      return false;
    }
  }
  // Fallback: open WhatsApp
  window.open(whatsappShareUrl(data), "_blank", "noopener,noreferrer");
  return true;
}
