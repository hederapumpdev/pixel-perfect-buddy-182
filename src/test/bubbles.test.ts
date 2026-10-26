import { describe, expect, it } from "vitest";
import { layoutBubbles, BUBBLE_VIEW } from "@/lib/bubbles";

const SUPPLY = 1_000_000_000;

describe("layoutBubbles", () => {
  it("returns nothing without holders or supply", () => {
    expect(layoutBubbles([], SUPPLY)).toEqual([]);
    expect(layoutBubbles([{ who: "0.0.1", amt: 5 }], 0)).toEqual([]);
    expect(layoutBubbles([{ who: "0.0.1", amt: 0 }], SUPPLY)).toEqual([]);
  });

  it("gives bigger balances bigger bubbles (area proportional)", () => {
    const bs = layoutBubbles(
      [
        { who: "0.0.1", amt: 100 },
        { who: "0.0.2", amt: 25 },
        { who: "0.0.3", amt: 1 },
      ],
      SUPPLY,
    );
    expect(bs).toHaveLength(3);
    expect(bs[0].who).toBe("0.0.1");
    expect(bs[0].r).toBeGreaterThan(bs[1].r);
    expect(bs[1].r).toBeGreaterThan(bs[2].r);
    // radius scales with sqrt: 100 vs 25 → factor 2
    expect(bs[0].r / bs[1].r).toBeCloseTo(2, 5);
  });

  it("keeps every bubble fully inside the view box", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      who: `0.0.${i + 1}`,
      amt: 1000 / (i + 1),
    }));
    for (const b of layoutBubbles(rows, SUPPLY)) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(0);
      expect(b.x + b.r).toBeLessThanOrEqual(BUBBLE_VIEW.w);
      expect(b.y - b.r).toBeGreaterThanOrEqual(0);
      expect(b.y + b.r).toBeLessThanOrEqual(BUBBLE_VIEW.h);
    }
  });

  it("reports each holder's share of the supply", () => {
    const [b] = layoutBubbles([{ who: "0.0.9", amt: 250_000_000 }], SUPPLY);
    expect(b.pct).toBeCloseTo(25, 5);
  });

  it("is deterministic and caps at 40 holders", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      who: `0.0.${i + 1}`,
      amt: 60 - i,
    }));
    const a = layoutBubbles(rows, SUPPLY);
    const b = layoutBubbles(rows, SUPPLY);
    expect(a).toEqual(b);
    expect(a).toHaveLength(40);
  });
});
