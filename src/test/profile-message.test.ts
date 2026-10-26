import { describe, it, expect } from "vitest";
import { xHandle, profileEditMessage } from "../lib/profile-message";
describe("profile", () => {
  it("normalizes X handles", () => {
    expect(xHandle("@hederapumpdev")).toBe("hederapumpdev");
    expect(xHandle("https://x.com/1hedex?s=11")).toBe("1hedex");
    expect(xHandle("")).toBeNull();
    expect(() => xHandle("way_too_long_handle_name")).toThrow();
  });
  it("signed message covers the profile content", () => {
    const base = { accountId: "0.0.1", wallet: "0xabc", time: "t", nonce: "n", name: "a", bio: "", avatar: null, x: null };
    expect(profileEditMessage(base)).not.toBe(profileEditMessage({ ...base, name: "b" }));
  });
});
