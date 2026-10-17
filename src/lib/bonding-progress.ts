import { FEE_BPS } from "./hedera-config";

type BondingToken = { tokens_sold: number; virtual_hbar: number; virtual_tokens: number; graduated: boolean };

/** Display-only curve estimate; never used to construct or execute a trade. */
export function bondingProgress(t: BondingToken) {
  const sold = Number(t.tokens_sold);
  const remainingTokens = Math.max(0, 800_000_000 - sold);
  const percent = t.graduated ? 100 : Math.max(0, Math.min(100, sold / 800_000_000 * 100));
  const hbar = Number(t.virtual_hbar);
  const reserves = Number(t.virtual_tokens);
  const remainingHbar = t.graduated || remainingTokens === 0 ? 0 :
    Number.isFinite(hbar) && Number.isFinite(reserves) && hbar > 0 && reserves > remainingTokens
      ? hbar * remainingTokens / (reserves - remainingTokens) / (1 - Number(FEE_BPS) / 10_000)
      : null;
  return { percent, remainingTokens, remainingHbar };
}