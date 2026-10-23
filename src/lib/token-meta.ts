import { MIRROR_URL } from "./hedera-config";

// Resolves the "creator" segment of a token metadata URL to the creator address stored in
// the tokens table. Callers sometimes pass an account's long-zero EVM address (0x0000…<entity>)
// while chain sync stores the account's alias EVM address — both identify the same account.
// For long-zero addresses we ask the mirror node for the account's real EVM address.

export const isLongZero = (addr: string) => /^0x0{24}[0-9a-f]{16}$/.test(addr);

/** True when an on-chain token memo points at exactly this metadata URL (creator + index). */
export const memoMatches = (memo: string, creator: string, index: number) =>
  memo.toLowerCase().endsWith(`/token-meta/${creator}/${index}`);

/** Reads a token's memo from the mirror node; null when unavailable. */
export async function readTokenMemo(
  tokenAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const r = await fetcher(`${MIRROR_URL}/api/v1/tokens/${tokenAddress}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const t = (await r.json()) as { memo?: string | null };
    return typeof t.memo === "string" ? t.memo : null;
  } catch {
    return null;
  }
}

export async function resolveCreatorAlias(
  creator: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!isLongZero(creator)) return null;
  const entity = Number(BigInt(creator) & 0xffffffffn);
  if (!Number.isSafeInteger(entity) || entity <= 0) return null;
  try {
    const r = await fetcher(`${MIRROR_URL}/api/v1/accounts/0.0.${entity}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const account = (await r.json()) as { evm_address?: string | null };
    const evm = account.evm_address?.toLowerCase();
    return evm && /^0x[0-9a-f]{40}$/.test(evm) && evm !== creator ? evm : null;
  } catch {
    return null;
  }
}
