import { describe, expect, it } from "vitest";
import {
  POOL_FEE_BPS,
  POOL_LP_FEE_BPS,
  POOL_MAX_FEE_BPS,
  POOL_MIN_SHARES,
  isqrt,
  poolDeadline,
  poolHbarForTokens,
  poolMinOut,
  poolPriceHbar,
  poolRedeem,
  poolSharesFor,
  quotePoolBuy,
  quotePoolSell,
  splitPoolFee,
  type PoolState,
} from "@/lib/pool";

// Small round numbers keep every expected value hand-checkable. The math is unit-agnostic.
const EMPTY: PoolState = { reserveHbar: 0n, reserveToken: 0n, totalShares: 0n };
const POOL: PoolState = { reserveHbar: 100n, reserveToken: 200n, totalShares: 141n };

describe("pool fee split", () => {
  it("takes 1.00% of a gross amount and keeps 0.25 points for the providers", () => {
    expect(splitPoolFee(1_000_000n)).toEqual({ fee: 10_000n, lpFee: 2_500n, protocol: 7_500n });
  });

  it("never lets the providers' slice exceed the whole fee", () => {
    const { fee, lpFee, protocol } = splitPoolFee(1_000_000n, POOL_FEE_BPS, POOL_FEE_BPS);
    expect(lpFee).toBe(fee);
    expect(protocol).toBe(0n);
  });

  it("caps the fee at 3%", () => {
    expect(POOL_MAX_FEE_BPS).toBe(300n);
    expect(POOL_LP_FEE_BPS).toBeLessThanOrEqual(POOL_FEE_BPS);
    expect(POOL_FEE_BPS).toBeLessThanOrEqual(POOL_MAX_FEE_BPS);
  });
});

describe("pool swap quotes", () => {
  it("buys 1960397 coins for 1 HBAR against 100 HBAR / 200 coins", () => {
    // gross = 200 * 1 / (100 + 1) = 1.980198 -> 1 in whole units; the price impact is the point.
    const q = quotePoolBuy(POOL, 1n);
    expect(q.out).toBe(1n);
    expect(q.fee).toBe(0n);
    // With bigger reserves the same buy is exact: gross = 200e6 * 1 / (100e6 + 1)...
    const deep: PoolState = { reserveHbar: 10_000n, reserveToken: 20_000n, totalShares: 100n };
    const d = quotePoolBuy(deep, 2n);
    // gross = 20000 * 2 / (10000 + 2) = 3.9992 -> 3; fee = 3 * 100 / 10000 = 0
    expect(d).toEqual({ out: 3n, fee: 0n });
  });

  it("charges exactly 1% on a large buy", () => {
    const big: PoolState = { reserveHbar: 1_000_000n, reserveToken: 2_000_000n, totalShares: 1n };
    const q = quotePoolBuy(big, 10_000n);
    // gross = 2e6 * 1e4 / (1e6 + 1e4) = 19801.98 -> 19801; fee = 198; out = 19603
    expect(q).toEqual({ out: 19_603n, fee: 198n });
  });

  it("sells back for less than the same size buy cost", () => {
    const big: PoolState = { reserveHbar: 1_000_000n, reserveToken: 2_000_000n, totalShares: 1n };
    const buy = quotePoolBuy(big, 10_000n);
    const sell = quotePoolSell(big, buy.out);
    expect(sell.out).toBeLessThan(10_000n);
    expect(sell.out).toBeGreaterThan(9_000n);
  });

  it("quotes nothing for a pool that has no liquidity yet", () => {
    expect(quotePoolBuy(EMPTY, 5n)).toEqual({ out: 0n, fee: 0n });
    expect(quotePoolSell(EMPTY, 5n)).toEqual({ out: 0n, fee: 0n });
    expect(quotePoolBuy({ reserveHbar: 0n, reserveToken: 5n, totalShares: 9n }, 1n).out).toBe(0n);
  });
});

describe("pool shares", () => {
  it("mints sqrt(hbar * coins) minus the locked minimum on the first deposit", () => {
    const first = poolSharesFor(EMPTY, 10_000n, 40_000n);
    expect(isqrt(10_000n * 40_000n)).toBe(20_000n);
    expect(first).toBe(20_000n - POOL_MIN_SHARES);
  });

  it("refuses a first deposit too small to open a pool", () => {
    expect(() => poolSharesFor(EMPTY, 1n, 1n)).toThrow(/too small/);
  });

  it("mints the same share of both sides on a later deposit at the pool's ratio", () => {
    // POOL is 100 HBAR / 200 coins / 141 shares. Doubling both sides doubles the shares.
    expect(poolSharesFor(POOL, 100n, 200n)).toBe(141n);
  });

  it("is limited by the smaller side when a deposit ignores the pool's ratio", () => {
    // 100 HBAR alone would buy 141 shares, but 1 coin only buys 0 -> the trader gets 0.
    expect(poolSharesFor(POOL, 100n, 1n)).toBe(0n);
    // 1 coin plus the matching 0.5 HBAR (100*1/200 = 0.5 -> 0 in whole units) still mints nothing.
    expect(poolHbarForTokens(POOL, 1n)).toBe(0n);
    // 2 coins need exactly 1 HBAR: 1 * 141 / 100 = 1 and 2 * 141 / 200 = 1 -> 1 share.
    expect(poolHbarForTokens(POOL, 2n)).toBe(1n);
    expect(poolSharesFor(POOL, 1n, 2n)).toBe(1n);
  });

  it("redeems the exact slice of both sides a share balance is worth", () => {
    expect(poolRedeem(POOL, 141n)).toEqual({ hbar: 100n, tokens: 200n });
    expect(poolRedeem(POOL, 70n)).toEqual({ hbar: 49n, tokens: 99n });
    expect(poolRedeem(EMPTY, 5n)).toEqual({ hbar: 0n, tokens: 0n });
  });
});

describe("pool helpers", () => {
  it("rounds square roots down like the contract does", () => {
    expect(isqrt(0n)).toBe(0n);
    expect(isqrt(1n)).toBe(1n);
    expect(isqrt(4n)).toBe(2n);
    expect(isqrt(9n)).toBe(3n);
    expect(isqrt(15n)).toBe(3n);
    expect(isqrt(16n)).toBe(4n);
    expect(isqrt(10n ** 33n)).toBe(31_622_776_601_683_793n); // floor of 10^16.5
    expect(isqrt(10n ** 28n)).toBe(10n ** 14n);
  });

  it("rejects a negative square root instead of looping forever", () => {
    expect(() => isqrt(-1n)).toThrow(/negative/);
  });

  it("prices a whole coin from the reserves", () => {
    expect(poolPriceHbar(POOL, 1_000_000_000n)).toBe((100n * 1_000_000_000n) / 200n);
    expect(poolPriceHbar(EMPTY, 1_000_000_000n)).toBe(0n);
  });

  it("cuts a slippage limit off a quote", () => {
    expect(poolMinOut(1000n, 50n)).toBe(995n); // 0.5%
    expect(poolMinOut(1000n, 0n)).toBe(1000n);
  });

  it("sets a deadline in Unix seconds", () => {
    expect(poolDeadline(1_761_551_000_000)).toBe(1_761_551_000 + 600);
  });
});
