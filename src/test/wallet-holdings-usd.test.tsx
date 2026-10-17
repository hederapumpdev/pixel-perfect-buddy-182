import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalletHoldings } from "@/components/WalletHoldings";

// vi.mock factories run before the imports below, so the address lives in vi.hoisted.
const { ADDR } = vi.hoisted(() => ({ ADDR: "0x000000000000000000000000000000000000007b" })); // 0.0.123

// Link needs a router context the holdings card never has on its own.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: any; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// The coin list and the trade history the cost basis is built from.
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
      // Real query builders stay chainable and resolve when awaited.
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        then: (done: any) => done({ data: rows, error: null }),
      };
      return builder;
    },
  },
}));

const mirror = vi.fn(async (url: string) => {
  const body = url.includes("exchangerate")
    ? { current_rate: { cent_equivalent: 1000, hbar_equivalent: 1000 } } // 1 HBAR = $0.01
    : url.includes("/tokens?limit")
      ? { tokens: [{ token_id: "0.0.123", balance: 100_00000000 }], links: { next: null } }
      : { balance: { balance: 5_00000000 } }; // 5 HBAR
  return { ok: true, json: async () => body } as Response;
});

function renderHoldings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WalletHoldings accountId="0.0.500" addrs={[ADDR]} balanceHbar={5} />
    </QueryClientProvider>,
  );
}

describe("Wallet holdings dollars", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the dollar value of the HBAR balance, the coin and the loss", async () => {
    vi.stubGlobal("fetch", mirror);
    renderHoldings();

    // 5 HBAR at $0.01
    expect(await screen.findByText("$0.05", undefined, { timeout: 5000 })).toBeInTheDocument();
    // coin worth 3 HBAR at $0.01, bought for 20 HBAR
    expect(await screen.findByText(/\$0\.03/, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText(/\$0\.17/, undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});
