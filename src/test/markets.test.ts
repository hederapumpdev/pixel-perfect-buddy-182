import { describe, expect, it } from "vitest";
import { buildMarkets, marketFee } from "../lib/markets";

const hbar = { id: "0.0.1456986", name: "WHBAR", symbol: "HBAR", decimals: 8, priceUsd: 0.08 };
const cat = { id: "0.0.5", name: "Cat", symbol: "CAT", decimals: 6, priceUsd: 0 };

describe("markets", () => {
  it("charges exactly 1% on Markets trades", () => {
    expect(marketFee(100_000_000n)).toBe(1_000_000n);
    expect(marketFee(99n)).toBe(0n);
  });

  it("only lists tokens paired with HBAR and keeps the deepest pool", () => {
    const rows = buildMarkets([
      { contractId: "p1", tokenA: hbar, tokenB: cat, tokenReserveA: String(1000e8), tokenReserveB: String(2000e6) },
      { contractId: "p2", tokenA: cat, tokenB: hbar, tokenReserveA: String(10e6), tokenReserveB: String(5e8) },
      { contractId: "p3", tokenA: cat, tokenB: { ...cat, id: "0.0.9" }, tokenReserveA: "1", tokenReserveB: "1" },
    ], [{ id: "0.0.5", priceChangeDay: 4 }], 0.08);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pool).toBe("p1");
    expect(rows[0]?.priceHbar).toBe(0.5);
    expect(rows[0]?.liquidityUsd).toBeCloseTo(160);
    expect(rows[0]?.change24h).toBe(4);
  });
});
