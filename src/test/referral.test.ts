import { describe, expect, it } from "vitest";
import { isValidRef, refToEvm, referralLink } from "@/lib/referral";

describe("referral links", () => {
  it("accepts Hedera account ids and EVM addresses", () => {
    expect(isValidRef("0.0.12345")).toBe(true);
    expect(isValidRef("0x0000000000000000000000000000000000003039")).toBe(true);
    expect(isValidRef("hello")).toBe(false);
    expect(isValidRef("0x123")).toBe(false);
  });

  it("converts a Hedera id to its long-zero EVM address", () => {
    expect(refToEvm("0.0.12345")).toBe("0x0000000000000000000000000000000000003039");
    expect(refToEvm("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD")).toBe(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    );
  });

  it("builds the personal link, preferring the account id", () => {
    expect(referralLink("0.0.12345", "0xabc")).toBe("https://hederapump.dev/?ref=0.0.12345");
    expect(referralLink(null, "0xabc")).toBe("https://hederapump.dev/?ref=0xabc");
    expect(referralLink(null, null)).toBeNull();
  });
});
