import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { FUND_WALLETS, feeSourceContracts, fundWallet, fundWalletPublicKey, idToEvm, isSplitRecipient, needsStartDeposit } from "@/lib/fund-wallets.server";
import { MARKET_ROUTER_ID, PUMP_CONTRACTS } from "@/lib/hedera-config";

// The keys are derived from a secret at runtime; a fixed seed keeps this test offline.
process.env["BOT_SEED"] = "unit-test-seed";

describe("fee wallet keys", () => {
  for (const name of FUND_WALLETS) {
    it(`${name}: the public key handed to the wallet opens exactly the address the split pays`, () => {
      const w = fundWallet(name);
      const key = fundWalletPublicKey(name);
      // Compressed SEC1 (02/03 + 32 bytes): the shape HashPack's SDK expects for an account key.
      expect(key).toMatch(/^0x0[23][0-9a-f]{64}$/);
      // If these ever differ, the opened wallet would not be the one the hourly job pays.
      expect(ethers.computeAddress(key)).toBe(w.address);
    });
  }

  it("the three fee wallets are separate accounts", () => {
    const addrs = FUND_WALLETS.map((n) => fundWallet(n).address.toLowerCase());
    expect(new Set(addrs).size).toBe(3);
  });
});

describe("recognized fee sources", () => {
  it("the Markets router's 1% fee counts as fee money after graduation", () => {
    const sources = feeSourceContracts();
    expect(PUMP_CONTRACTS.every((c) => sources.has(c))).toBe(true);
    // Without the router, post-graduation trades through our site would never reach the split.
    expect(MARKET_ROUTER_ID && sources.has(MARKET_ROUTER_ID)).toBe(true);
  });
});

describe("split wallet recognition on contracts", () => {
  const split = () => fundWallet("split").address;
  it("accepts the EVM alias form", () => {
    expect(isSplitRecipient(split(), split(), "0.0.10927104")).toBe(true);
  });
  it("accepts the long-zero account id form (SDK-created contracts store this)", () => {
    expect(isSplitRecipient(idToEvm("0.0.10927104"), split(), "0.0.10927104")).toBe(true);
  });
  it("rejects any other address or a missing recipient", () => {
    expect(isSplitRecipient(idToEvm("0.0.999"), split(), "0.0.10927104")).toBe(false);
    expect(isSplitRecipient(null, split(), "0.0.10927104")).toBe(false);
    expect(isSplitRecipient(idToEvm("0.0.10927104"), split(), null)).toBe(false);
  });
});

describe("starting deposit for opened fee wallets", () => {
  it("an opened wallet with 0 HBAR gets the deposit", () => {
    expect(needsStartDeposit(0n, false)).toBe(true);
  });
  it("a wallet that already received its deposit never gets a second one", () => {
    expect(needsStartDeposit(0n, true)).toBe(false);
  });
  it("a wallet already holding 5 HBAR or more needs no deposit", () => {
    expect(needsStartDeposit(5n * 100_000_000n, false)).toBe(false);
  });
});
