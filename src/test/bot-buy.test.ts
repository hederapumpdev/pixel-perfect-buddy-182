import { describe, expect, it } from "vitest";
import { encodeBotBuy, encodePump, encodePumpV2, encodePumpV4 } from "@/lib/curve";
import { V4_CONTRACTS, PUMP_CONTRACT_ID, PUMP_CONTRACT_V3_ID } from "@/lib/hedera-config";

const token = "0x0000000000000000000000000000000000a6bc02";
describe("bot purchase contract compatibility", () => {
  for (const contract of V4_CONTRACTS) {
    it(`uses the three-argument buy for ${contract}`, () => {
      expect(encodeBotBuy(contract, token)).toBe(encodePumpV4("buy", [token, 0n, "0x0000000000000000000000000000000000000000"]));
      expect(encodeBotBuy(contract, token)).not.toBe(encodePumpV2("buy", [token, 0n]));
    });
  }
  it("preserves the legacy HTS purchase", () => {
    if (!PUMP_CONTRACT_V3_ID) throw new Error("Missing v3 contract");
    expect(encodeBotBuy(PUMP_CONTRACT_V3_ID, token)).toBe(encodePumpV2("buy", [token, 0n]));
  });
  it("preserves the v1 purchase", () => {
    if (!PUMP_CONTRACT_ID) throw new Error("Missing v1 contract");
    expect(encodeBotBuy(PUMP_CONTRACT_ID, token)).toBe(encodePump("buy", [token, 0n]));
  });
});