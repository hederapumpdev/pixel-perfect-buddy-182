import { describe, expect, it } from "vitest";

import { socialUrl } from "../lib/social-links";

describe("socialUrl", () => {
  it("keeps a full URL as it is", () => {
    expect(socialUrl("website", "https://hederapump.dev")).toBe("https://hederapump.dev");
    expect(socialUrl("twitter", "https://x.com/hederapumpdev")).toBe("https://x.com/hederapumpdev");
  });

  it("turns the @handle the launch form asks for into an x.com link", () => {
    expect(socialUrl("twitter", "@hederapumpdev")).toBe("https://x.com/hederapumpdev");
    expect(socialUrl("twitter", "hederapumpdev")).toBe("https://x.com/hederapumpdev");
    expect(socialUrl("twitter", "twitter.com/hederapumpdev")).toBe("https://x.com/hederapumpdev");
  });

  it("turns the t.me/… the launch form asks for into a Telegram link", () => {
    expect(socialUrl("telegram", "t.me/hederapump")).toBe("https://t.me/hederapump");
    expect(socialUrl("telegram", "https://t.me/hederapump")).toBe("https://t.me/hederapump");
    expect(socialUrl("telegram", "@hederapump")).toBe("https://t.me/hederapump");
  });

  it("adds a scheme to a bare domain and refuses junk", () => {
    expect(socialUrl("website", "hederapump.dev")).toBe("https://hederapump.dev");
    expect(socialUrl("website", "www.hederapump.dev")).toBe("https://www.hederapump.dev");
    expect(socialUrl("website", "not a link")).toBeNull();
    expect(socialUrl("twitter", "   ")).toBeNull();
    expect(socialUrl("telegram", null)).toBeNull();
  });

  it("turns a Discord invite code into an invite link", () => {
    expect(socialUrl("discord", "bYPD27QtZ")).toBe("https://discord.gg/bYPD27QtZ");
    expect(socialUrl("discord", "discord.gg/bYPD27QtZ")).toBe("https://discord.gg/bYPD27QtZ");
    expect(socialUrl("discord", "https://discord.gg/bYPD27QtZ")).toBe("https://discord.gg/bYPD27QtZ");
    expect(socialUrl("discord", "discord.com/invite/bYPD27QtZ")).toBe("https://discord.gg/bYPD27QtZ");
    expect(socialUrl("discord", "")).toBeNull();
  });
});
