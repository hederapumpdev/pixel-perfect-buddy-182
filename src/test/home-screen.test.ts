import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"));

describe("phone home-screen support", () => {
  it("opens HederaPump as a standalone app at the site's root", () => {
    expect(manifest.name).toBe("HederaPump");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.id).toBe("/");
  });
});