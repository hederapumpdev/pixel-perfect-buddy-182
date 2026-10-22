import type { RawPool } from "./markets";

export type TokenControl = { name: string; present: boolean | null };
export type TokenDetails = {
  supply: string; maxSupply: string | null; decimals: number; supplyType: string;
  treasury: string | null; created: string | null; deleted: boolean; paused: boolean;
  controls: TokenControl[];
};
export type HolderInfo = {
  count: number | null; complete: boolean; timestamp: string | null;
  top: { account: string; balance: string }[];
};
export type PoolInfo = { id: string; pair: string; reserveA: string; reserveB: string; liquidityUsd: number | null };
export type MarketTokenInfo = {
  token: TokenDetails | null; holders: HolderInfo; pools: PoolInfo[] | null; fetchedAt: string;
  lpBurned: "unknown"; lpLocked: "unknown"; sodaxSupported: boolean | null;
};

/** Preserve raw integer precision when formatting HTS token quantities. */
export function formatTokenQuantity(raw: string, decimals: number): string {
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return "Unknown";
  const padded = raw["pad"]Start(decimals + 1, "0");
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, "") : "";
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
}

export function tokenDetails(raw: Record<string, unknown>): TokenDetails {
  const decimals = Number(raw["decimals"]);
  return {
    supply: String(raw["total_supply"] ?? ""), maxSupply: raw["supply_type"] === "FINITE" ? String(raw["max_supply"] ?? "") : null,
    decimals, supplyType: String(raw["supply_type"] ?? "Unknown"), treasury: typeof raw["treasury_account_id"] === "string" ? raw["treasury_account_id"] : null,
    created: typeof raw["created_timestamp"] === "string" ? raw["created_timestamp"] : null,
    deleted: raw["deleted"] === true, paused: raw["pause_status"] === "PAUSED",
    controls: [["Admin", "admin_key"], ["Supply / mint & burn", "supply_key"], ["Freeze", "freeze_key"], ["Wipe", "wipe_key"], ["Pause", "pause_key"], ["KYC", "kyc_key"], ["Fee schedule", "fee_schedule_key"], ["Metadata", "metadata_key"]].map(([name, field]) => ({ name: name ?? "", present: raw[field ?? ""] === undefined ? null : raw[field ?? ""] !== null })),
  };
}

/** All known SaucerSwap V1 pools, not only the selected HBAR trading pool. */
export function tokenPools(id: string, pools: RawPool[]): PoolInfo[] {
  return pools.filter((p) => p.tokenA.id === id || p.tokenB.id === id).map((p) => {
    const a = Number(p.tokenReserveA) / 10 ** p.tokenA.decimals;
    const b = Number(p.tokenReserveB) / 10 ** p.tokenB.decimals;
    const priced = p.tokenA.priceUsd > 0 && p.tokenB.priceUsd > 0;
    const liquidity = a * p.tokenA.priceUsd + b * p.tokenB.priceUsd;
    return { id: p.contractId, pair: `${p.tokenA.symbol} / ${p.tokenB.symbol}`, reserveA: `${formatTokenQuantity(p.tokenReserveA, p.tokenA.decimals)} ${p.tokenA.symbol}`, reserveB: `${formatTokenQuantity(p.tokenReserveB, p.tokenB.decimals)} ${p.tokenB.symbol}`, liquidityUsd: priced && Number.isFinite(liquidity) ? liquidity : null };
  });
}
export function sodaxSupports(id: string, tokens: { address: string }[]): boolean {
  const address = `0x${BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0")}`;
  return tokens.some((t) => t.address.toLowerCase() === address);
}
