import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey, revealStoredWallet, writeAccountWallets } from "@/lib/local-wallet";

describe("imported wallet encryption", () => {
  it("only the right PIN unlocks the key", async () => {
    const s = await encryptKey("0.0.123", "302e-secret", "123456");
    expect(s.data).not.toContain("302e-secret");
    expect(await decryptKey(s, "123456")).toBe("302e-secret");
    await expect(decryptKey(s, "654321")).rejects.toThrow("Wrong PIN.");
  });
  it("refuses a PIN shorter than 6", async () => {
    await expect(encryptKey("0.0.1", "k", "12345")).rejects.toThrow();
  });
});
