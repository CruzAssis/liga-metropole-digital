// Stable public origin for shareable links (invites, WhatsApp, etc).
// window.location.origin points to the Lovable editor/preview when the
// director opens the app inside lovable.dev, which then sends recipients
// to a Lovable signup page instead of our app. We always build public
// links against the published domain.
export const PUBLIC_ORIGIN = "https://liga-metropole-digital.lovable.app";

export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_ORIGIN}${p}`;
}
