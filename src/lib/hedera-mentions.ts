// Browser-safe list of official ecosystem accounts, plus the mention helper used by automatic posts.
// Handles were checked against each project's own published channel list on 2026-10-24:
// Hedera -> @hedera, SaucerSwap Labs -> @SaucerSwapLabs, HashPack -> @hashpack,
// Hedera Community -> @HederaCommunity, SODAX -> @gosodax.

export const HEDERA_HANDLES = {
  hedera: "@hedera",
  saucerswap: "@SaucerSwapLabs",
  hashpack: "@hashpack",
  community: "@HederaCommunity",
  sodax: "@gosodax",
} as const;

export type HandleKey = keyof typeof HEDERA_HANDLES;

export const X_LIMIT = 280;

/** X counts any link as 23 characters, so the same weighting is applied here. */
export const xWeight = (text: string) => [...text.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;

/**
 * Adds mentions to a post, dropping the ones that no longer fit inside the X limit.
 * A trailing hashtag line stays last; the mention line goes directly above it.
 */
export function addMentions(text: string, handles: HandleKey[], limit = X_LIMIT): string {
  const wanted = [...new Set(handles)].map((key) => HEDERA_HANDLES[key]);
  const kept: string[] = [];
  for (const handle of wanted) {
    if (xWeight(renderMentions(text, [...kept, handle])) <= limit) kept.push(handle);
  }
  return renderMentions(text, kept);
}

function renderMentions(text: string, handles: string[]) {
  if (!handles.length) return text;
  const line = handles.join(" ");
  const lines = text.split("\n");
  const last = lines[lines.length - 1] ?? "";
  if (last.startsWith("#")) return [...lines.slice(0, -1), line, last].join("\n");
  return `${text}\n\n${line}`;
}

/** Daily app tweets only name an account when the topic is actually about that account. */
export function dailyMentions(topic: string): HandleKey[] {
  const out: HandleKey[] = [];
  if (/saucerswap/i.test(topic)) out.push("saucerswap");
  if (/hashpack/i.test(topic)) out.push("hashpack");
  if (/sodax/i.test(topic)) out.push("sodax");
  return out;
}
