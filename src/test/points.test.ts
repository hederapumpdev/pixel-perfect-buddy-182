import { describe, expect, it } from "vitest";
import { pointsLeaderboard } from "@/lib/points";

describe("points", () => {
  it("1 point per HBAR traded", () => {
    expect(pointsLeaderboard([{ trader: "0xa", hbar_amount: 12.7 }], [])[0]!.points).toBe(12);
  });
  it("100 per coin created, +500 if it graduated", () => {
    const r = pointsLeaderboard([], [{ creator: "0xb", graduated: true }, { creator: "0xb", graduated: false }]);
    expect(r[0]!.points).toBe(700);
  });
  it("ranks highest first and merges address case", () => {
    const r = pointsLeaderboard(
      [{ trader: "0xA", hbar_amount: 5 }, { trader: "0xa", hbar_amount: 5 }, { trader: "0xc", hbar_amount: 50 }],
      [],
    );
    expect(r.map((x) => x.points)).toEqual([50, 10]);
  });
});
