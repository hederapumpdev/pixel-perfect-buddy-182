import { describe, expect, it } from "vitest";
import { nativeHederaId, fallbackAddress } from "@/lib/hedera-address";

describe("native Hedera display IDs", () => {
  it("shows a native account ID unchanged", () => {
    expect(fallbackAddress("0.0.10923241")).toBe("0.0.10923241");
  });
  it("converts a long-zero address to its actual Hedera ID", () => {
    expect(nativeHederaId("0x0000000000000000000000000000000000a6b131")).toBe("0.0.10924337");
  });
  it("never invents an ID for an EVM alias", () => {
    expect(nativeHederaId("0xe577194bed9934b72ac15950d7eccee1c85377e4")).toBeNull();
    expect(fallbackAddress("0xe577194bed9934b72ac15950d7eccee1c85377e4")).toBe("0xe577…77e4");
  });
});