import { describe, expect, it, vi } from "vitest";
import { formatTokenQuantity, sodaxSupports, tokenDetails, tokenPools } from "../lib/market-token-info";
import { readTokenHolders } from "../lib/market-token-info.functions";

describe("verified market token information", () => {
  it("preserves HTS supply precision beyond safe JS integers", () => {
    expect(formatTokenQuantity("123456789123456789", 8)).toBe("1,234,567,891.23456789");
  });
  it("does not treat infinite max supply zero as a zero cap", () => {
    expect(tokenDetails({ decimals: "8", supply_type: "INFINITE", max_supply: "0" }).maxSupply).toBeNull();
    expect(tokenDetails({ decimals: "8", supply_type: "FINITE", max_supply: "100000000" }).maxSupply).toBe("100000000");
  });
  it("distinguishes explicitly absent controls from missing evidence", () => {
    const controls = tokenDetails({ admin_key: null, supply_key: { key: "test" } }).controls;
    expect(controls.find((c) => c.name === "Admin")?.present).toBe(false);
    expect(controls.find((c) => c.name === "Supply / mint & burn")?.present).toBe(true);
    expect(controls.find((c) => c.name === "Freeze")?.present).toBeNull();
  });
  it("matches SODAX assets by exact Hedera address, never symbol", () => {
    const assets = [{ address: "0x000000000000000000000000000000000006f89a" }];
    expect(sodaxSupports("0.0.456858", assets)).toBe(true);
    expect(sodaxSupports("0.0.456859", assets)).toBe(false);
  });
  it("keeps pool values unknown when either reserve lacks a price", () => {
    const a = { id: "0.0.1", symbol: "A", name: "A", decimals: 2, priceUsd: 1 };
    const b = { ...a, id: "0.0.2", symbol: "B", priceUsd: 0 };
    const pools = tokenPools(a.id, [{ contractId: "0.0.9", tokenA: a, tokenB: b, tokenReserveA: "100", tokenReserveB: "200" }]);
    expect(pools[0]?.liquidityUsd).toBeNull();
    expect(pools[0]?.reserveA).toBe("1 A");
  });
  it("paginates by account, excludes zero balances and ranks across pages", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ balances: [{ account: "0.0.1", balance: 0 }, { account: "0.0.2", balance: 10 }], links: { next: "/api/v1/tokens/0.0.5/balances?account.id=gt:2" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ balances: [{ account: "0.0.3", balance: 100 }], links: { next: null } })));
    const result = await readTokenHolders("0.0.5", fetcher);
    expect(result.count).toBe(2);
    expect(result.complete).toBe(true);
    expect(result.top[0]?.account).toBe("0.0.3");
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("balance=");
  });
  it("labels a capped holder scan as partial rather than exact", async () => {
    let index = 0;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ balances: [{ account: `0.0.${++index}`, balance: index }], links: { next: `/api/v1/tokens/0.0.5/balances?account.id=gt:${index}` } })));
    const result = await readTokenHolders("0.0.5", fetcher);
    expect(result.count).toBe(20);
    expect(result.complete).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(20);
  });
  it("does not report a failed holder fetch as zero holders", async () => {
    const result = await readTokenHolders("0.0.5", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    expect(result.count).toBeNull();
    expect(result.complete).toBe(false);
  });
});