import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Zap, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";

const PREV = "hederaPump.prevWallet";

/** Lets HashPack/MetaMask users switch to an email/Google wallet that trades without approval popups. */
export function InstantWallet() {
  const w = useWallet();
  const [prev, setPrev] = useState<string | null>(null);
  useEffect(() => {
    try {
      setPrev(localStorage.getItem(PREV));
    } catch {
      /* blocked */
    }
  }, []);

  async function create() {
    try {
      if (w.accountId) localStorage.setItem(PREV, w.accountId);
    } catch {
      /* blocked */
    }
    await w.disconnect();
    await w.connectEmail();
  }

  function copy(s: string) {
    navigator.clipboard?.writeText(s).then(() => toast.success("Address copied"));
  }

  if (w.mode === "email") {
    const addr = w.evmAddress ?? w.accountId ?? "";
    const empty = !(Number(w.balanceHbar) > 0);
    return (
      <div className="mt-6 rounded-lg border border-primary/40 bg-card p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-primary" /> Instant wallet — no approvals
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {empty
            ? "Top it up to start: in HashPack tap Send, choose HBAR and paste this address."
            : "You buy and sell straight away. Top up any time by sending HBAR to this address."}
        </p>
        <button
          onClick={() => copy(addr)}
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left font-mono text-xs"
        >
          <span className="min-w-0 flex-1 break-all">{addr}</span>
          <Copy className="h-4 w-4 shrink-0" />
        </button>
        {prev && (
          <p className="mt-2 text-xs text-muted-foreground">Your previous wallet: {prev}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-primary/40 bg-card p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Zap className="h-4 w-4 text-primary" /> Trade without approvals
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create an instant wallet with email or Google. Then you buy and sell with one tap, no wallet popup.
        Afterwards, send some HBAR to it from this wallet.
      </p>
      <Button className="mt-3 w-full" onClick={create} disabled={w.connecting}>
        {w.connecting ? "Opening…" : "Create instant wallet"}
      </Button>
    </div>
  );
}
