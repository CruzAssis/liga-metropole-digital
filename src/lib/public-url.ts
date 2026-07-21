// Stable public origin for shareable links (invites, WhatsApp, etc).
// window.location.origin points to the Lovable editor/preview when the
// director opens the app inside lovable.dev, which then sends recipients
// to a Lovable signup page instead of our app. We always build public
// links against the published domain.
export const PUBLIC_ORIGIN = "https://liga-metropole-digital.lovable.app";

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    const url = new URL(trimmed, PUBLIC_ORIGIN);
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    return fallback;
  }
}

export function publicUrl(path: string): string {
  const p = safeInternalPath(path, "/");
  return `${PUBLIC_ORIGIN}${p}`;
}
