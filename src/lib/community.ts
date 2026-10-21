export const CHAT_MAX_LENGTH = 1000;
export const CHAT_SESSION_MS = 12 * 60 * 60_000;
export function chatBody(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > CHAT_MAX_LENGTH) throw new Error("Message must be 1–1000 characters.");
  return value.trim();
}
export function chatLoginMessage(author: string, time: string, nonce: string) {
  return `HederaPump community login\nWallet: ${author}\nTime: ${time}\nNonce: ${nonce}`;
}
export function chatAuthor(value: unknown) {
  if (typeof value !== "string" || !/^(0\.0\.\d{1,20}|0x[0-9a-fA-F]{40})$/.test(value)) throw new Error("Invalid wallet.");
  return value.toLowerCase();
}