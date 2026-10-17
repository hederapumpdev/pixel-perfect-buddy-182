// Network + deployed contract settings. Browser-safe (no secrets).
export const NETWORK: "mainnet" | "testnet" = "mainnet";

// Filled in after the launchpad contract is deployed from /admin.
export const PUMP_CONTRACT_ID: string | null = "0.0.10923845";

// Next-gen contract (native HTS tokens, 8 decimals, auto SaucerSwap listing).
// Null until deployed on mainnet; coins stay on the contract that made them.
export const PUMP_CONTRACT_V2_ID: string | null = "0.0.10924256";

// v3: same coin type as v2, but the platform fee goes straight to FEE_WALLET and
// creators claim their share. Null until deployed from /admin.
export const PUMP_CONTRACT_V3_ID: string | null = "0.0.10924285";

// v4: adds on-chain HIP-405 token metadata (SaucerSwap picks up logo/info automatically)
// and a shared referral pool (10% of the platform fee, split pro-rata by attributed
// trading volume, self-serve claims). Null until deployed from /admin.
export const PUMP_CONTRACT_V4_ID: string | null = "0.0.10924813";

/** Contracts whose coins are native HTS tokens (v2 + v3 share the same ABI). */
export const HTS_CONTRACTS: string[] = [PUMP_CONTRACT_V2_ID, PUMP_CONTRACT_V3_ID, PUMP_CONTRACT_V4_ID].filter(
  (c): c is string => !!c,
);

/** Contracts with the v4 ABI (referral args on buy/sell, metadataUrl on createToken). */
export const V4_CONTRACTS: string[] = ([PUMP_CONTRACT_V4_ID] as (string | null)[]).filter(
  (c): c is string => typeof c === "string",
);

/** Contract new coins are created on. */
export const LATEST_CONTRACT_ID: string | null =
  PUMP_CONTRACT_V4_ID ?? PUMP_CONTRACT_V3_ID ?? PUMP_CONTRACT_V2_ID ?? PUMP_CONTRACT_ID;

/** Every launchpad contract the app reads and trades on, oldest first. */
export const PUMP_CONTRACTS: string[] = [PUMP_CONTRACT_ID, PUMP_CONTRACT_V2_ID, PUMP_CONTRACT_V3_ID, PUMP_CONTRACT_V4_ID].filter(
  (c): c is string => !!c,
);

// WalletConnect project ID (public value from cloud.reown.com).
export const WALLETCONNECT_PROJECT_ID: string = "897d91d359830625cc68ba73089b2cce";

// Web3Auth client ID (public) — powers "sign in with email/Google" wallets.
export const WEB3AUTH_CLIENT_ID: string =
  "BMko14SpFQVLoBQZTOwmOuoO5q9xR7X9hq1H5SiU07I7_IeB7BCP-nJAJHiWxfMnVuDOMtncJKyojHxJvK6zcKA";
export const EVM_CHAIN_ID = NETWORK === "mainnet" ? 295 : 296;
export const EVM_RPC_URL =
  NETWORK === "mainnet" ? "https://mainnet.hashio.io/api" : "https://testnet.hashio.io/api";

export const MIRROR_URL =
  NETWORK === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
export const HASHSCAN_URL = `https://hashscan.io/${NETWORK}`;

/**
 * Nodes a wallet transaction is frozen for. Several long-standing mainnet
 * nodes: the wallet skips any it doesn't know or finds busy, while a single
 * node fails outright ("All nodes are unhealthy") the moment it's busy.
 */
export const WALLET_NODE_IDS = [
  "0.0.3", "0.0.4", "0.0.5", "0.0.6", "0.0.7", "0.0.8", "0.0.9",
  "0.0.10", "0.0.11", "0.0.12", "0.0.13", "0.0.14", "0.0.15", "0.0.16",
];

export const TINYBARS = 100_000_000n;
export const TOKEN_UNIT = 10n ** 18n;
export const CURVE_SUPPLY = 800_000_000n * TOKEN_UNIT;
export const FEE_BPS = 100n;

// V2 coins are native HTS tokens with 8 decimals.
export const TOKEN_UNIT_V2 = 10n ** 8n;
export const CURVE_SUPPLY_V2 = 800_000_000n * TOKEN_UNIT_V2;

export const GAS = { create: 1_500_000, buy: 300_000, sell: 300_000, claim: 100_000 };
// V2: creating a coin also creates the HTS token; the buy that reaches 800M
// sold also lists on SaucerSwap (~7.6M gas measured on testnet).
export const GAS_V2 = {
  create: 2_500_000,
  buy: 1_500_000,
  sell: 1_500_000,
  buyFinal: 9_000_000,
  claim: 200_000,
};

// Wallet that receives platform fees (set as fee recipient at deploy).
export const FEE_WALLET_ID = "0.0.10923241";
export const FEE_WALLET_EVM = "0x" + (10923241).toString(16).padStart(40, "0");

// Platform bot: buys this many US dollars of every coin created after BOT_START.
export const BOT_BUY_USD = 2;
export const BOT_START = "2026-10-16T19:00:00Z";
