import { describe, expect, it } from "vitest";
import { allocate, applyMinimum, isQualified, lotWeight, loyaltyPpm, rewardWeights, splitAmounts, updateLots } from "@/lib/holdout";

const DAY = 86_400_000;

describe("fee split", () => {
  it("forwards 2/7 team, 1/7 Hold Out, 4/7 platform", () => {
    expect(splitAmounts(700n)).toEqual({ team: 200n, holdout: 100n, platform: 400n });
  });
  it("never forwards more than it holds", () => {
    const a = splitAmounts(1_000_000_001n);
    expect(a.team + a.holdout + a.platform).toBe(1_000_000_001n);
  });
});

describe("Hold Out rules", () => {
  it("requires 7 days of holding", () => {
    expect(isQualified(7 * DAY - 1)).toBe(false);
    expect(isQualified(7 * DAY)).toBe(true);
    expect(lotWeight([["100", 0]], 6 * DAY)).toBe(0n);
  });
  it("caps the loyalty multiplier at 2.0x after 60 days", () => {
    expect(loyaltyPpm(0)).toBe(1_000_000n);
    expect(loyaltyPpm(30 * DAY)).toBe(1_500_000n);
    expect(loyaltyPpm(60 * DAY)).toBe(2_000_000n);
    expect(loyaltyPpm(400 * DAY)).toBe(2_000_000n);
  });
  it("gives newly bought tokens their own age", () => {
    const lots = updateLots(updateLots([], 10n, 0), 1000n, 50 * DAY);
    expect(lots).toEqual([["10", 0], ["990", 50 * DAY]]);
    // At day 55 only the old 10 tokens qualify.
    expect(lotWeight(lots, 55 * DAY)).toBe(10n * loyaltyPpm(55 * DAY));
  });
  it("rounds down and never pays more than the pot", () => {
    const { payouts, residual } = allocate(100n, new Map([["a", 1n], ["b", 1n], ["c", 1n]]));
    expect([...payouts.values()]).toEqual([33n, 33n, 33n]);
    expect(residual).toBe(1n);
  });
  it("rolls payouts below the minimum into next week", () => {
    const { kept, rolled } = applyMinimum(new Map([["a", 5n], ["b", 50n]]), 10n);
    expect([...kept.keys()]).toEqual(["b"]);
    expect(rolled).toBe(5n);
  });
  it("averages ownership over the week's snapshots", () => {
    const w = rewardWeights([
      { supply: "100", weights: { a: "100" } },
      { supply: "100", weights: {} },
    ]);
    expect(w.get("a")).toBe(10n ** 18n / 2n);
  });
});
