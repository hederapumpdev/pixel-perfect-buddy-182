import { describe, expect, it } from "vitest";
import { botHoldingViews, type BotHoldingRow } from "@/lib/bot-holdings-view";

const row = (over: Partial<BotHoldingRow>): BotHoldingRow => ({
  address: "0x0000000000000000000000000000000000a6bc02",
  name: "Coin",
  symbol: "COIN",
  graduated: false,
  tokens: 100,
  hbarOut: 0,
  spent: 20,
  received: 0,
  profit: 0,
  ...over,
});

describe("admin bot coin list", () => {
  it("drops sold-out coins from the list but keeps their result in the total", () => {
    const rows = [
      row({ symbol: "HELD", tokens: 100, hbarOut: 30, spent: 20, received: 5, profit: 15 }),
      row({ symbol: "GONE", tokens: 0, hbarOut: 0, spent: 20, received: 26, profit: 6 }),
    ];
    const v = botHoldingViews(rows);
    expect(v.held.map((c) => c.symbol)).toEqual(["HELD"]);
    expect(v.soldOut).toBe(1);
    expect(v.total).toBe(21);
  });

  it("shows a graduated coin the bot still holds and leaves its result out of the total", () => {
    const rows = [row({ symbol: "GRAD", graduated: true, tokens: 500, spent: 24, received: 0, profit: -24 })];
    const v = botHoldingViews(rows);
    expect(v.held.map((c) => c.symbol)).toEqual(["GRAD"]);
    expect(v.soldOut).toBe(0);
    expect(v.total).toBe(0);
  });
});
