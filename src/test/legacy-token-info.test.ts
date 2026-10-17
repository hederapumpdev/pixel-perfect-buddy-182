import { describe, expect, it } from "vitest";
import { isLegacyHtsToken, legacyTokenId, legacyMetadata, legacyInfoRequest } from "@/lib/legacy-token-info";
import { PUMP_CONTRACT_ID, PUMP_CONTRACT_V2_ID, PUMP_CONTRACT_V3_ID, PUMP_CONTRACT_V4_ID } from "@/lib/hedera-config";

const token = {
  address: "0x0000000000000000000000000000000000a6b131",
  contract: PUMP_CONTRACT_V3_ID ?? "",
  name: "Legacy coin",
  symbol: "LEGACY",
  description: "Community token",
  image_url: "legacy.jpg",
  website: null,
  twitter: "@legacy",
  telegram: "t.me/legacy",
  graduated: false,
};

describe("pre-v4 SaucerSwap information", () => {
  it("only prepares older native HTS tokens, not v4 or ERC20 tokens", () => {
    expect(isLegacyHtsToken({ contract: PUMP_CONTRACT_V2_ID ?? "" })).toBe(true);
    expect(isLegacyHtsToken(token)).toBe(true);
    expect(isLegacyHtsToken({ contract: PUMP_CONTRACT_V4_ID ?? "" })).toBe(false);
    expect(isLegacyHtsToken({ contract: PUMP_CONTRACT_ID ?? "" })).toBe(false);
    expect(isLegacyHtsToken({ contract: "unknown" })).toBe(false);
  });

  it("resolves real long-zero HTS identifiers without converting EVM aliases", () => {
    expect(legacyTokenId(token.address)).toBe("0.0.10924337");
    expect(legacyTokenId("0xe577194bed9934b72ac15950d7eccee1c85377e4")).toBeNull();
    expect(legacyTokenId("invalid")).toBeNull();
  });

  it("exports actual token metadata with normalized links", () => {
    const metadata = legacyMetadata(token);
    expect(metadata.name).toBe("Legacy coin");
    expect(metadata.lightLogo).toBe("https://hederapump.dev/api/public/img/legacy.jpg");
    expect(metadata.properties.twitter).toBe("https://x.com/legacy");
    expect(metadata.properties.telegram).toBe("https://t.me/legacy");
    expect(legacyInfoRequest(token)).toContain("Token ID: 0.0.10924337");
  });
});