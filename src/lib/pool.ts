// Mirrors the on-chain math in contracts/HederaPumpPool.sol so the UI can show what a trade or
// a liquidity deposit will do before asking the wallet to sign anything. The math is
// unit-agnostic: HBAR in tinybars, coins in their own smallest unit.
//
// If the contract's math changes, this file must change with it and src/test/pool.test.ts must
// keep both honest.

export type PoolState = { reserveHbar: bigint; reserveToken: bigint; totalShares: bigint };

/** 1.00% of what a trader receives. */
export const POOL_FEE_BPS = 100n;
/** 0.25% of what a trader receives stays inside the pool for the liquidity providers. */
export const POOL_LP_FEE_BPS = 25n;
/** Locked in the contract forever on the first deposit of a pool. */
export const POOL_MIN_SHARES = 1000n;
/** Hard ceiling on the swap fee, so a later fee change can never exceed this. */
export const POOL_MAX_FEE_BPS = 300n;
/** How far ahead a signed trade or deposit stays valid, in seconds. */
export const POOL_DEADLINE_SEC = 600;

export const poolExists = (p: PoolState) => p.totalShares > 0n;

/**
 * Splits a gross amount into the whole fee, the slice that stays with the liquidity providers
 * and the slice that goes to the platform. Mirrors `splitFee` in the contract.
 */
export function splitPoolFee(gross: bigint, feeBps: bigint = POOL_FEE_BPS, lpFeeBps: bigint = POOL_LP_FEE_BPS) {
  const fee = (gross * feeBps) / 10_000n;
  const lpFee = (gross * lpFeeBps) / 10_000n;
  return { fee, lpFee, protocol: fee - lpFee };
}

/** What a trader receives for `hbarIn`, and the fee inside it. Zero for an empty pool. */
export function quotePoolBuy(p: PoolState, hbarIn: bigint) {
  if (!poolExists(p) || p.reserveHbar === 0n || p.reserveToken === 0n || hbarIn <= 0n) return { out: 0n, fee: 0n };
  const gross = (p.reserveToken * hbarIn) / (p.reserveHbar + hbarIn);
  const { fee } = splitPoolFee(gross);
  return { out: gross - fee, fee };
}

/** What a trader receives for selling `tokenIn`, and the fee inside it. */
export function quotePoolSell(p: PoolState, tokenIn: bigint) {
  if (!poolExists(p) || p.reserveHbar === 0n || p.reserveToken === 0n || tokenIn <= 0n) return { out: 0n, fee: 0n };
  const gross = (p.reserveHbar * tokenIn) / (p.reserveToken + tokenIn);
  const { fee } = splitPoolFee(gross);
  return { out: gross - fee, fee };
}

/** Price of one whole coin in HBAR, from the pool's own reserves. */
export function poolPriceHbar(p: PoolState, unit: bigint) {
  return p.reserveToken > 0n ? (p.reserveHbar * unit) / p.reserveToken : 0n;
}

/**
 * HBAR that belongs with `tokenIn` at the pool's current ratio. A deposit that ignores this
 * only gets the smaller of the two sides, so the UI should quote it first.
 */
export function poolHbarForTokens(p: PoolState, tokenIn: bigint) {
  if (p.reserveToken === 0n) return 0n;
  return (tokenIn * p.reserveHbar) / p.reserveToken;
}

/** Integer square root, the same Babylonian loop the contract runs. */
export function isqrt(x: bigint): bigint {
  if (x < 0n) throw new Error("square root of a negative number");
  if (x === 0n) return 0n;
  let r = x;
  let b = (x + 1n) / 2n;
  while (b < r) {
    r = b;
    b = (r + x / r) / 2n;
  }
  return r;
}

/**
 * Shares a deposit mints. A pool's first deposit sets the starting price; later deposits must
 * match the existing ratio and are limited by whichever side is relatively smaller. Throws when
 * a first deposit is too small to open a pool, mirroring the contract's "too small" revert.
 */
export function poolSharesFor(p: PoolState, hbarIn: bigint, tokenIn: bigint): bigint {
  if (hbarIn <= 0n || tokenIn <= 0n) throw new Error("amount must be positive");
  if (p.totalShares === 0n) {
    const raw = isqrt(hbarIn * tokenIn);
    if (raw <= POOL_MIN_SHARES) throw new Error("deposit too small to open a pool");
    return raw - POOL_MIN_SHARES;
  }
  if (p.reserveHbar === 0n || p.reserveToken === 0n) throw new Error("pool has no reserves");
  const byHbar = (hbarIn * p.totalShares) / p.reserveHbar;
  const byToken = (tokenIn * p.totalShares) / p.reserveToken;
  return byHbar < byToken ? byHbar : byToken;
}

/** What burning `shareAmount` is worth on both sides right now. */
export function poolRedeem(p: PoolState, shareAmount: bigint) {
  if (p.totalShares === 0n) return { hbar: 0n, tokens: 0n };
  return {
    hbar: (shareAmount * p.reserveHbar) / p.totalShares,
    tokens: (shareAmount * p.reserveToken) / p.totalShares,
  };
}

/** A trader's slippage limit: receive at least this much, or the trade should not be sent. */
export function poolMinOut(quoteOut: bigint, slippageBps: bigint) {
  return quoteOut - (quoteOut * slippageBps) / 10_000n;
}

/** Unix seconds, the unit the contract compares deadlines against. */
export function poolDeadline(nowMs: number, seconds: number = POOL_DEADLINE_SEC) {
  return Math.floor(nowMs / 1000) + seconds;
}
