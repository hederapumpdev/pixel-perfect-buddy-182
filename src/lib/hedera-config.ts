// Network + deployed contract settings. Browser-safe (no secrets).
export const NETWORK: "mainnet" | "testnet" = "mainnet";

// Filled in after the launchpad contract is deployed from /admin.
export const PUMP_CONTRACT_ID: string | null = "0.0.10923845";

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

export const TINYBARS = 100_000_000n;
export const TOKEN_UNIT = 10n ** 18n;
export const CURVE_SUPPLY = 800_000_000n * TOKEN_UNIT;
export const FEE_BPS = 100n;

export const GAS = { create: 1_500_000, buy: 300_000, sell: 300_000, claim: 100_000 };

// Wallet that receives platform fees (set as fee recipient at deploy).
export const FEE_WALLET_ID = "0.0.10923241";
export const FEE_WALLET_EVM = "0x" + (10923241).toString(16).padStart(40, "0");
