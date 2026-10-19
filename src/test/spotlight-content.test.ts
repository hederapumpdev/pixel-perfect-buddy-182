import { describe, expect, it } from "vitest";
import { spotlightMessages, spotlightSlot } from "@/lib/promo-content";

const coin = { address: "0xabc", name: "Hash<Cat>", symbol: "HCAT" };

describe("coin spotlight posts", () => {
  it("uses one slot per six-hour window", () => {
    expect(spotlightSlot(new Date("2026-10-19T02:00:00Z"))).toBe("spotlight:2026-10-19-0");
    expect(spotlightSlot(new Date("2026-10-19T05:59:00Z"))).toBe("spotlight:2026-10-19-0");
    expect(spotlightSlot(new Date("2026-10-19T06:00:00Z"))).toBe("spotlight:2026-10-19-1");
    expect(spotlightSlot(new Date("2026-10-19T23:00:00Z"))).toBe("spotlight:2026-10-19-3");
  });
  it("links to the coin page and shows trades and volume", () => {
    const m = spotlightMessages(coin, 42, 1234);
    for (const text of [m.x, m.telegram, m.discord]) {
      expect(text).toContain("https://hederapump.dev/token/0xabc");
      expect(text).toContain("42");
      expect(text).toContain("1,234");
    }
  });
  it("escapes the coin name in the Telegram message", () => {
    const m = spotlightMessages(coin, 1, 1);
    expect(m.telegram).toContain("Hash&lt;Cat&gt;");
    expect(m.telegram).not.toContain("Hash<Cat>");
  });
});
