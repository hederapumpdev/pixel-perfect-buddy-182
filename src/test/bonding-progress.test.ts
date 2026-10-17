import { describe, expect, it } from "vitest";
import { bondingProgress } from "@/lib/bonding-progress";

const state = { tokens_sold: 392_000_000, virtual_tokens: 608_000_000, virtual_hbar: 20_000, graduated: false };

describe("bonding progress display", () => {
  it("shows 49 percent at 392M of the 800M graduation supply", () => {
    expect(bondingProgress(state).percent).toBe(49);
    expect(bondingProgress(state).remainingTokens).toBe(408_000_000);
  });
  it("estimates remaining curve purchase cost including the existing 1 percent fee", () => {
    expect(bondingProgress(state).remainingHbar).toBeCloseTo(41212.12121212, 6);
  });
  it("shows a completed curve with no remaining cost after graduation", () => {
    expect(bondingProgress({ ...state, graduated: true }).percent).toBe(100);
    expect(bondingProgress({ ...state, graduated: true }).remainingHbar).toBe(0);
  });
  it("does not invent an estimate when reserve data is unavailable", () => {
    expect(bondingProgress({ ...state, virtual_tokens: 0 }).remainingHbar).toBeNull();
  });
});