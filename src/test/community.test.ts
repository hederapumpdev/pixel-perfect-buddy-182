import { describe, expect, it } from "vitest";
import { chatBody, chatAuthor, chatLoginMessage, CHAT_SESSION_MS } from "../lib/community";
import { verifyChatLogin } from "../lib/community-auth.server";
import { privateKeyToAccount } from "viem/accounts";
describe("Community safeguards", () => {
  it("rejects empty messages", () => expect(() => chatBody("  ")).toThrow());
  it("limits messages to 1000 characters", () => { expect(chatBody("a".repeat(1000))).toHaveLength(1000); expect(() => chatBody("a".repeat(1001))).toThrow(); });
  it("rejects invalid wallet identities", () => { expect(chatAuthor("0.0.10924360")).toBe("0.0.10924360"); expect(() => chatAuthor("Noon")).toThrow(); });
  it("expires sessions after twelve hours", () => expect(CHAT_SESSION_MS).toBe(43_200_000));
  it("requires a real signature from the claimed wallet", async () => {
    const account = privateKeyToAccount(`0x${"12".repeat(32)}`);
    const d = { author: account.address.toLowerCase(), time: new Date().toISOString(), nonce: "ab".repeat(16) };
    const evmSignature = await account.signMessage({ message: chatLoginMessage(d.author, d.time, d.nonce) });
    await expect(verifyChatLogin({ ...d, evmSignature })).resolves.toBeUndefined();
    await expect(verifyChatLogin({ ...d, nonce: "cd".repeat(16), evmSignature })).rejects.toThrow();
  });
});