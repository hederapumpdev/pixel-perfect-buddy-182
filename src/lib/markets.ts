// Pure helpers for the Markets page (browser-safe). Data is display-only from SaucerSwap.
import { MARKET_FEE_BPS, WHBAR_TOKEN_ID } from "./hedera-config";

export type MarketToken = {
  id: string; name: string; symbol: string; icon: string | null; decimals: number;
  priceUsd: number; priceHbar: number; liquidityUsd: number;
  change1h: number | null; change24h: number | null; change7d: number | null;
  verified: boolean; pool: string;
  /** "dex" = a SaucerSwap pool; "curve" = a HederaPump coin still bonding on us. */
  source: "dex" | "curve";
};

type PoolSide = { id: string; name: string; symbol: string; icon?: string | null; decimals: number; priceUsd: number; dueDiligenceComplete?: number | boolean };
export type RawPool = { contractId: string; tokenA: PoolSide; tokenB: PoolSide; tokenReserveA: string; tokenReserveB: string };
export type RawChange = { id: string; priceChangeHour?: number; priceChangeDay?: number; priceChangeWeek?: number };

/** Below this USD liquidity a coin gets a clear low-liquidity warning. */
export const LOW_LIQUIDITY_USD = 1_000;

const BLOCKED_WORDS = new Set([
  "nigger", "nigga", "niga", "nig", "niggers", "faggot", "faggots", "fag", "fags",
  "kike", "kikes", "spic", "spics", "coon", "coons", "retard", "retards", "tranny",
  "chink", "gook", "gooks", "rape", "rapist", "nazi", "nazis", "hitler", "jihad", "pedo",
]);

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Slurs and hate words are kept off our own pages; the chain and SaucerSwap are untouched. */
export function isListable(name: string, symbol: string): boolean {
  return ![...words(name), ...words(symbol)].some(
    (w) => BLOCKED_WORDS.has(w) || w.startsWith("nigg") || w.startsWith("fagg"),
  );
}

/**
 * Hedera entity number of a "0.0.x" id. Hedera hands out these numbers in creation
 * order, so a higher one is a newer token — that is what the "New" sort uses.
 */
export function entityNum(id: string): number {
  const m = /^0\.0\.(\d{1,12})$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** One row per token with an HBAR (new WHBAR) pool; deepest pool wins. */
export function buildMarkets(pools: RawPool[], changes: RawChange[], hbarUsd: number): MarketToken[] {
  const ch = new Map(changes.map((c) => [c.id, c]));
  const best = new Map<string, MarketToken>();
  for (const p of pools) {
    const hbarIsA = p.tokenA.id === WHBAR_TOKEN_ID;
    if (!hbarIsA && p.tokenB.id !== WHBAR_TOKEN_ID) continue;
    const t = hbarIsA ? p.tokenB : p.tokenA;
    if (!isListable(t.name, t.symbol)) continue;
    const hbarReserve = Number(hbarIsA ? p.tokenReserveA : p.tokenReserveB) / 1e8;
    const tokReserve = Number(hbarIsA ? p.tokenReserveB : p.tokenReserveA) / 10 ** t.decimals;
    if (!(hbarReserve > 0) || !(tokReserve > 0)) continue;
    const priceHbar = hbarReserve / tokReserve;
    const row: MarketToken = {
      id: t.id, name: t.name, symbol: t.symbol, icon: t.icon ?? null, decimals: t.decimals,
      priceHbar, priceUsd: priceHbar * hbarUsd, liquidityUsd: hbarReserve * 2 * hbarUsd,
      change1h: ch.get(t.id)?.priceChangeHour ?? null,
      change24h: ch.get(t.id)?.priceChangeDay ?? null,
      change7d: ch.get(t.id)?.priceChangeWeek ?? null,
      verified: !!t.dueDiligenceComplete, pool: p.contractId, source: "dex",
    };
    const prev = best.get(t.id);
    if (!prev || row.liquidityUsd > prev.liquidityUsd) best.set(t.id, row);
  }
  return [...best.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
}

/** A HederaPump coin as kept in our own chain-synced table. */
export type OwnCoin = {
  address: string; name: string; symbol: string; icon: string | null;
  graduated: boolean; virtualHbar: number; virtualTokens: number;
};

/**
 * Adds our own coins that SaucerSwap has no pool for yet, so the list also shows
 * HederaPump launches. Their price comes from the bonding curve; they carry no
 * SaucerSwap liquidity figure (0) and no price change, and link to the coin page.
 * A coin that already has a pool, or one that already graduated, is never added twice.
 */
export function mergeOwnCoins(rows: MarketToken[], coins: OwnCoin[], hbarUsd: number): MarketToken[] {
  if (!(hbarUsd > 0)) return rows;
  const seen = new Set(rows.map((r) => r.id));
  const extra: MarketToken[] = [];
  for (const c of coins) {
    if (c.graduated || seen.has(c.address) || !isListable(c.name, c.symbol)) continue;
    if (!(c.virtualHbar > 0) || !(c.virtualTokens > 0)) continue;
    const priceHbar = c.virtualHbar / c.virtualTokens;
    extra.push({
      id: c.address, name: c.name, symbol: c.symbol, icon: c.icon, decimals: 8,
      priceHbar, priceUsd: priceHbar * hbarUsd, liquidityUsd: 0,
      change1h: null, change24h: null, change7d: null,
      verified: false, pool: "bonding-curve", source: "curve",
    });
  }
  return [...rows, ...extra];
}

/** HBAR/USD rate read back out of a priced row (priceUsd = priceHbar x hbarUsd). */
export function hbarUsdFrom(rows: MarketToken[]): number {
  const r = rows.find((x) => x.priceHbar > 0 && x.priceUsd > 0);
  return r ? r.priceUsd / r.priceHbar : 0;
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
