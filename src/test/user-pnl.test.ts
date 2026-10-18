import { describe, expect, it } from "vitest";
import { walletPnl, type PnlTrade } from "@/lib/user-stats";
const trade = (is_buy: boolean, hbar_amount: number, token_amount: number, fee: number): PnlTrade => ({ trader: "wallet", token: "coin", is_buy, hbar_amount, token_amount, fee });
const coin = { address: "coin", virtual_hbar: 2, virtual_tokens: 1, graduated: false };
describe("admin estimated trading PnL", () => {
  it("includes buy fees and remaining coin value", () => {
    expect(walletPnl(["wallet"], [trade(true, 99, 60, 1)], [coin]).get("wallet")).toBe(20);
  });
  it("includes sell fees in realized loss", () => {
    expect(walletPnl(["wallet"], [trade(true, 99, 60, 1), trade(false, 80, 60, 0.8)], [coin]).get("wallet")).toBeCloseTo(-20.8);
  });
  it("combines sale receipts and remaining value", () => {
    expect(walletPnl(["wallet"], [trade(true, 99, 60, 1), trade(false, 70, 30, 0.7)], [coin]).get("wallet")).toBeCloseTo(29.3);
  });
  it("does not invent prices for open graduated positions", () => {
    expect(walletPnl(["wallet"], [trade(true, 99, 60, 1)], [{ ...coin, graduated: true }]).get("wallet")).toBeNull();
  });
  it("does not invent balances for unmatched sales", () => {
    expect(walletPnl(["wallet"], [trade(false, 80, 60, 0.8)], [coin]).get("wallet")).toBeNull();
  });
  it("keeps wallets separate", () => {
    expect(walletPnl(["wallet", "other"], [trade(true, 99, 60, 1)], [coin]).get("other")).toBe(0);
  });
});