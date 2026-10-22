// Buy/Sell box for a SaucerSwap-paired token, traded through HederaPumpRouter.
// The 1% HederaPump fee is always shown before the wallet confirmation — never hidden.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { MARKET_GAS, MARKET_ROUTER_ID, MIRROR_URL, WHBAR_TOKEN_ID } from "@/lib/hedera-config";
import {
  encodeMarketRouter,
  idToEvm,
  marketDeadline,
  marketFee,
  minAfterSlippage,
  quoteAmountsOut,
  toTokenUnits,
  type MarketToken,
} from "@/lib/markets";

const fmt = (v: number, max = 6) =>
  v.toLocaleString(undefined, { maximumFractionDigits: max });

/** Reads the connected wallet's HTS token balance (in token units) and association state. */
function useTokenAccount(tokenId: string, accountId: string | null) {
  return useQuery({
    queryKey: ["market-token-account", tokenId, accountId],
    enabled: !!accountId,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`);
      const j = r.ok ? await r.json() : null;
      const row = j?.tokens?.[0];
      return { associated: !!row, balance: BigInt(row?.balance ?? 0) };
    },
  });
}

async function allowance(tokenId: string, accountId: string, spenderId: string): Promise<bigint> {
  const r = await fetch(
    `${MIRROR_URL}/api/v1/accounts/${accountId}/allowances/tokens?token.id=${tokenId}&spender.id=${spenderId}&limit=1`,
  );
  const j = r.ok ? await r.json() : null;
  return BigInt(j?.allowances?.[0]?.amount ?? 0);
}

export function MarketTrade({ t }: { t: MarketToken }) {
  const w = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const acct = useTokenAccount(t.id, w.accountId);

  const feePct = 1; // MARKET_FEE_BPS = 100; kept literal so the fee shown always reads "1%"
  let estimate: string | null = null;

  async function trade() {
    if (!w.accountId) return w.connect();
    if (!MARKET_ROUTER_ID) return;
    setBusy(true);
    try {
      const tokenEvm = idToEvm(t.id);
      const deadline = marketDeadline();
      if (side === "buy") {
        const tinybars = toTokenUnits(amt, 8);
        const fee = marketFee(tinybars);
        const quotedOut = await quoteAmountsOut(tinybars - fee, [idToEvm(WHBAR_TOKEN_ID), tokenEvm]);
        const minOut = minAfterSlippage(quotedOut);
        if (acct.data && !acct.data.associated) {
          toast("One-time step: adding the coin to your wallet…");
          await w.associateToken(t.id);
        }
        await w.execute({
          calldata: encodeMarketRouter("buy", [tokenEvm, minOut, deadline]),
          gas: MARKET_GAS.buy,
          payableTinybars: tinybars,
          contractId: MARKET_ROUTER_ID,
        });
      } else {
        const units = toTokenUnits(amt, t.decimals);
        if (acct.data && units > acct.data.balance) throw new Error(`You don't hold that many ${t.symbol}`);
        if (w.accountId.includes(".") || w.accountId.startsWith("0x")) {
          const allowed = await allowance(t.id, w.accountId, MARKET_ROUTER_ID);
          if (allowed < units) {
            toast("One-time step: allowing the sale of this coin…");
            await w.approveToken(t.id, MARKET_ROUTER_ID, units > 10n ** 17n ? units : 10n ** 17n);
          }
        }
        const quotedHbar = await quoteAmountsOut(units, [tokenEvm, idToEvm(WHBAR_TOKEN_ID)]);
        const net = quotedHbar - marketFee(quotedHbar);
        const minHbarWeibar = minAfterSlippage(net) * 10_000_000_000n; // contract compares in weibar
        await w.execute({
          calldata: encodeMarketRouter("sell", [tokenEvm, units, minHbarWeibar, deadline]),
          gas: MARKET_GAS.sell,
          contractId: MARKET_ROUTER_ID,
        });
      }
      toast.success(`${side === "buy" ? "Bought" : "Sold"} — confirmed on Hedera`);
      setAmt("");
      acct.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  try {
    if (Number(amt) > 0 && t.priceHbar > 0) {
      if (side === "buy") {
        const tinybars = toTokenUnits(amt, 8);
        const tokens = Number(tinybars - marketFee(tinybars)) / 1e8 / t.priceHbar;
        estimate = `≈ ${fmt(tokens, 2)} ${t.symbol}`;
      } else {
        const hbar = (Number(amt) * t.priceHbar) * 0.99;
        estimate = `≈ ${fmt(hbar, 4)} ℏ`;
      }
    }
  } catch {
    estimate = null;
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <Button key={s} type="button" variant={side === s ? "default" : "outline"} className="min-h-11" aria-pressed={side === s} onClick={() => setSide(s)}>
            {s === "buy" ? "Buy" : "Sell"}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          inputMode="decimal"
          placeholder={side === "buy" ? "Amount in HBAR" : `Amount in ${t.symbol}`}
          className="min-h-11"
        />
        {side === "sell" && acct.data && acct.data.balance > 0n && (
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAmt((Number(acct.data.balance) / 10 ** t.decimals).toString())}>
            Max
          </Button>
        )}
      </div>
      {side === "sell" && acct.data && (
        <p className="mt-1 text-xs text-muted-foreground">
          Balance: {fmt(Number(acct.data.balance) / 10 ** t.decimals, 4)} {t.symbol}
        </p>
      )}
      {estimate && <p className="mt-1 text-sm text-muted-foreground">You get {estimate}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        HederaPump fee: {feePct}% of the trade, shown here before you confirm. The swap itself runs on SaucerSwap.
      </p>
      <Button type="button" className="mt-3 min-h-11 w-full" disabled={busy || !(Number(amt) > 0)} onClick={trade}>
        {busy ? "Waiting for wallet…" : w.accountId ? (side === "buy" ? `Buy ${t.symbol}` : `Sell ${t.symbol}`) : "Connect wallet to trade"}
      </Button>
    </div>
  );
}
