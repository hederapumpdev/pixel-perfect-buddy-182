import { ShareButton } from "@/components/ShareCard";
import { Comments, Holders } from "@/components/CoinExtras";
import { FollowButton } from "@/components/PriceAlerts";
import { Avatar, useProfiles } from "@/components/ProfileEditor";
import { HederaAddress, useHederaId } from "@/components/HederaAddress";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { TokenImage } from "@/components/TokenCard";
import { BondingProgress } from "@/components/BondingProgress";
import { TradeStatistics } from "@/components/TradeStatistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { socialUrl } from "@/lib/social-links";
import { useChainSync } from "@/hooks/use-sync";
import {
  tokenQuery,
  tradesQuery,
  fmtHbar,
  fmtAge,
  mcapOf,
  priceOf,
} from "@/lib/queries";
import {
  quoteBuy,
  quoteSell,
  toTinybars,
  toUnits,
  fromTinybars,
  fromUnits,
  isV2,
  isV4,
  tokenUnit,
} from "@/lib/curve";
import { encodePump, encodePumpV2, encodePumpV4, encodeToken } from "@/lib/curve";
import { getReferrer } from "@/lib/referral";
import {
  CURVE_SUPPLY_V2,
  GAS,
  GAS_V2,
  HASHSCAN_URL,
  MIRROR_URL,
  PUMP_CONTRACT_V2_ID,
} from "@/lib/hedera-config";

/** Long-zero EVM address of a 0.0.N token/contract -> its "0.0.N" ID. */
const evmToId = (addr: string) => `0.0.${BigInt(addr).toString()}`;

export const Route = createFileRoute("/token/$id")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Coin — HederaPump" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content: "Chart, trades and bonding-curve progress for a HederaPump coin.",
      },
      { property: "og:title", content: "Coin — HederaPump" },
      { property: "og:description", content: "Trade this coin on HederaPump." },
    ],
  }),
  component: TokenPage,
});

async function tokenBalance(token: string, holder: string): Promise<bigint> {
  const data = encodeToken("balanceOf", [holder]);
  const r = await fetch(`${MIRROR_URL}/api/v1/contracts/call`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data, to: token, estimate: false }),
  });
  const j = await r.json();
  return BigInt(j.result && j.result !== "0x" ? j.result : "0x0");
}

const SLIPPAGE_BPS = 300n;

function AddrRow({ label, addr, href }: { label: string; addr: string; href: string }) {
  const nativeId = useHederaId(addr);
  const displayAddress = nativeId ?? addr;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs" title={addr}>{displayAddress}</span>
      <Button size="sm" variant="secondary"
        onClick={() =>
          navigator.clipboard.writeText(displayAddress).then(() => toast.success(`${label} copied`))
        }
        className="shrink-0 rounded bg-secondary px-2 py-1 text-xs"
      >
        Copy
      </Button>
      <a href={nativeId ? href.replace(addr, nativeId) : href} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-accent">
        HashScan
      </a>
    </div>
  );
}

