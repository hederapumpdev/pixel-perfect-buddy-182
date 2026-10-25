// Browser-safe list of official ecosystem accounts, plus the mention helper used by automatic posts.
// Handles were checked against each project's own published channel list on 2026-10-24:
// Hedera -> @hedera, SaucerSwap Labs -> @SaucerSwapLabs, HashPack -> @hashpack,
// Hedera Community -> @HederaCommunity, SODAX -> @gosodax.
// Hedex -> @1hedex (checked 2026-10-25 through the X API: profile name HEDEX,
// website link resolves to https://hedex.dev).
// Pump.fun -> @Pumpfun (checked 2026-10-25 through the X API: account name "Pump.fun").

export const HEDERA_HANDLES = {
  hedera: "@hedera",
  saucerswap: "@SaucerSwapLabs",
  hashpack: "@hashpack",
  community: "@HederaCommunity",
  sodax: "@gosodax",
  hedex: "@1hedex",
  pumpfun: "@Pumpfun",
} as const;

export type HandleKey = keyof typeof HEDERA_HANDLES;

export const X_LIMIT = 280;

/**
 * X counts any link as 23 characters, so the same weighting is applied here.
 * X also auto-links bare domains ("pump.fun"), so those cost the same as a full URL —
 * counting them as plain text let a post that looked short get truncated when published.
 */
const LINKED_TLDS = "com|dev|fun|io|app|net|org|finance|xyz|co|ai|gg|sh|to|me|cc|social|network|cloud|site|live|exchange|tools";
const BARE_DOMAIN = new RegExp(`\\b[\\w-]+(?:\\.[\\w-]+)*\\.(?:${LINKED_TLDS})\\b(?:/\\S*)?`, "gi");

export const xWeight = (text: string) =>
  [...text.replace(/https?:\/\/\S+/g, "x".repeat(23)).replace(BARE_DOMAIN, "x".repeat(23))].length;

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
  if (/hedex/i.test(topic)) out.push("hedex");
  return out;
}

/** X handles mean nothing on Telegram or Discord, so copies for those channels drop them. */
export function stripMentions(text: string): string {
  const handles = new Set(Object.values(HEDERA_HANDLES).map((handle) => handle.toLowerCase()));
  return text
    .split("\n")
    .filter((line) => {
      const words = line.trim().split(/\s+/);
      return !(words.length && words.every((word) => handles.has(word.toLowerCase())));
    })
    .join("\n");
}
