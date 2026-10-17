import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      const b: any = { select: () => b, eq: () => b, in: () => Promise.resolve({ data: rows, error: null }) };
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
