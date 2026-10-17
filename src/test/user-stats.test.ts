import { describe, expect, it } from "vitest";
import { userRows, type UserStats } from "@/lib/user-stats";

const stats = (recent: UserStats["recent"]): UserStats => ({
  wallets: recent.length,
  wallets_1d: 0,
  wallets_7d: 0,
  creators: 0,
  profiles: 0,
  comment_authors: 0,
  trades: 0,
  coins: 0,
  recent,
});

describe("admin user list", () => {
  it("shows the profile name when the wallet has one", () => {
    const rows = userRows(
      stats([{ wallet: "0xd14adf40256c7fdab669ec2a5eee25afaa755392", trades: 7, last_at: "2026-10-17T00:00:00Z", name: "Cookdevil", avatar: "abc" }]),
    );
    expect(rows[0].label).toBe("Cookdevil");
    expect(rows[0].trades).toBe(7);
  });

  it("falls back to a short wallet address without a profile", () => {
    const rows = userRows(
      stats([{ wallet: "0xd14adf40256c7fdab669ec2a5eee25afaa755392", trades: 2, last_at: "2026-10-17T00:00:00Z", name: null, avatar: null }]),
    );
    expect(rows[0].label).toBe("0xd14a…5392");
  });

  it("lists at most 12 wallets, newest first", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      wallet: `0x${String(i).padStart(40, "0")}`,
      trades: i,
      last_at: "2026-10-17T00:00:00Z",
      name: null,
      avatar: null,
    }));
    const rows = userRows(stats(many));
    expect(rows.length).toBe(12);
    expect(rows[0].trades).toBe(0);
  });
});
