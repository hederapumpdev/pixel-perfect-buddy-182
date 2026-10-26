import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK } from "@/lib/hedera-config";
import { spotlightCoin } from "@/lib/promo.server";

type Row = Record<string, unknown>;
type Filter = { k: string; op: string; v: unknown };

/** Minimal stand-in for the two tables the spotlight job reads and claims. */
function fakeDb(promo: Row[], tokens: Row[]) {
  const inserts: Row[] = [];
  const from = (table: "promo_posts" | "tokens") => {
    const rows = table === "promo_posts" ? promo : tokens;
    const filters: Filter[] = [];
    let limited = Infinity;
    const selected = () =>
      rows.filter((row) =>
        filters.every(({ k, op, v }) =>
          op === "eq" ? row[k] === v : op === "not" ? row[k] != null : op === "gt" ? Number(row[k]) > Number(v) : true,
        ),
      );
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (k: string, v: unknown) => (filters.push({ k, op: "eq", v }), api),
      not: (k: string, op: string, v: unknown) => (filters.push({ k, op: "not", v }), api),
      gt: (k: string, v: unknown) => (filters.push({ k, op: "gt", v }), api),
      order: () => api,
      limit: (n: number) => ((limited = n), api),
      maybeSingle: async () => ({ data: selected()[0] ?? null, error: null }),
      insert: (row: Row) => (inserts.push({ ...row }), api),
      update: () => api,
      then: (resolve: (r: { data: Row[]; error: null }) => void) => resolve({ data: selected().slice(0, limited), error: null }),
    };
    return api;
  };
  return { from, inserts };
}

const chosen = { address: "0xccc", network: NETWORK, name: "Locked Cat", symbol: "LCAT", creator: "0xcreator", trade_count: 7, volume_hbar: 1234, graduated: true, hidden: false };

describe("coin spotlight channel coverage", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_API_KEY", "test");
    vi.stubEnv("DISCORD_API_KEY", "test");
    vi.stubEnv("LOVABLE_API_KEY", "test");
    vi.stubEnv("X_CONSUMER_KEY", "test");
    vi.stubEnv("X_CONSUMER_SECRET", "test");
    vi.stubEnv("X_ACCESS_TOKEN", "test");
    vi.stubEnv("X_ACCESS_TOKEN_SECRET", "test");
    vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/telegram/")) return Response.json({ ok: true, result: { message_id: 61 } });
      if (url.includes("/discord/")) return Response.json({ id: "discord-message" });
      return Response.json({ data: { id: "tweet" } });
    }));
  });

  it("announces the coin already chosen for the window on the next channel", async () => {
    // 0xccc graduated after the X post, so a fresh pick could never return it: only a stored claim can.
    const db = fakeDb([{ slot: "spotlight:2026-10-26-1", channel: "x", status: "sent", token: "0xccc", text: "x" }], [chosen]);
    expect(await spotlightCoin(new Date("2026-10-26T06:20:00Z"), db as never)).toEqual({ step: "telegram sent" });
    const claim = db.inserts.at(-1);
    expect(claim).toMatchObject({ channel: "telegram", status: "sending", token: "0xccc" });
    expect(String(claim?.["text"])).toContain("Locked Cat");
    expect(String(claim?.["text"])).toContain("https://hederapump.dev/token/0xccc");
  });

  it("stores the coin with the first claim so later channels reuse it", async () => {
    const db = fakeDb([], [{ ...chosen, address: "0xddd", name: "Fresh Cat", symbol: "FCH", graduated: false, trade_count: 3, volume_hbar: 50 }]);
    expect(await spotlightCoin(new Date("2026-10-26T06:05:00Z"), db as never)).toEqual({ step: "x sent" });
    expect(db.inserts.at(-1)).toMatchObject({ channel: "x", token: "0xddd" });
  });
});
