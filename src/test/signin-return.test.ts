import { afterEach, describe, expect, it } from "vitest";
import { clearSigninReturn, readSigninReturn, saveSigninReturn, takeSigninReturn } from "../lib/signin-return";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

afterEach(() => clearSigninReturn());

describe("return from Google/e-mail sign-in", () => {
  it("sees a login result in the address bar", () => {
    const r = readSigninReturn(`#b64Params=${b64({ sessionId: "abc" })}&sessionNamespace=x`);
    expect(r).toEqual({ present: true, error: null, hasSession: true, hasNonce: false });
  });

  it("reports the error the sign-in service sent back", () => {
    expect(readSigninReturn(`#b64Params=${b64({ error: "user closed" })}`).error).toBe("user closed");
  });

  it("ignores ordinary page addresses", () => {
    expect(readSigninReturn("#top", "?ref=0.0.1").present).toBe(false);
  });

  it("remembers the page to return to for 15 minutes only", () => {
    saveSigninReturn("/admin", 1_000);
    expect(takeSigninReturn(1_000 + 14 * 60_000)).toBe("/admin");
    expect(takeSigninReturn(1_000 + 16 * 60_000)).toBeNull();
  });
});
