import { describe, expect, it } from "vitest";
import { allSitemapTokens } from "@/lib/sitemap-tokens";
import { sitemapXML } from "@/lib/sitemap";

describe("public token sitemap", () => {
  it("includes tokens from all batches in stable order", async () => {
    const offsets: number[] = [];
    const tokens = await allSitemapTokens(async (offset) => {
      offsets.push(offset);
      return { data: [{ address: "a" }, { address: "b" }, { address: "c" }].slice(offset, offset + 2), error: null };
    }, 2);
    expect(tokens.map((row) => row.address)).toEqual(["a", "b", "c"]);
    expect(offsets).toEqual([0, 2, 3]);
  });
  it("rejects later-batch failures instead of returning partial tokens", async () => {
    await expect(allSitemapTokens(async (offset) => offset === 0
      ? { data: [{ address: "a" }], error: null }
      : { data: null, error: new Error("source failed") }, 1)).rejects.toThrow("source failed");
  });
  it("uses the real domain without invented modification dates", () => {
    const xml = sitemapXML("https://hederapump.dev", [{ path: "/explore" }]);
    expect(xml).toContain("<loc>https://hederapump.dev/explore</loc>");
    expect(xml).not.toContain("lastmod");
  });
});