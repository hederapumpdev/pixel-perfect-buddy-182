import { isV2 } from "./curve";

export const TOKEN_ICON_FORM = "https://forms.gle/iPxfF12sVG6iSM8N8";

export type LogoToken = {
  address: string; contract: string; name: string; symbol: string;
  creator: string; image_url: string | null; description: string | null;
  website: string | null; twitter: string | null; telegram: string | null;
};

export function logoSubmission(token: LogoToken, origin: string) {
  let tokenId: string | null = null;
  if (isV2(token.contract) && /^0x[0-9a-f]{40}$/i.test(token.address)) {
    tokenId = `0.0.${BigInt(token.address)}`;
  }
  const base = new URL(origin).origin;
  return {
    name: token.name,
    symbol: token.symbol,
    network: "Hedera mainnet",
    tokenId,
    address: token.address,
    creator: token.creator,
    logo: token.image_url ? `${base}/api/public/img/${token.image_url}` : null,
    coinPage: `${base}/token/${token.address}`,
    description: token.description,
    website: token.website,
    twitter: token.twitter,
    telegram: token.telegram,
  };
}

export function logoRequest(token: LogoToken, origin: string) {
  const info = logoSubmission(token, origin);
  return Object.entries(info).filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `${key}: ${value}`).join("\n");
}