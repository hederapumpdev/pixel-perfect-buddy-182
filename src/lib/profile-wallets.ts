/** Account IDs and long-zero addresses identify the same Hedera account. */
export function profileWalletAddress(wallet: string): string {
  const normalized = wallet.trim().toLowerCase();
  const parts = normalized.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!parts) return normalized;
  const shard = BigInt(parts[1]);
  const realm = BigInt(parts[2]);
  const account = BigInt(parts[3]);
  if (shard >= 2n ** 32n || realm >= 2n ** 64n || account >= 2n ** 64n) return normalized;
  return `0x${shard.toString(16).padStart(8, "0")}${realm.toString(16).padStart(16, "0")}${account.toString(16).padStart(16, "0")}`;
}