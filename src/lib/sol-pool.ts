// Building a SaucerSwap HBAR/SOL pool: exact costs, live status and the one call that creates it.
// Pure + browser-safe so every number here can be tested before a single HBAR is spent.
import { encodeFunctionData, type Abi } from "viem";
import { MIRROR_URL, SAUCERSWAP_V1_FACTORY_ID, SAUCERSWAP_V1_ROUTER_ID, WHBAR_TOKEN_ID } from "./hedera-config";
import { idToEvm, marketDeadline, minAfterSlippage, toTokenUnits } from "./markets";

/** SOL as it exists on Hedera mainnet: a token SODAX issued, 8 decimals, not real Solana SOL. */
export const SOL_TOKEN_ID = "0.0.10807298";
export const SOL_DECIMALS = 8;

const FACTORY_ABI = [
  { name: "getPair", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }],
    outputs: [{ name: "pair", type: "address" }] },
  { name: "pairCreateFee", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

/** SaucerSwap's own router call for opening a brand-new HBAR/token pool. */
const NEW_POOL_ABI = [
  { name: "addLiquidityETHNewPool", type: "function", stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [] },
] as const;

/** Gas SaucerSwap recommends for opening a pool (their docs say 3,200,000). */
export const POOL_GAS = 3_200_000;

/** Reads a view function from Hedera's mirror node (no wallet, no cost). */
async function callView(contractId: string, functionName: string, args: unknown[] = []): Promise<bigint | string> {
  const abi = contractId === SAUCERSWAP_V1_FACTORY_ID ? (FACTORY_ABI as unknown as Abi) : (NEW_POOL_ABI as unknown as Abi);
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to: idToEvm(contractId),
      data: encodeFunctionData({ abi, functionName, args } as never),
      estimate: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error("SaucerSwap didn't answer");
  const hex = ((await r.json()).result as string).replace(/^0x/, "");
  if (!hex) return "0x";
  return hex.length === 64 ? BigInt(`0x${hex}`) : `0x${hex}`;
}

/** Does an HBAR/SOL pool already exist? A zero address means it does not. */
export async function solPoolExists(tokenId = SOL_TOKEN_ID): Promise<boolean> {
  const pair = await callView(SAUCERSWAP_V1_FACTORY_ID, "getPair", [idToEvm(WHBAR_TOKEN_ID), idToEvm(tokenId)]);
  return typeof pair === "string" && pair.replace(/^0x/, "").replace(/0+$/, "").length > 0;
}

/**
 * SaucerSwap charges a one-off pool creation fee, quoted in tinycent.
 * Hedera's own conversion is tinycents * hbar_equivalent / cent_equivalent — the same
 * maths the router uses on-chain, so the number shown is the number charged.
 */
export function tinycentToTinybars(tinycents: bigint, centEquivalent: number, hbarEquivalent: number): bigint {
  if (centEquivalent <= 0 || hbarEquivalent <= 0) throw new Error("No Hedera exchange rate");
  return (tinycents * BigInt(hbarEquivalent)) / BigInt(centEquivalent);
}

/** Live creation fee, in tinybars, from the factory and Hedera's exchange rate. */
export async function poolCreateFeeTinybars(): Promise<bigint> {
  const fee = await callView(SAUCERSWAP_V1_FACTORY_ID, "pairCreateFee");
  const rate = await fetch(`${MIRROR_URL}/api/v1/network/exchangerate`, { signal: AbortSignal.timeout(10_000) });
  if (!rate.ok) throw new Error("No Hedera exchange rate");
  const c = (await rate.json()).current_rate as { cent_equivalent: number; hbar_equivalent: number };
  const tinycents = typeof fee === "bigint" ? fee : BigInt(fee);
  if (tinycents <= 0n) throw new Error("SaucerSwap reported no creation fee");
  return tinycentToTinybars(tinycents, c.cent_equivalent, c.hbar_equivalent);
}

/** What opening a pool costs: the SOL to deposit, the HBAR to match it, and the one-off fee. */
export type PoolPlan = {
  solUnits: bigint;
  sol: string;
  hbarSideTinybars: bigint;
  feeTinybars: bigint;
  /** HBAR that must leave the wallet: liquidity + creation fee. */
  totalTinybars: bigint;
  amountTokenMin: bigint;
  amountETHMin: bigint;
  hbarTotal: number;
  usd: number;
};

export function poolPlan(opts: {
  sol: string;
  hbarPerSol: number;
  feeTinybars: bigint;
  hbarUsd: number;
  slippageBps?: bigint;
}): PoolPlan {
  if (!(opts.hbarPerSol > 0)) throw new Error("No SOL price");
  const solUnits = toTokenUnits(opts.sol, SOL_DECIMALS);
  const hbarSideTinybars = BigInt(Math.round((Number(solUnits) / 10 ** SOL_DECIMALS) * opts.hbarPerSol * 1e8));
  const totalTinybars = hbarSideTinybars + opts.feeTinybars;
  return {
    solUnits,
    sol: opts.sol,
    hbarSideTinybars,
    feeTinybars: opts.feeTinybars,
    totalTinybars,
    amountTokenMin: minAfterSlippage(solUnits, opts.slippageBps ?? 300n),
    amountETHMin: minAfterSlippage(hbarSideTinybars, opts.slippageBps ?? 300n),
    hbarTotal: Number(totalTinybars) / 1e8,
    usd: (Number(totalTinybars) / 1e8) * opts.hbarUsd,
  };
}

/** The calldata that opens the pool; HBAR (liquidity + fee) rides along as the payable value. */
export const encodeAddLiquidityETHNewPool = (opts: {
  tokenId?: string;
  solUnits: bigint;
  amountTokenMin: bigint;
  amountETHMin: bigint;
  to: string;
}) =>
  encodeFunctionData({
    abi: NEW_POOL_ABI as unknown as Abi,
    functionName: "addLiquidityETHNewPool",
    args: [
      opts.tokenId ? idToEvm(opts.tokenId) : idToEvm(SOL_TOKEN_ID),
      opts.solUnits,
      opts.amountTokenMin,
      opts.amountETHMin,
      opts.to,
      marketDeadline(),
    ],
  } as never);

/**
 * Live SOL/HBAR price from public market data.
 * Returns null when either price can't be read — the panel then refuses to create anything.
 */
export async function solPriceHbar(): Promise<{ hbarPerSol: number; solUsd: number; hbarUsd: number } | null> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana,hedera-hashgraph&vs_currencies=usd",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { solana?: { usd: number }; "hedera-hashgraph"?: { usd: number } };
    const solUsd = Number(j.solana?.usd ?? 0);
    const hbarUsd = Number(j["hedera-hashgraph"]?.usd ?? 0);
    if (!(solUsd > 0) || !(hbarUsd > 0)) return null;
    return { hbarPerSol: solUsd / hbarUsd, solUsd, hbarUsd };
  } catch {
    return null;
  }
}
