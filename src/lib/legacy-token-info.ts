import { isV2, isV4 } from "./curve";
import { HASHSCAN_URL, NETWORK } from "./hedera-config";
import { socialUrl } from "./social-links";

export type LegacyTokenInfo = {
  address: string;
  contract: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  graduated: boolean;
};

export function isLegacyHtsToken(token: Pick<LegacyTokenInfo, "contract">) {
  return isV2(token.contract) && !isV4(token.contract);
}

export function legacyTokenId(address: string): string | null {
  if (!/^0x0{24}[a-f0-9]{16}$/i.test(address)) return null;
  return `0.0.${BigInt(address).toString()}`;
}

export function legacyMetadata(token: LegacyTokenInfo) {
  return {
    name: token.name,
    symbol: token.symbol,
    description: token.description ?? "",
    ...(token.image_url ? { lightLogo: `https://hederapump.dev/api/public/img/${token.image_url}` } : {}),
    website: socialUrl("website", token.website) ?? `https://hederapump.dev/token/${token.address}`,
    properties: {
      ...(token.twitter ? { twitter: socialUrl("twitter", token.twitter) } : {}),
      ...(token.telegram ? { telegram: socialUrl("telegram", token.telegram) } : {}),
      category: "meme",
    },
  };
}

export function legacyInfoRequest(token: LegacyTokenInfo) {
  const id = legacyTokenId(token.address);
  const metadata = legacyMetadata(token);
  return [
    "Hello SaucerSwap team,",
    "",
    `Could you advise on displaying token information for ${token.name} (${token.symbol})?`,
    "This native HTS token was launched on HederaPump before HIP-405 metadata was added to our launchpad. Its existing contract cannot attach metadata retroactively.",
    "",
    `Network: Hedera ${NETWORK}`,
    `Token ID: ${id ?? "Please resolve the EVM address below"}`,
    `EVM address: ${token.address}`,
    `Launchpad contract: ${token.contract}`,
    `Token page: https://hederapump.dev/token/${token.address}`,
    `HashScan: ${HASHSCAN_URL}/token/${id ?? token.address}`,
    `Graduated: ${token.graduated ? "Yes" : "No — no SaucerSwap pool yet"}`,
    "",
    "Proposed token information:",
    JSON.stringify(metadata, null, 2),
    "",
    "Your project guide recommends Davinci Pics for tokens without admin or metadata keys. Our token has a contract treasury. Which connected account can submit its information through Davinci Pics, or is another manual route available? We understand this is not a listing or verification approval.",
    "Thank you!",
  ].join("\n");
}