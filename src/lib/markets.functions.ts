import { createServerFn } from "@tanstack/react-start";
import { SAUCERSWAP_API, WHBAR_TOKEN_ID } from "./hedera-config";
import { buildMarkets, type MarketToken, type RawChange, type RawPool } from "./markets";

let cache: { at: number; data: MarketToken[] } | null = null;

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${SAUCERSWAP_API}${path}`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`SaucerSwap [${r.status}]`);
  return (await r.json()) as T;
}

export const listMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<MarketToken[]> => {
  if (cache && Date.now() - cache.at < 180_000) return cache.data;
  try {
    const [pools, changes] = await Promise.all([getJson<RawPool[]>("/pools"), getJson<(RawChange & { priceUsd?: number })[]>("/tokens/default")]);
    const hbarUsd = changes.find((c) => c.id === WHBAR_TOKEN_ID)?.priceUsd ?? 0;
    const data = buildMarkets(pools, changes, hbarUsd);
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("Markets load failed", e);
    if (cache) return cache.data;
    throw new Error("Market data is temporarily unavailable");
  }
});

export type PricePoint = { t: number; usd: number; volumeUsd: number };

export const marketHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => {
    if (!/^0\.0\.\d{1,12}$/.test(d.id)) throw new Error("Invalid token id");
    return d;
  })
  .handler(async ({ data }): Promise<PricePoint[]> => {
    const to = Math.floor(Date.now() / 1000);
    try {
      const rows = await getJson<{ timestampSeconds?: number; startTimestampSeconds?: number; closeUsd: number; volumeUsd?: number }[]>(
        `/tokens/prices/${data.id}?interval=HOUR&from=${to - 7 * 86_400}&to=${to}`,
      );
      return rows.map((r) => ({ t: r.timestampSeconds ?? r.startTimestampSeconds ?? 0, usd: r.closeUsd, volumeUsd: r.volumeUsd ?? 0 }));
    } catch (e) {
      console.error("History load failed", e);
      return [];
    }
  });
