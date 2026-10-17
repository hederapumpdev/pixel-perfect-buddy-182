/**
 * Turns whatever a creator typed into a real, clickable link.
 *
 * The launch form asks for "@handle" and "t.me/…", so stored values are often
 * not full URLs. Putting a bare "@handle" into an href points the browser back
 * at this site, so every social link on the coin page goes through here first.
 */
export type SocialKind = "twitter" | "telegram" | "website";

export function socialUrl(kind: SocialKind, raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;

  if (kind === "twitter") {
    const handle = v.replace(/^@+/, "").replace(/^(x|twitter)\.com\//i, "");
    return handle ? `https://x.com/${handle}` : null;
  }

  if (kind === "telegram") {
    const path = v.replace(/^@+/, "").replace(/^t\.me\//i, "");
    return path ? `https://t.me/${path}` : null;
  }

  // Website typed without a scheme, e.g. "hederapump.dev".
  return /^[\w-]+(\.[\w-]+)+/.test(v) ? `https://${v}` : null;
}
