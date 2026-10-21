import { describe, expect, it } from "vitest";
import { logoSubmission } from "../lib/token-logo-submission";
import { PUMP_CONTRACT_V2_ID } from "../lib/hedera-config";

const token = {
  address: `0x${BigInt(10924337).toString(16).padStart(40, "0")}`,
  contract: PUMP_CONTRACT_V2_ID, name: "HEDERAPUMP", symbol: "HPUMP",
  creator: "0.0.10923241", image_url: "logo-hash", description: null,
  website: null, twitter: null, telegram: null,
};

describe("token logo submission data", () => {
  it("exports the real HTS native ID and coin-specific logo", () => {
    const info = logoSubmission(token, "https://hederapump.dev");
    expect(info.tokenId).toBe("0.0.10924337");
    expect(info.logo).toBe("https://hederapump.dev/api/public/img/logo-hash");
    expect(info.coinPage).toBe(`https://hederapump.dev/token/${token.address}`);
  });
  it("does not invent a logo for coins without one", () => {
    expect(logoSubmission({ ...token, image_url: null }, "https://hederapump.dev").logo).toBeNull();
  });
});