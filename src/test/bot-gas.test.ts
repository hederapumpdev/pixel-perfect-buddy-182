import { describe, expect, it } from "vitest";
import { MIN_GAS_PRICE_WEI, safeGasPrice } from "@/lib/bot.server";

describe("bot gas price", () => {
  it("never sends below Hedera's minimum when the estimate is near zero", () => {
    expect(safeGasPrice(204n)).toBe(MIN_GAS_PRICE_WEI);
    expect(safeGasPrice(null)).toBe(MIN_GAS_PRICE_WEI);
  });
  it("adds a 20% margin above a normal reported price", () => {
    expect(safeGasPrice(1_030_000_000_000n * 2n)).toBe(2_472_000_000_000n);
  });
});
