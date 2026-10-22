// Pure helpers for the Markets page (browser-safe). Data is display-only from SaucerSwap.
import { MARKET_FEE_BPS, WHBAR_TOKEN_ID } from "./hedera-config";

export type MarketToken = {
  id: string; name: string; symbol: string; icon: string | null; decimals: number;
  priceUsd: number; priceHbar: number; liquidityUsd: number;
  change1h: number | null; change24h: number | null; verified: boolean; pool: string;
};

type PoolSide = { id: string; name: string; symbol: string; icon?: string | null; decimals: number; priceUsd: number; dueDiligenceComplete?: number | boolean };
export type RawPool = { contractId: string; tokenA: PoolSide; tokenB: PoolSide; tokenReserveA: string; tokenReserveB: string };
export type RawChange = { id: string; priceChangeHour?: number; priceChangeDay?: number };

/** Below this USD liquidity a coin gets a clear low-liquidity warning. */
export const LOW_LIQUIDITY_USD = 1_000;

/** One row per token with an HBAR (new WHBAR) pool; deepest pool wins. */
export function buildMarkets(pools: RawPool[], changes: RawChange[], hbarUsd: number): MarketToken[] {
  const ch = new Map(changes.map((c) => [c.id, c]));
  const best = new Map<string, MarketToken>();
  for (const p of pools) {
    const hbarIsA = p.tokenA.id === WHBAR_TOKEN_ID;
    if (!hbarIsA && p.tokenB.id !== WHBAR_TOKEN_ID) continue;
    const t = hbarIsA ? p.tokenB : p.tokenA;
    const hbarReserve = Number(hbarIsA ? p.tokenReserveA : p.tokenReserveB) / 1e8;
    const tokReserve = Number(hbarIsA ? p.tokenReserveB : p.tokenReserveA) / 10 ** t.decimals;
    if (!(hbarReserve > 0) || !(tokReserve > 0)) continue;
    const priceHbar = hbarReserve / tokReserve;
    const row: MarketToken = {
      id: t.id, name: t.name, symbol: t.symbol, icon: t.icon ?? null, decimals: t.decimals,
      priceHbar, priceUsd: priceHbar * hbarUsd, liquidityUsd: hbarReserve * 2 * hbarUsd,
      change1h: ch.get(t.id)?.priceChangeHour ?? null, change24h: ch.get(t.id)?.priceChangeDay ?? null,
      verified: !!t.dueDiligenceComplete, pool: p.contractId,
    };
    const prev = best.get(t.id);
    if (!prev || row.liquidityUsd > prev.liquidityUsd) best.set(t.id, row);
  }
  return [...best.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}

/** HederaPump Markets fee on an amount in tinybars (1% = 100 bps), rounded down like the contract. */
export function marketFee(tinybars: bigint, bps = BigInt(MARKET_FEE_BPS)): bigint {
  return (tinybars * bps) / 10_000n;
}

export function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v === 0) return "$0";
  return `$${v.toPrecision(3)}`;
}
