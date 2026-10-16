import {
  CURVE_SUPPLY,
  CURVE_SUPPLY_V2,
  FEE_BPS,
  PUMP_CONTRACT_V2_ID,
  TINYBARS,
  TOKEN_UNIT,
  TOKEN_UNIT_V2,
} from "./hedera-config";

// Mirrors the on-chain math in contracts/HederaPump.sol (v1, 18 decimals) and
// contracts/HederaPumpHTS.sol (v2, 8 decimals). The math is unit-agnostic;
// only the curve supply and token unit differ.
export type CurveState = { virtualHbar: bigint; virtualTokens: bigint; tokensSold: bigint };

/** True for coins created by the v2 (HTS) contract. */
export const isV2 = (contract: string | null | undefined) =>
  !!PUMP_CONTRACT_V2_ID && contract === PUMP_CONTRACT_V2_ID;

export const tokenUnit = (contract: string | null | undefined) =>
  isV2(contract) ? TOKEN_UNIT_V2 : TOKEN_UNIT;

function quoteBuyWith(curveSupply: bigint, c: CurveState, tinybarsIn: bigint) {
  const fee = (tinybarsIn * FEE_BPS) / 10_000n;
  const inAmt = tinybarsIn - fee;
  let out = (c.virtualTokens * inAmt) / (c.virtualHbar + inAmt);
  const remaining = curveSupply - c.tokensSold;
  if (out > remaining) out = remaining;
  return { tokensOut: out, fee };
}

export function quoteBuy(c: CurveState, tinybarsIn: bigint, contract?: string | null) {
  return quoteBuyWith(isV2(contract) ? CURVE_SUPPLY_V2 : CURVE_SUPPLY, c, tinybarsIn);
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
export const toUnits = (tokens: string, contract?: string | null) => {
  const unit = tokenUnit(contract);
  const dec = unit === TOKEN_UNIT_V2 ? 8 : 18;
  const [w = "0", f = ""] = tokens.trim().split(".");
  return BigInt(w || "0") * unit + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
};
export const fromTinybars = (v: bigint) => Number(v) / 1e8;
export const fromUnits = (v: bigint, contract?: string | null) =>
  tokenUnit(contract) === TOKEN_UNIT_V2 ? Number(v) / 1e8 : Number(v / 10n ** 10n) / 1e8;

import { encodeFunctionData, type Abi } from "viem";
import artifact from "./contract-artifact.json";
import artifactV2 from "./contract-artifact-hts.json";
export const encodePump = (functionName: string, args: unknown[] = []) =>
  encodeFunctionData({ abi: artifact.pumpAbi as Abi, functionName, args } as never);
export const encodePumpV2 = (functionName: string, args: unknown[] = []) =>
  encodeFunctionData({ abi: artifactV2.pumpAbi as Abi, functionName, args } as never);
export const encodeToken = (functionName: string, args: unknown[] = []) =>
  encodeFunctionData({ abi: artifact.tokenAbi as Abi, functionName, args } as never);
