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

/**
 * Only hate speech stays off our own pages: racial, ethnic and homophobic slurs,
 * Nazi words and child-abuse words. Ordinary swear words (shit, fuck, bitch, ...)
 * are listed like any other coin — they are real coins with real pools.
 * The chain and SaucerSwap are untouched either way.
 */
const BLOCKED_WORDS = new Set([
  "nigger", "nigga", "niga", "nig", "niggers", "faggot", "faggots", "fag", "fags",
  "kike", "kikes", "spic", "spics", "coon", "coons", "retard", "retards", "tranny",
  "chink", "gook", "gooks", "rape", "rapist", "nazi", "nazis", "hitler", "pedo",
]);

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** True unless the name or symbol is hate speech; ordinary profanity passes. */
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

// --- Trading through HederaPumpRouter (visible 1% fee, swaps on SaucerSwap V1) ---

import { encodeFunctionData, type Abi } from "viem";
import routerArtifact from "./contract-artifact-router.json";
import { MIRROR_URL, SAUCERSWAP_V1_ROUTER_ID } from "./hedera-config";

/** Slippage tolerance on Markets trades (3%), same as the bonding-curve trade box. */
export const MARKET_SLIPPAGE_BPS = 300n;
/** Seconds a signed Markets trade stays valid. */
export const MARKET_DEADLINE_SECS = 1_200;

/** 0.0.N entity id -> its long-zero EVM address. */
export const idToEvm = (id: string) => `0x${BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0")}`;

/** Encodes a call on HederaPumpRouter (buy or sell). */
export const encodeMarketRouter = (functionName: string, args: unknown[] = []) =>
  encodeFunctionData({ abi: routerArtifact.abi as Abi, functionName, args } as never);

const SAUCER_ROUTER_ABI = [
  { name: "getAmountsOut", type: "function", stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }] },
] as const;

/** SaucerSwap V1 quote: how much comes out for amountIn along [from, to]. */
export async function quoteAmountsOut(amountIn: bigint, path: [string, string]): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to: idToEvm(SAUCERSWAP_V1_ROUTER_ID),
      data: encodeFunctionData({ abi: SAUCER_ROUTER_ABI as unknown as Abi, functionName: "getAmountsOut", args: [amountIn, path] } as never),
      estimate: false,
    }),
  });
  if (!r.ok) throw new Error("Couldn't get a price quote from SaucerSwap");
  const hex = ((await r.json()).result as string).replace(/^0x/, "");
  const words = (hex.match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
  // uint256[] abi encoding: offset, length, values… — the last value is the output amount.
  const out = words[Number(words[1]) + 1];
  if (out === undefined) throw new Error("SaucerSwap returned an empty quote");
  return out;
}

/** Parses a decimal input like "12.5" into token units; throws on bad or non-positive input. */
export function toTokenUnits(amount: string, decimals: number): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) throw new Error("Enter a valid amount");
  const frac = (m[2] ?? "").padEnd(decimals, "0").slice(0, decimals);
  const units = BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt(frac || 0);
  if (units <= 0n) throw new Error("Enter an amount above zero");
  return units;
}

/** A quote reduced by the slippage tolerance — the minimum the contract must deliver. */
export function minAfterSlippage(quoted: bigint, bps = MARKET_SLIPPAGE_BPS): bigint {
  return (quoted * (10_000n - bps)) / 10_000n;
}

/** Trade deadline timestamp for a transaction signed now. */
export const marketDeadline = (nowSecs = Math.floor(Date.now() / 1000)) => BigInt(nowSecs + MARKET_DEADLINE_SECS);

export function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v === 0) return "$0";
  return `$${v.toPrecision(3)}`;
}
