import { beforeEach, describe, expect, it } from "vitest";
import { NOTIF_SESSION_KEY, readNotifSession } from "@/lib/notifications";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

function store(s: unknown) {
  localStorage.setItem(NOTIF_SESSION_KEY, JSON.stringify(s));
}

describe("readNotifSession", () => {
  beforeEach(() => localStorage.clear());

  it("returns the session when it belongs to the wallet and has not expired", () => {
    store({ token: "a".repeat(64), account: "0.0.1234", expiresAt: future });
    expect(readNotifSession("0.0.1234")?.token).toBe("a".repeat(64));
  });

  it("rejects an expired session, so a follow falls back to a fresh wallet signature", () => {
    store({ token: "a".repeat(64), account: "0.0.1234", expiresAt: past });
    expect(readNotifSession("0.0.1234")).toBeNull();
  });

  it("rejects a session saved by another wallet", () => {
    store({ token: "a".repeat(64), account: "0.0.1234", expiresAt: future });
    expect(readNotifSession("0.0.9999")).toBeNull();
  });

  it("rejects missing or broken stored data", () => {
    expect(readNotifSession("0.0.1234")).toBeNull();
    localStorage.setItem(NOTIF_SESSION_KEY, "not json");
    expect(readNotifSession("0.0.1234")).toBeNull();
    store({ token: "a".repeat(64), expiresAt: future });
    expect(readNotifSession("0.0.1234")).toBeNull();
  });
});
