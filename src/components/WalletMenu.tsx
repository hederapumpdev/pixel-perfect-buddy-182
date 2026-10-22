import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, KeyRound, LogOut, Lock, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletHoldings } from "@/components/WalletHoldings";
import { useWallet } from "@/lib/wallet";
import { useHbarUsd, useUsd } from "@/lib/usd";
import { MIN_PIN } from "@/lib/local-wallet";
import { profileWalletAddress } from "@/lib/profile-wallets";

export function ImportWalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const w = useWallet();
  const [key, setKey] = useState("");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const unlock = !!w.storedLocal && !w.accountId;
  const [fresh, setFresh] = useState(false);
  const showUnlock = unlock && !fresh;
  const [tab, setTab] = useState<"import" | "create">("import");
  const [words, setWords] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  async function create() {
    setBusy(true);
    try {
      setWords(await w.createLocal(pin));
      setPin("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create wallet");
    } finally {
      setBusy(false);
    }
  }

  if (words)
    return (
      <Dialog open={open} onOpenChange={(o) => saved && (setWords(null), onOpenChange(o))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Write down your 24 words</DialogTitle>
            <DialogDescription>
              These words are the only way back into this wallet if you lose this device or forget your PIN.
              HederaPump can't recover them. Never share them with anyone.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid grid-cols-3 gap-2 font-mono text-xs">
            {words.map((x, i) => (
              <li key={i} className="rounded bg-secondary px-2 py-1">
                <span className="text-muted-foreground">{i + 1}.</span> {x}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Your new wallet address: <span className="break-all font-mono">{w.accountId}</span>. Send HBAR to it from
            HashPack or an exchange to start trading — Hedera opens the account on the first deposit.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I wrote them down
          </label>
          <Button disabled={!saved} onClick={() => { setWords(null); onOpenChange(false); }}>Done</Button>
        </DialogContent>
      </Dialog>
    );

  async function submit() {
    setBusy(true);
    try {
      if (showUnlock) await w.unlockLocal(pin);
      else await w.importKey({ key, accountId: account || undefined, pin });
      toast.success(showUnlock ? "Wallet unlocked" : "Wallet imported — trades go through without popups");
      setKey("");
      setPin("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import wallet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{showUnlock ? `Unlock ${w.storedLocal}` : "Import your wallet"}</DialogTitle>
          <DialogDescription>
            {showUnlock
              ? "Enter your PIN to trade instantly."
              : "Trade with one tap, no approval popups. Your key is locked with your PIN and stays on this device only — HederaPump never receives it."}
          </DialogDescription>
        </DialogHeader>
        {!showUnlock && (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
            {(["import", "create"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`rounded px-3 py-2 text-sm ${tab === t ? "bg-background text-foreground" : "text-muted-foreground"}`}>
                {t === "import" ? "Import wallet" : "Create new wallet"}
              </button>
            ))}
          </div>
        )}
        {!showUnlock && tab === "import" && (
          <>
            <div className="rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
              Anyone who gets this key or your phone + PIN controls your wallet. Only use a wallet with money you
              can afford to lose. Never type your key on a site other than hederapump.dev, and nobody from HederaPump
              will ever ask for it.
            </div>
            <Textarea
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Private key or 24-word recovery phrase"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Account ID, e.g. 0.0.123456 (optional)" />
          </>
        )}
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={showUnlock ? "PIN" : `Choose a PIN (at least ${MIN_PIN} characters)`}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {!showUnlock && tab === "create" ? (
          <Button onClick={create} disabled={busy || pin.length < MIN_PIN}>
            {busy ? "Creating…" : "Create wallet"}
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy || pin.length < MIN_PIN || (!showUnlock && !key.trim())}>
            {busy ? "Checking…" : showUnlock ? "Unlock" : "Import wallet"}
          </Button>
        )}
        {unlock && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setFresh(!fresh)}>
            {fresh ? "Back to unlock" : "Import a different wallet"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Balance at the top of every page; tap to see everything in the wallet. */
export function WalletMenu() {
  const w = useWallet();
  const usd = useUsd();
  const rate = useHbarUsd().data;
  const [importing, setImporting] = useState(false);
  const id = w.accountId;
  const addrs = id ? [...new Set([profileWalletAddress(id), w.evmAddress].filter(Boolean) as string[])] : [];

  if (!id)
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setImporting(true)} aria-label="Import wallet">
          {w.storedLocal ? <Lock className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          <span className="hidden sm:inline">{w.storedLocal ? "Unlock" : "Import"}</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={w.connectEmail} disabled={w.connecting}>
          Sign in
        </Button>
        <Button size="sm" onClick={w.connect} disabled={w.connecting}>
          <Wallet className="h-4 w-4" />
          {w.connecting ? "…" : "WalletConnect"}
        </Button>
        <ImportWalletDialog open={importing} onOpenChange={setImporting} />
      </div>
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-2 font-mono">
          <span>{w.balanceHbar != null ? `${w.balanceHbar.toFixed(2)} ℏ` : "…"}</span>
          {rate && w.balanceHbar != null && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{usd(w.balanceHbar)}</span>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80vh] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs">{id}</span>
          <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            {w.mode === "local" ? "Imported" : w.mode === "email" ? "Instant" : "WalletConnect"}
          </span>
        </div>
        <div className="-mt-4">
          <WalletHoldings accountId={id} addrs={addrs} balanceHbar={w.balanceHbar} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={w.disconnect}>
            <LogOut className="h-4 w-4" /> {w.mode === "local" ? "Lock" : "Disconnect"}
          </Button>
          {w.mode === "local" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirm("Remove the imported wallet from this device?") && w.forgetLocal()}
              aria-label="Remove imported wallet"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
