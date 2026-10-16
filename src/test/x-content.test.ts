import { describe, expect, it } from "vitest";
import { appTweet, dailyXSlot, DAILY_X_HOURS, localXTime, topics } from "@/lib/x-content";
import { topicImages } from "@/lib/x-images";

describe("daily app posting", () => {
  it("begins with an introduction outside normal posting hours", () => {
    expect(dailyXSlot(new Date("2026-10-16T21:53:00Z"), true)).toBe("introduction");
  });
  it("posts three times per Amsterdam day", () => {
    expect(DAILY_X_HOURS).toEqual([10, 15, 20]);
    expect(dailyXSlot(new Date("2026-10-17T08:00:00Z"), false)).toBe("2026-10-17-10");
    expect(dailyXSlot(new Date("2026-10-17T13:00:00Z"), false)).toBe("2026-10-17-15");
    expect(dailyXSlot(new Date("2026-10-17T18:00:00Z"), false)).toBe("2026-10-17-20");
    expect(dailyXSlot(new Date("2026-10-17T09:00:00Z"), false)).toBeNull();
  });
  it("keeps the same local hours after daylight saving ends", () => {
    expect(localXTime(new Date("2026-11-01T09:00:00Z"))).toEqual({ day: "2026-11-01", hour: 10 });
  });
  it("stays within X's 280 weighted-character limit", () => {
    for (let n = 0; n < 30; n++) {
      const weighted = appTweet(n, "2026-10-17").replace(/https:\/\/\S+/g, "x".repeat(23));
      expect([...weighted].length).toBeLessThanOrEqual(280);
    }
  });
});