function TokenPage() {
  const { id } = Route.useParams();
  const sync = useChainSync(8000);
  const w = useWallet();
  const { data: t, isLoading } = useQuery(tokenQuery(id));
  const { data: trades = [] } = useQuery(tradesQuery(id));
  const profiles = useProfiles(trades.slice(0, 50).map((trade) => trade.trader));
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tab, setTab] = useState<"trades" | "holders" | "comments" | "about">("trades");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [bal, setBal] = useState<bigint>(0n);

  useEffect(() => {
    if (!w.evmAddress) return setBal(0n);
    tokenBalance(id, w.evmAddress)
      .then(setBal)
      .catch(() => setBal(0n));
  }, [id, w.evmAddress, trades.length]);

  if (isLoading)
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  if (!t)
    return (
      <Shell>
        <p>Coin not found yet. If it was just launched, give it a few seconds.</p>
        <Link to="/explore" className="text-primary">
          Back to explore
        </Link>
      </Shell>
    );

  const v2 = isV2(t.contract);
  const unit = tokenUnit(t.contract);
  const state = {
    virtualHbar: BigInt(Math.round(Number(t.virtual_hbar) * 1e8)),
    virtualTokens: BigInt(Math.round(Number(t.virtual_tokens))) * unit,
    tokensSold: BigInt(Math.round(Number(t.tokens_sold))) * unit,
  };
  const ready = state.virtualHbar > 0n;
  let est = "—";
  try {
    if (ready && Number(amt) > 0)
      est =
        side === "buy"
          ? `${fromUnits(quoteBuy(state, toTinybars(amt), t.contract).tokensOut, t.contract).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.symbol}`
          : `${fromTinybars(quoteSell(state, toUnits(amt, t.contract)).hbarOut).toFixed(4)} ℏ`;
  } catch {
    /* bad input */
  }

  // V2 coins are HTS tokens: the wallet must hold the token (associate) before
  // the first buy and let the contract spend it (allowance) before the first sell.
  async function isAssociated(tokenId: string, accountId: string) {
    const j = await fetch(
      `${MIRROR_URL}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`,
    ).then((r) => (r.ok ? r.json() : null));
    return (j?.tokens?.length ?? 0) > 0;
  }
  async function allowance(tokenId: string, accountId: string, spenderId: string) {
    const j = await fetch(
      `${MIRROR_URL}/api/v1/accounts/${accountId}/allowances/tokens?token.id=${tokenId}&spender.id=${spenderId}&limit=1`,
    ).then((r) => (r.ok ? r.json() : null));
    return BigInt(j?.allowances?.[0]?.amount ?? 0);
  }

  async function trade() {
    if (!w.accountId) return w.connect();
    if (!t || !(Number(amt) > 0)) return;
    setBusy(true);
    try {
      if (side === "buy") {
        const value = toTinybars(amt);
        const q = ready ? quoteBuy(state, value, t.contract) : null;
        const min = q ? (q.tokensOut * (10_000n - SLIPPAGE_BPS)) / 10_000n : 0n;
        if (v2) {
          const tokenId = evmToId(t.address);
          if (w.accountId.includes(".") && !(await isAssociated(tokenId, w.accountId))) {
            toast("One-time step: adding the coin to your wallet…");
            await w.associateToken(tokenId);
          }
          // The buy that sells the last curve tokens also lists on SaucerSwap,
          // which needs much more gas.
          const final = !!q && q.tokensOut >= CURVE_SUPPLY_V2 - state.tokensSold;
          const ref = getReferrer();
          await w.execute({
            calldata: isV4(t.contract)
              ? encodePumpV4("buy", [t.address, min, ref ?? "0x0000000000000000000000000000000000000000"])
              : encodePumpV2("buy", [t.address, min]),
            gas: final ? GAS_V2.buyFinal : GAS_V2.buy,
            payableTinybars: value,
            contractId: t.contract,
          });
        } else {
          await w.execute({
            calldata: encodePump("buy", [t.address, min]),
            gas: GAS.buy,
            payableTinybars: value,
          });
        }
      } else {
        const units = toUnits(amt, t.contract);
        if (units > bal) throw new Error("You don't hold that many");
        const min = (quoteSell(state, units).hbarOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
        if (v2) {
          const tokenId = evmToId(t.address);
          if (
            w.accountId.includes(".") &&
            (await allowance(tokenId, w.accountId, t.contract)) < units
          ) {
            toast("One-time step: allowing the sale of this coin…");
            await w.approveToken(tokenId, t.contract, CURVE_SUPPLY_V2);
          }
          await w.execute({
            calldata: isV4(t.contract)
              ? encodePumpV4("sell", [t.address, units, min, getReferrer() ?? "0x0000000000000000000000000000000000000000"])
              : encodePumpV2("sell", [t.address, units, min]),
            gas: GAS_V2.sell,
            contractId: t.contract,
          });
        } else {
          await w.execute({ calldata: encodePump("sell", [t.address, units, min]), gas: GAS.sell });
        }
      }
      toast.success(`${side === "buy" ? "Bought" : "Sold"} — confirmed on Hedera`);
      setAmt("");
      setTimeout(() => sync().catch(() => {}), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  // Start from the launch price so a single trade already draws a line.
  const pts = [
    20_000 / 1_073_000_000,
    ...[...trades].reverse().map((r) => Number(r.price)),
    ...(trades.length ? [priceOf(t)] : []),
  ];
  const max = Math.max(...pts, 0),
    min = Math.min(...pts, max);
  const path =
    pts.length > 1
      ? pts
          .map(
            (p, i) => `${(i / (pts.length - 1)) * 100},${95 - ((p - min) / (max - min || 1)) * 90}`,
          )
          .join(" ")
      : "";

  return (
    <Shell>
      <div className="flex items-start gap-4">
        <TokenImage t={t} className="h-16 w-16" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{t.name}</h1><ShareButton t={t} /></div>
            <span className="font-mono text-muted-foreground">${t.symbol}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{fmtAge(t.created_at)} old</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <AddrRow label={isV2(t.contract) ? "Token ID" : "CA"} addr={t.address} href={`${HASHSCAN_URL}/${isV2(t.contract) ? "token" : "contract"}/${t.address}`} />
        <AddrRow label="Creator" addr={t.creator} href={`${HASHSCAN_URL}/account/${t.creator}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            {t.graduated ? (
              <p className="text-sm">
                This coin has graduated. Curve trading is closed; liquidity moves to a Hedera DEX.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSide(s);
                        setAmt("");
                      }}
                      className={`rounded py-2 text-sm font-semibold capitalize ${side === s ? (s === "buy" ? "bg-up text-primary-foreground" : "bg-down text-destructive-foreground") : "text-muted-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                  <span>Amount ({side === "buy" ? "HBAR" : t.symbol})</span>
                  {w.accountId && (
                    <span className="font-mono">
                      In wallet: {w.balanceHbar?.toFixed(2) ?? "—"} ℏ ·{" "}
                      {fromUnits(bal, t.contract).toLocaleString(undefined, { maximumFractionDigits: 0 })} {t.symbol}
                    </span>
                  )}
                </div>
                <Input
                  inputMode="decimal"
                  value={amt}
                  onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.0"
                  className="mt-1 h-12 font-mono text-lg"
                />
                <div className="mt-2 flex gap-2">
                  {side === "buy"
                    ? ["10", "50", "100", "500"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setAmt(v)}
                          className="flex-1 rounded bg-secondary py-1 font-mono text-xs"
                        >
                          {v} ℏ
                        </button>
                      ))
                    : [25n, 50n, 100n].map((pc) => (
                        <button
                          key={String(pc)}
                          onClick={() => setAmt(String(fromUnits((bal * pc) / 100n, t.contract)))}
                          className="flex-1 rounded bg-secondary py-1 font-mono text-xs"
                        >
                          {String(pc)}%
                        </button>
                      ))}
                </div>
                <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>You receive (est.)</span>
                    <span className="text-foreground">{est}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee</span>
                    <span>1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max slippage</span>
                    <span>3%</span>
                  </div>
                </div>
                <Button
                  className="mt-4 h-12 w-full text-base"
                  disabled={busy || (!!w.accountId && !(Number(amt) > 0))}
                  onClick={trade}
                >
                  {busy
                    ? "Confirm in wallet…"
                    : w.accountId
                      ? `${side === "buy" ? "Buy" : "Sell"} ${t.symbol}`
                      : "Connect wallet"}
                </Button>
              </>
            )}
          </div>
          <BondingProgress token={t} />
        </aside>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold">{fmtHbar(mcapOf(t))}</span>
              <span className="text-xs text-muted-foreground">
                market cap · price {priceOf(t).toPrecision(3)} ℏ · vol{" "}
                {fmtHbar(Number(t.volume_hbar))}
              </span>
            </div>
            {path ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-56 w-full">
                <polyline
                  points={path}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-up"
                  style={{ strokeWidth: 2 }}
                />
              </svg>
            ) : (
              <p className="mt-4 grid h-56 place-items-center text-sm text-muted-foreground">
                Chart appears after the first trades.
              </p>
            )}
          </div>

          <TradeStatistics token={t.address} />

          <div className="rounded-lg border border-border bg-card">
            <div className="flex gap-2 p-2 border-b border-border">
              {(
                [
                  ["trades", "Trades"],
                  ["holders", "Holders"],
                  ["comments", "Comments"],
                  ["about", "About"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    tab === key
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "trades" && (
            <div className="divide-y divide-border font-mono text-xs">
              {trades.slice(0, 50).map((r) => (
                <a
                  key={r.id}
                  href={`${HASHSCAN_URL}/transaction/${r.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid grid-cols-[0.6fr_1.4fr_1fr_1fr] items-center gap-2 px-4 py-2 hover:bg-secondary"
                >
                  <span className={r.is_buy ? "text-up" : "text-down"}>
                    {r.is_buy ? "BUY" : "SELL"}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground" title={r.trader}>
                    {profiles[r.trader.toLowerCase()] && <Avatar hash={profiles[r.trader.toLowerCase()]?.avatar} size={24} />}
                    <span className="truncate">{profiles[r.trader.toLowerCase()]?.name ?? <HederaAddress address={r.trader} />}</span>
                  </span>
                  <span>{Number(r.hbar_amount).toFixed(2)} ℏ</span>
                  <span className="text-right text-muted-foreground">
                    {fmtAge(r.created_at)} ago
                  </span>
                </a>
              ))}
              {!trades.length && (
                <p className="px-4 py-6 text-center text-muted-foreground">No trades yet.</p>
              )}
          </div>
            )}
            {tab === "holders" && (
              <div className="p-4">
                <Holders
                  tokenId={v2 ? `0.0.${BigInt(t.address)}` : null}
                  decimals={v2 ? 8 : 18}
                  creator={t.creator}
                  contract={t.contract}
                  trades={trades}
                  supply={1_000_000_000}
                />
              </div>
            )}
            {tab === "comments" && (
              <div className="p-4">
                <Comments token={t.address} author={w.evmAddress ?? w.accountId ?? null} />
              </div>
            )}
            {tab === "about" && (
              <div className="space-y-3 p-4 text-sm">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {t.description || "No description yet."}
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(
                    [
                      ["X / Twitter", socialUrl("twitter", t.twitter) ?? undefined],
                      ["Telegram", socialUrl("telegram", t.telegram) ?? undefined],
                      ["Website", socialUrl("website", t.website) ?? undefined],
                      ["DexScreener", `https://dexscreener.com/hedera/${t.address}`],
                    ] as const
                  )
                    .filter(([, href]) => href)
                    .map(([label, href]) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {label}
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
          <FollowButton token={t.address} symbol={t.symbol} />
        </div>
      </div>
    </Shell>
  );
}
