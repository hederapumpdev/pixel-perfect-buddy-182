import { createServerFn } from "@tanstack/react-start";
import { MIRROR_URL, SAUCERSWAP_API } from "./hedera-config";
import { tokenDetails, tokenPools, type HolderInfo, type MarketTokenInfo } from "./market-token-info";
import type { RawPool } from "./markets";

const cache = new Map<string, { at: number; data: MarketTokenInfo }>();
type BalancePage = { balances: { account: string; balance: number | string }[]; links?: { next?: string | null }; timestamp?: string };

export async function readTokenHolders(id: string, fetcher: typeof fetch = fetch): Promise<HolderInfo> {
  const result: HolderInfo = { count: 0, complete: false, top: [], timestamp: null };
  let path: string | null = `/api/v1/tokens/${id}/balances?limit=100&order=desc&balance=gt:0`;
  const signal = AbortSignal.timeout(12_000);
  try {
    for (let page = 0; path && page < 20; page++) {
      // Only allow mirror-node pagination paths, never arbitrary upstream URLs.
      if (!path.startsWith(`/api/v1/tokens/${id}/balances?`)) throw new Error("Invalid pagination");
      const response = await fetcher(`${MIRROR_URL}${path}`, { signal });
      if (!response.ok) throw new Error("Holders unavailable");
      const data = await response.json() as BalancePage;
      const positive = data.balances.filter((b) => BigInt(b.balance) > 0n);
      result.count = (result.count ?? 0) + positive.length;
      if (page === 0) {
        result.timestamp = data.timestamp ?? null;
        result.top = positive.slice(0, 10).map((b) => ({ account: b.account, balance: String(b.balance) }));
      }
      path = data.links?.next ?? null;
    }
    result.complete = path === null;
  } catch {
    if (result.count === 0) result.count = null;
  }
  return result;
}

export const marketTokenInfo = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => {
    if (!/^0\.0\.\d{1,12}$/.test(data.id)) throw new Error("Invalid token id");
    return { id: data.id };
  })
  .handler(async ({ data }): Promise<MarketTokenInfo> => {
    const previous = cache.get(data.id);
    if (previous && Date.now() - previous.at < 300_000) return previous.data;
    const [token, pools, holders] = await Promise.all([
      fetch(`${MIRROR_URL}/api/v1/tokens/${data.id}`, { signal: AbortSignal.timeout(10_000) }).then(async (r) => r.ok ? tokenDetails(await r.json()) : null).catch(() => null),
      fetch(`${SAUCERSWAP_API}/pools`, { signal: AbortSignal.timeout(10_000) }).then(async (r) => r.ok ? tokenPools(data.id, await r.json() as RawPool[]) : null).catch(() => null),
      readTokenHolders(data.id),
    ]);
    const result: MarketTokenInfo = { token, pools, holders, fetchedAt: new Date().toISOString(), lpBurned: "unknown", lpLocked: "unknown" };
    if (cache.size >= 100) { const first = cache.keys().next().value; if (first) cache.delete(first); }
    cache.set(data.id, { at: Date.now(), data: result });
    return result;
  });