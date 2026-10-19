// Browser-safe helpers for picking official-coin themes from trending tokens.

export type TrendingCandidate = { name: string; symbol: string; chain: string };

/** Keeps only names/tickers that fit the launchpad rules (name 2–32, ticker 2–10 A–Z0–9). */
export function sanitizeTrending(raw: { name?: string | undefined; symbol?: string | undefined; chain?: string | undefined }): TrendingCandidate | null {
  const name = (raw.name ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
  const symbol = (raw.symbol ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  if (name.length < 2 || !/^[A-Z0-9]{2,10}$/.test(symbol)) return null;
  return { name, symbol, chain: raw.chain ?? "unknown" };
}

/** First candidate whose name and ticker are not already used on the launchpad. */
export function pickTrending(candidates: TrendingCandidate[], taken: Set<string>): TrendingCandidate | null {
  return candidates.find((c) => !taken.has(c.symbol.toLowerCase()) && !taken.has(c.name.toLowerCase())) ?? null;
}
