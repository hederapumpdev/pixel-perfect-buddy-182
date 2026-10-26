import { describe, expect, it } from "vitest";
import { resultSeries } from "@/lib/result-series";

const now = Date.parse("2026-10-26T12:00:00Z");
const trades = [
  { is_buy: true, hbar_amount: 100, created_at: "2026-10-01T00:00:00Z" },
  { is_buy: false, hbar_amount: 150, created_at: "2026-10-26T06:00:00Z" },
];

describe("profile trading result", () => {
  it("all-time is sells minus buys", () => {
    expect(resultSeries(trades, "All", now).change).toBe(50);
  });
  it("1D only counts today's trades", () => {
    expect(resultSeries(trades, "1D", now).change).toBe(150);
  });
});
