import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_LABELS,
  buyDedupe,
  dayKey,
  followDedupe,
  graduationDedupe,
  isNotificationKind,
  notificationText,
  notificationsLoginMessage,
  prefEnabled,
  timeAgo,
  unreadCount,
} from "@/lib/notifications";

describe("notification types", () => {
  it("offers exactly the four notice types a trader can switch", () => {
    expect([...NOTIFICATION_KINDS].sort()).toEqual(["comment", "follower_buy", "graduation", "new_follower"]);
    for (const kind of NOTIFICATION_KINDS) expect(NOTIFICATION_LABELS[kind].length).toBeGreaterThan(0);
  });

  it("refuses an unknown type", () => {
    expect(isNotificationKind("new_follower")).toBe(true);
    expect(isNotificationKind("admin")).toBe(false);
    expect(isNotificationKind(undefined)).toBe(false);
  });
});

describe("per-type opt out", () => {
  it("sends a type the wallet never touched", () => {
    expect(prefEnabled([], "new_follower")).toBe(true);
  });

  it("stops a type the wallet switched off, and only that one", () => {
    const rows = [{ kind: "follower_buy", enabled: false }];
    expect(prefEnabled(rows, "follower_buy")).toBe(false);
    expect(prefEnabled(rows, "comment")).toBe(true);
  });

  it("sends again once the wallet switches the type back on", () => {
    expect(prefEnabled([{ kind: "comment", enabled: false }, { kind: "comment", enabled: true }], "comment")).toBe(true);
  });
});

describe("one notice, not ten", () => {
  it("keys a follow by the follower only", () => {
    expect(followDedupe("0.0.10927104")).toBe("follow:0.0.10927104");
  });

  it("keys a graduation by the coin, whatever spelling the chain used", () => {
    expect(graduationDedupe("0x0000000000000000000000000000000000A6ACE9")).toBe(graduationDedupe("0x0000000000000000000000000000000000a6ace9"));
  });

  it("keeps buy notices to one per coin per day", () => {
    const day = dayKey("2026-10-26T23:30:00.000Z");
    expect(day).toBe("2026-10-26");
    expect(buyDedupe("0xabc", day)).toBe(buyDedupe("0xABC", day));
    expect(buyDedupe("0xabc", day)).not.toBe(buyDedupe("0xabc", dayKey("2026-10-27T00:10:00.000Z")));
  });

  it("labels an unread feed with only the notices nobody has opened", () => {
    expect(unreadCount([{ read_at: null }, { read_at: "2026-10-26T10:00:00Z" }, { read_at: null }])).toBe(2);
  });
});

describe("bell wording", () => {
  it("names the wallet for a follow", () => {
    expect(notificationText({ kind: "new_follower", symbol: null })).toEqual({ showActor: true, text: "started following you" });
  });

  it("names the coin for a comment and a buy", () => {
    expect(notificationText({ kind: "comment", symbol: "HPUMP" }).text).toBe("commented on $HPUMP");
    expect(notificationText({ kind: "follower_buy", symbol: "HPUMP" }).text).toBe("bought $HPUMP");
  });

  it("does not print a wallet name in front of a graduation", () => {
    expect(notificationText({ kind: "graduation", symbol: "HPUMP" })).toEqual({ showActor: false, text: "HPUMP graduated to SaucerSwap" });
  });
});

describe("bell times", () => {
  const now = Date.parse("2026-10-26T12:00:00.000Z");
  it("reads like a chat stamp", () => {
    expect(timeAgo("2026-10-26T11:59:30.000Z", now)).toBe("just now");
    expect(timeAgo("2026-10-26T11:55:00.000Z", now)).toBe("5m ago");
    expect(timeAgo("2026-10-26T09:00:00.000Z", now)).toBe("3h ago");
    expect(timeAgo("2026-10-24T12:00:00.000Z", now)).toBe("2d ago");
    expect(timeAgo("2026-10-10T12:00:00.000Z", now)).toBe("2026-10-10");
  });
});

describe("notification login", () => {
  it("binds the signed text to one account and one moment", () => {
    const msg = notificationsLoginMessage("0.0.10927104", "2026-10-26T12:00:00.000Z", "abcd");
    expect(msg).toContain("Account: 0.0.10927104");
    expect(msg).toContain("Time: 2026-10-26T12:00:00.000Z");
    expect(msg).toContain("Nonce: abcd");
    expect(msg).not.toContain("0.0.1");
  });
});
