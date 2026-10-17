import { describe, expect, it } from "vitest";
import { tradeStatistics, type StatisticsTrade } from "../lib/trade-statistics";
const now = Date.parse("2026-10-17T10:00:00Z");
const trade = (minutes: number, is_buy = true, trader = "0xAbC", hbar_amount = 10): StatisticsTrade => ({
  created_at: new Date(now - minutes * 60_000).toISOString(), is_buy, trader, hbar_amount,
});
describe("trade statistics", () => {
  it("uses a 5 minute window and excludes future trades", () => {
    expect(tradeStatistics([trade(5), trade(5.01), trade(-1)], "5m", now).buys.count).toBe(1);
  });
  it("uses a 1 hour window", () => {
    expect(tradeStatistics([trade(60), trade(61)], "1h", now).buys.count).toBe(1);
  });
  it("uses a 24 hour window", () => {
    expect(tradeStatistics([trade(1440), trade(1441)], "1d", now).buys.count).toBe(1);
  });
  it("separates buy/sell counts and HBAR volumes", () => {
    const result = tradeStatistics([trade(1, true, "a", 10), trade(2, true, "b", 20), trade(3, false, "a", 7)], "1h", now);
    expect(result.buys).toEqual({ count: 2, volume: 30, wallets: 2 });
    expect(result.sells).toEqual({ count: 1, volume: 7, wallets: 1 });
  });
  it("deduplicates wallets per side case-insensitively", () => {
    const result = tradeStatistics([trade(1), trade(2, true, "0xaBc"), trade(3, false)], "1h", now);
    expect(result.buys.wallets).toBe(1);
    expect(result.sells.wallets).toBe(1);
  });
  it("returns zeros for an empty window", () => {
    expect(tradeStatistics([], "1h", now)).toEqual({ buys: { count: 0, volume: 0, wallets: 0 }, sells: { count: 0, volume: 0, wallets: 0 } });
  });
});