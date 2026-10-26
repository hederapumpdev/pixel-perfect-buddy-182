import { describe, expect, it } from "vitest";
import { assetMeta } from "@/lib/dexscreener";

const HASH = "a".repeat(64);

describe("assetMeta", () => {
  it("maps a stored image hash to the public icon URL", () => {
    const meta = assetMeta({ image_url: HASH, website: null, twitter: null, telegram: null });
    expect(meta.icon).toBe(`https://hederapump.dev/api/public/img/${HASH}`);
  });

  it("includes website and socials when present", () => {
    const meta = assetMeta({
      image_url: null,
      website: "https://hederapump.dev",
      twitter: "https://x.com/hederapumpdev",
      telegram: "https://t.me/hederapump",
    });
    expect(meta.websites).toEqual([{ label: "Website", url: "https://hederapump.dev" }]);
    expect(meta.socials).toEqual([
      { type: "twitter", url: "https://x.com/hederapumpdev" },
      { type: "telegram", url: "https://t.me/hederapump" },
    ]);
  });

  it("omits icon, websites and socials when nothing is set", () => {
    const meta = assetMeta({ image_url: null, website: null, twitter: null, telegram: null });
    expect(meta).toEqual({});
  });

  it("rejects non-http values instead of passing them through", () => {
    const meta = assetMeta({
      image_url: "not-a-hash",
      website: "javascript:alert(1)",
      twitter: "ftp://x",
      telegram: "",
    });
    expect(meta).toEqual({});
  });
});
