import { describe, expect, it } from "vitest";
import { contestLeaderboard, contestWinner, isOfficial, weekStart, FREE_COIN_LIMIT, CONTEST_PRIZE_HBAR } from "@/lib/promotions";
import { FEE_WALLET_EVM } from "@/lib/hedera-config";

describe("promotions", () => {
  it("week starts Monday 00:00 UTC", () => {
    expect(weekStart(new Date("2026-10-17T17:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-12T00:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
  it("fee wallet coins are official and excluded from the contest", () => {
    expect(isOfficial(FEE_WALLET_EVM.toUpperCase().replace("0X", "0x"))).toBe(true);
    const creators: Record<string, string> = { a: FEE_WALLET_EVM, b: "0xabc" };
    const board = contestLeaderboard(
      [
        { token: "a", hbar_amount: 5000, created_at: "2026-10-13T00:00:00Z" },
        { token: "b", hbar_amount: 600, created_at: "2026-10-13T00:00:00Z" },
        { token: "b", hbar_amount: 600, created_at: "2026-10-14T00:00:00Z" },
        { token: "b", hbar_amount: 9999, created_at: "2026-10-19T00:00:00Z" },
      ],
      (t) => creators[t],
      new Date("2026-10-12T00:00:00Z"),
      new Date("2026-10-19T00:00:00Z"),
    );
    expect(board).toEqual([{ token: "b", volume: 1200 }]);
    expect(contestWinner(board)?.token).toBe("b");
  });
  it("no winner below 1000 HBAR volume", () => {
    expect(contestWinner([{ token: "b", volume: 999 }])).toBeNull();
  });
  it("prize 100 HBAR, 10 free coins", () => {
    expect(CONTEST_PRIZE_HBAR).toBe(100);
    expect(FREE_COIN_LIMIT).toBe(10);
  });
});
