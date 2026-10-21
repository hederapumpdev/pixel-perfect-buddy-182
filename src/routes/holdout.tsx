import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/Shell";
import { HederaAddress } from "@/components/HederaAddress";
import { HoldOutCard } from "@/components/HoldOutCard";
import { getHoldoutOverview } from "@/lib/holdout.functions";
import { HASHSCAN_URL } from "@/lib/hedera-config";
import { fmtHbar, tokensQuery } from "@/lib/queries";
import { useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/holdout")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Hold Out rewards — HederaPump" },
      { name: "description", content: "Hold HederaPump coins for 7+ days and share in a weekly HBAR reward pot funded by 10% of trading fees." },
      { property: "og:title", content: "Hold Out rewards — HederaPump" },
      { property: "og:description", content: "Weekly HBAR rewards for people who keep holding their HederaPump coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HoldOut,
});

const hbar = (t: string | number) => fmtHbar(Number(t) / 1e8);

function HoldOut() {
  const w = useWallet();
  const overview = useServerFn(getHoldoutOverview);
  const q = useQuery({ queryKey: ["holdout-overview"], queryFn: () => overview(), refetchInterval: 60_000 });
  const { data: tokens = [] } = useQuery(tokensQuery);
  const sym = new Map(tokens.map((t) => [t.address, t.symbol]));
  const d = q.data;
  const wallet = w.evmAddress ?? w.accountId ?? "";
  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-4xl font-bold">Hold Out</h1>
          <p className="mt-2 text-muted-foreground">
            10% of every trading fee goes into a weekly HBAR pot. Each coin's share of the pot matches the fees it
            generated that week, and it is split among people who hold that coin.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Pot so far this week ({d?.period ?? "…"})</p>
            <p className="mt-1 font-mono text-3xl font-semibold">{d ? hbar(d.pot) : "…"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Paid out after the week ends (Monday 00:00 UTC). Amounts are estimates until then.</p>
          </div>
          {wallet ? <HoldOutCard wallet={wallet} /> : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Connect your wallet to see your estimated reward. <Link to="/profile" className="text-primary hover:underline">Go to profile</Link>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xl font-semibold">How rewards are counted</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Balances are recorded 4 times a week. Your share is your average part of the coin's holder supply.</li>
            <li>Tokens count only after you've held them for 7 days. Newly bought tokens get their own age.</li>
            <li>The longer you hold, the bigger your multiplier: 1.0× rising to 2.0× at 60 days.</li>
            <li>Coin contracts, liquidity pools, the coin's creator and platform wallets don't take part.</li>
            <li>Rewards under 0.1 HBAR, and rounding leftovers, roll into next week's pot.</li>
            <li>Rewards depend on real trading fees; there is no fixed or guaranteed return.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Pot per coin this week</h2>
          {!d?.coins.length ? <p className="mt-2 text-sm text-muted-foreground">No qualifying coins yet this week.</p> : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-2">Coin</th><th className="p-2">Fees this week</th><th className="p-2">Est. pot</th><th className="p-2">Holders</th></tr></thead>
                <tbody>
                  {d.coins.map((c) => (
                    <tr key={c.token} className="border-t border-border">
                      <td className="p-2"><Link to="/token/$id" params={{ id: c.token }} className="text-primary hover:underline">{sym.get(c.token) ?? c.token.slice(0, 10)}</Link></td>
                      <td className="p-2 font-mono">{hbar(c.fees)}</td>
                      <td className="p-2 font-mono">{hbar(c.pot)}</td>
                      <td className="p-2 font-mono">{c.holders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold">Recent payouts</h2>
          {!d?.payouts.length ? <p className="mt-2 text-sm text-muted-foreground">No payouts yet.</p> : (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
              {d.payouts.map((p) => (
                <li key={`${p.period}${p.account}`} className="flex flex-wrap items-center justify-between gap-2 p-2">
                  <HederaAddress address={p.account} />
                  <span className="text-muted-foreground">Week of {p.period}</span>
                  <span className="font-mono">
                    {hbar(p.tinybars)}{" "}
                    {p.tx_hash ? <a href={`${HASHSCAN_URL}/transaction/${p.tx_hash}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.status}</a> : <span className="text-muted-foreground">{p.status}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
