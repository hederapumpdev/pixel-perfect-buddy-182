import { describe, expect, it } from "vitest";
import { DISCORD_ANNOUNCEMENTS_CHANNEL, DISCORD_NEW_COINS_CHANNEL } from "@/lib/promo.server";

describe("Discord routing", () => {
  it("uses #new-coins for coin posts and #announcements for platform news", () => {
    expect(DISCORD_NEW_COINS_CHANNEL).toBe("1561344278591045693");
    expect(DISCORD_ANNOUNCEMENTS_CHANNEL).toBe("1561015919428378665");
  });
});
