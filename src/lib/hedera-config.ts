// Network + deployed contract settings. Browser-safe (no secrets).
export const NETWORK: "mainnet" | "testnet" = "mainnet";

// Filled in after the launchpad contract is deployed from /admin.
export const PUMP_CONTRACT_ID: string | null = null;

// WalletConnect project ID (public value from cloud.reown.com).
export const WALLETCONNECT_PROJECT_ID: string = "";

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
