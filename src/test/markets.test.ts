import { describe, expect, it } from "vitest";
import { buildMarkets, hbarUsdFrom, marketFee, mergeOwnCoins } from "../lib/markets";

const hbar = { id: "0.0.1456986", name: "WHBAR", symbol: "HBAR", decimals: 8, priceUsd: 0.08 };
const cat = { id: "0.0.5", name: "Cat", symbol: "CAT", decimals: 6, priceUsd: 0 };
const pool = { contractId: "p1", tokenA: hbar, tokenB: cat, tokenReserveA: String(1000e8), tokenReserveB: String(2000e6) };

describe("markets", () => {
  it("charges exactly 1% on Markets trades", () => {
    expect(marketFee(100_000_000n)).toBe(1_000_000n);
    expect(marketFee(99n)).toBe(0n);
  });

  it("only lists tokens paired with HBAR and keeps the deepest pool", () => {
    const rows = buildMarkets([
      pool,
      { contractId: "p2", tokenA: cat, tokenB: hbar, tokenReserveA: String(10e6), tokenReserveB: String(5e8) },
      { contractId: "p3", tokenA: cat, tokenB: { ...cat, id: "0.0.9" }, tokenReserveA: "1", tokenReserveB: "1" },
    ], [{ id: "0.0.5", priceChangeDay: 4 }], 0.08);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pool).toBe("p1");
    expect(rows[0]?.priceHbar).toBe(0.5);
    expect(rows[0]?.liquidityUsd).toBeCloseTo(160);
    expect(rows[0]?.change24h).toBe(4);
    expect(rows[0]?.source).toBe("dex");
  });

  it("reads the HBAR/USD rate back out of a priced row", () => {
    const rows = buildMarkets([pool], [], 0.08);
    expect(hbarUsdFrom(rows)).toBeCloseTo(0.08);
    expect(hbarUsdFrom([])).toBe(0);
  });

  it("adds HederaPump coins without a SaucerSwap pool, once, as curve rows", () => {
    const rows = buildMarkets([pool], [], 0.08);
    const merged = mergeOwnCoins(rows, [
      { address: "0.0.5", name: "Cat", symbol: "CAT", icon: null, graduated: false, virtualHbar: 1, virtualTokens: 1 },
      { address: "0.0.77", name: "Pump", symbol: "PUMP", icon: "/api/public/img/ab", graduated: false, virtualHbar: 100, virtualTokens: 1000 },
      { address: "0.0.88", name: "Done", symbol: "DONE", icon: null, graduated: true, virtualHbar: 500, virtualTokens: 1000 },
      { address: "0.0.99", name: "Empty", symbol: "EML", icon: null, graduated: false, virtualHbar: 0, virtualTokens: 0 },
    ], 0.08);
    expect(merged.map((m) => m.id)).toEqual(["0.0.5", "0.0.77"]);
    const pump = merged.find((m) => m.id === "0.0.77");
    expect(pump?.source).toBe("curve");
    expect(pump?.priceHbar).toBe(0.1);
    expect(pump?.priceUsd).toBeCloseTo(0.008);
    expect(pump?.icon).toBe("/api/public/img/ab");
    // No SaucerSwap pool exists, so no liquidity figure is claimed.
    expect(pump?.liquidityUsd).toBe(0);
    expect(pump?.change24h).toBeNull();
  });

  it("adds nothing when no HBAR/USD rate is known", () => {
    const rows = buildMarkets([pool], [], 0);
    const merged = mergeOwnCoins(rows, [
      { address: "0.0.77", name: "Pump", symbol: "PUMP", icon: null, graduated: false, virtualHbar: 100, virtualTokens: 1000 },
    ], hbarUsdFrom(rows));
    expect(merged.map((m) => m.id)).toEqual(["0.0.5"]);
  });
});
