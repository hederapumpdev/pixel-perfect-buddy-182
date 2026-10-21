import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { FUND_WALLETS, fundWallet, fundWalletPublicKey } from "@/lib/fund-wallets.server";

// The keys are derived from a secret at runtime; a fixed seed keeps this test offline.
process.env.BOT_SEED = "unit-test-seed";

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
