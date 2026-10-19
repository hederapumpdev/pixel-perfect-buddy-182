import { describe, expect, it } from "vitest";
import { pickTrending, sanitizeTrending } from "@/lib/trending";

describe("trending coin themes", () => {
  it("keeps names and tickers that fit the launchpad rules", () => {
    expect(sanitizeTrending({ name: "  Wif   Hat ", symbol: "wif", chain: "solana" })).toEqual({
      name: "Wif Hat",
      symbol: "WIF",
      chain: "solana",
    });
  });
  it("rejects tickers that are not 2-10 letters or digits", () => {
    expect(sanitizeTrending({ name: "Okay", symbol: "X" })).toBeNull();
    expect(sanitizeTrending({ name: "Okay", symbol: "!!!" })).toBeNull();
  });
  it("rejects names shorter than 2 characters", () => {
    expect(sanitizeTrending({ name: "A", symbol: "ABC" })).toBeNull();
  });
  it("picks the first candidate whose name and ticker are still free", () => {
    const candidates = [
      { name: "Taken", symbol: "TKN", chain: "solana" },
      { name: "Fresh", symbol: "FRSH", chain: "base" },
    ];
    expect(pickTrending(candidates, new Set(["taken", "tkn"]))).toEqual(candidates[1]);
  });
  it("returns null when every candidate is already used", () => {
    const candidates = [{ name: "Taken", symbol: "TKN", chain: "solana" }];
    expect(pickTrending(candidates, new Set(["tkn"]))).toBeNull();
  });
});
