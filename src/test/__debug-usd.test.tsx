import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletHoldings } from "@/components/WalletHoldings";

const { ADDR } = vi.hoisted(() => ({ ADDR: "0x000000000000000000000000000000000000007b" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: any; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const rows =
        table === "trades"
          ? [{ token: ADDR, is_buy: true, hbar_amount: "10", token_amount: "50" }]
          : [
              {
                address: ADDR,
                name: "Test Coin",
                symbol: "TST",
                contract: "0.0.10924285",
                virtual_hbar: "3",
                virtual_tokens: "100",
              },
            ];
      const b: any = {
        select: () => b,
        eq: () => b,
        in: () => b,
        limit: () => b,
        then: (done: any) => done({ data: rows, error: null }),
      };
      return b;
    },
  },
}));

const seen: string[] = [];
const f = vi.fn(async (url: string) => {
  seen.push(url);
  const body = url.includes("exchangerate")
    ? { current_rate: { cent_equivalent: 1000, hbar_equivalent: 1000 } }
    : url.includes("/tokens?limit")
      ? { tokens: [{ token_id: "0.0.123", balance: 100_00000000 }], links: { next: null } }
      : { balance: { balance: 5_00000000 } };
  return { ok: true, json: async () => body } as Response;
});

describe("debug", () => {
  it("renders", async () => {
    vi.stubGlobal("fetch", f);
    const sb: any = await import("@/integrations/supabase/client");
    const { isV2 } = await import("@/lib/curve");
    const { NETWORK } = await import("@/lib/hedera-config");
    const { priceOf } = await import("@/lib/queries");
    const idToEvm = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");
    const acc: any = await fetch("https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.500?transactions=false").then((r) => r.json());
    const hts = new Map<string, number>();
    const tj: any = await fetch("https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.500/tokens?limit=100").then((r) => r.json());
    for (const t of tj.tokens ?? []) if (t.balance > 0) hts.set(idToEvm(t.token_id), t.balance / 1e8);
    const traded: any = await sb.supabase.from("trades").select("a").in("trader", [ADDR]);
    const cand = [...new Set([...hts.keys(), ...(traded.data ?? []).map((r: any) => r.token.toLowerCase())])];
    const coins: any = await sb.supabase.from("tokens").select("*").eq("network", NETWORK).in("address", cand);
    console.log("BAL:", acc?.balance?.balance, "HTS:", [...hts], "CAND:", cand, "COINS:", coins?.data);
    const c: any = coins?.data?.[0];
    console.log("ISV2:", c && isV2(c.contract), "AMT:", c && hts.get(c.address.toLowerCase()), "PRICE:", c && priceOf(c));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
      queryCache: new QueryCache({
        onError: (e: any, q: any) => console.log("QERR", JSON.stringify(q.queryKey), e?.message ?? e),
        onSuccess: (d: any, q: any) => console.log("QOK", q.queryKey[0], JSON.stringify(d)?.slice(0, 200)),
      }),
    });
    render(
      <QueryClientProvider client={client}>
        <WalletHoldings accountId="0.0.500" addrs={[ADDR]} balanceHbar={5} />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 1500));
    console.log("CALLS:", JSON.stringify(seen));
    console.log("HTML:", document.body.innerHTML.slice(0, 1500));
    expect(true).toBe(true);
  });
});
