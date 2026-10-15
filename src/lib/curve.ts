import { CURVE_SUPPLY, FEE_BPS, TINYBARS, TOKEN_UNIT } from "./hedera-config";

// Mirrors the on-chain math in contracts/HederaPump.sol (bigint, tinybars / wei-style token units).
export type CurveState = { virtualHbar: bigint; virtualTokens: bigint; tokensSold: bigint };

export function quoteBuy(c: CurveState, tinybarsIn: bigint) {
  const fee = (tinybarsIn * FEE_BPS) / 10_000n;
  const inAmt = tinybarsIn - fee;
  let out = (c.virtualTokens * inAmt) / (c.virtualHbar + inAmt);
  const remaining = CURVE_SUPPLY - c.tokensSold;
  if (out > remaining) out = remaining;
  return { tokensOut: out, fee };
}

export function quoteSell(c: CurveState, tokensIn: bigint) {
  const gross = (c.virtualHbar * tokensIn) / (c.virtualTokens + tokensIn);
  const fee = (gross * FEE_BPS) / 10_000n;
  return { hbarOut: gross - fee, fee };
}

/** Price of one whole token in HBAR. */
export function priceHbar(virtualHbar: number, virtualTokens: number) {
  return virtualTokens > 0 ? virtualHbar / virtualTokens : 0;
}

export const toTinybars = (hbar: string) => {
  const [w = "0", f = ""] = hbar.trim().split(".");
  return BigInt(w || "0") * TINYBARS + BigInt((f + "00000000").slice(0, 8) || "0");
};
export const toUnits = (tokens: string) => {
  const [w = "0", f = ""] = tokens.trim().split(".");
  return BigInt(w || "0") * TOKEN_UNIT + BigInt((f + "0".repeat(18)).slice(0, 18) || "0");
};
export const fromTinybars = (v: bigint) => Number(v) / 1e8;
export const fromUnits = (v: bigint) => Number(v / 10n ** 10n) / 1e8;
