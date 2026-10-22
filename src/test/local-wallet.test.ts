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
  it("reveals a stored key only for its own wallet and PIN", async () => {
    const stored = await encryptKey("0.0.321", "302e-mine", "123456");
    writeAccountWallets("0.0.1", [stored]);
    expect(await revealStoredWallet("0.0.1", "0.0.321", "123456")).toBe("302e-mine");
    await expect(revealStoredWallet("0.0.1", "0.0.321", "654321")).rejects.toThrow("Wrong PIN.");
    await expect(revealStoredWallet("0.0.1", "0.0.999", "123456")).rejects.toThrow("isn't in your account");
  });
});
