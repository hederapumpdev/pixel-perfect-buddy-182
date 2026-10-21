import { describe, expect, it, vi } from "vitest";
import { sendOnce } from "@/lib/fund-wallets.server";

/** Minimal in-memory table: inserting an existing id fails like a primary key. */
function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    from: () => ({
      insert: async (r: { id: string }) => (rows.has(r.id) ? { error: { code: "23505" } } : (rows.set(r.id, { ...r }), { error: null })),
      update: (patch: Record<string, unknown>) => ({ eq: async (_c: string, id: string) => { rows.set(id, { ...rows.get(id), ...patch }); return {}; } }),
    }),
  };
}

describe("transfers are sent at most once", () => {
  const wallet = () => ({
    sendTransaction: vi.fn(async () => ({ hash: "0xabc" })),
    provider: { send: async () => "0x1" },
  });
  it("a second claim of the same id sends nothing", async () => {
    const db = fakeDb();
    const w = wallet();
    const row = { id: "split:2026-10-21T10:team", kind: "split", from_wallet: "x", recipient: "0x1", tinybars: 5n };
    expect((await sendOnce(db, w as never, row)).step).toBe("sent");
    expect((await sendOnce(db, w as never, row)).step).toBe("claimed elsewhere");
    expect(w.sendTransaction).toHaveBeenCalledTimes(1);
  });
  it("an unclear send is marked unknown and not retried", async () => {
    const db = fakeDb();
    const w = { ...wallet(), sendTransaction: vi.fn(async () => { throw new Error("timeout"); }) };
    const row = { id: "split:h:holdout", kind: "split", from_wallet: "x", recipient: "0x1", tinybars: 5n };
    expect((await sendOnce(db, w as never, row)).step).toBe("send error");
    expect(db.rows.get(row.id)?.status).toBe("unknown");
    expect((await sendOnce(db, w as never, row)).step).toBe("claimed elsewhere");
    expect(w.sendTransaction).toHaveBeenCalledTimes(1);
  });
});
