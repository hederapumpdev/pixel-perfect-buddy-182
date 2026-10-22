import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, LogOut, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletHoldings } from "@/components/WalletHoldings";
import { useWallet } from "@/lib/wallet";
import { useHbarUsd, useUsd } from "@/lib/usd";
import { MAX_ACCOUNT_WALLETS, MIN_PIN } from "@/lib/local-wallet";
import { profileWalletAddress } from "@/lib/profile-wallets";

/** Adds an extra wallet (import or brand-new) to the signed-in account. */
export function ImportWalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const w = useWallet();
  const [key, setKey] = useState("");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function submit() {
    setBusy(true);
    try {
      await w.importKey({ key, accountId: account || undefined, pin });
      toast.success("Wallet added to your account and set active");
      setKey("");
      setPin("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import wallet");
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
            Your new wallet address: <span className="break-all font-mono">{w.accountId}</span>. Send HBAR to it to
            start trading — Hedera opens the account on the first deposit.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I wrote them down
          </label>
          <Button disabled={!saved} onClick={() => { setWords(null); onOpenChange(false); }}>Done</Button>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a wallet to your account</DialogTitle>
          <DialogDescription>
            Up to {MAX_ACCOUNT_WALLETS} wallets per account. Trade with one tap, no approval popups. The key is locked
            with your PIN and stays on this device only — HederaPump never receives it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-1">
          {(["import", "create"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded px-3 py-2 text-sm ${tab === t ? "bg-background text-foreground" : "text-muted-foreground"}`}>
              {t === "import" ? "Import wallet" : "Create new wallet"}
            </button>
          ))}
        </div>
        {tab === "import" && (
          <>
            <div className="rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
              Anyone who gets this key or your phone + PIN controls your wallet. Only use a wallet with money you
              can afford to lose. Never type your key on a site other than hederapump.dev, and nobody from HederaPump
              will ever ask for it.
            </div>
            <Textarea value={key} onChange={(e) => setKey(e.target.value)}
              placeholder="Private key or 24-word recovery phrase" autoComplete="off" spellCheck={false}
              className="font-mono text-xs" />
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Account ID, e.g. 0.0.123456 (optional)" />
          </>
        )}
        <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)}
          placeholder={`Choose a PIN (at least ${MIN_PIN} characters)`} />
        {tab === "create" ? (
          <Button onClick={create} disabled={busy || pin.length < MIN_PIN}>{busy ? "Creating…" : "Create wallet"}</Button>
        ) : (
          <Button onClick={submit} disabled={busy || pin.length < MIN_PIN || !key.trim()}>{busy ? "Checking…" : "Import wallet"}</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const w = useWallet();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!id) return;
    setBusy(true);
    try {
      await w.activateLocal(id, pin);
      toast.success("Active wallet switched");
      setPin("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unlock");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Use {id}</DialogTitle>
          <DialogDescription>Enter this wallet's PIN to make it active.</DialogDescription>
        </DialogHeader>
        <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN"
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <Button onClick={go} disabled={busy || pin.length < MIN_PIN}>{busy ? "Unlocking…" : "Make active"}</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Balance at the top of every page; tap to see everything in the wallet. */
export function WalletMenu() {
  const w = useWallet();
  const id = w.accountId;
  return id ? <Connected id={id} /> : (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={w.connectEmail} disabled={w.connecting}>Sign in</Button>
      <Button size="sm" onClick={w.connect} disabled={w.connecting}>
        <Wallet className="h-4 w-4" />
        {w.connecting ? "…" : "WalletConnect"}
      </Button>
    </div>
  );
}

const short = (s: string) => (s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s);

function Connected({ id }: { id: string }) {
  const w = useWallet();
  const usd = useUsd();
  const rate = useHbarUsd().data;
  const [adding, setAdding] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const addrs = [...new Set([profileWalletAddress(id), w.evmAddress].filter(Boolean) as string[])];
  const active = w.mode === "local" ? id : null;
  return (
    <>
      <ImportWalletDialog open={adding} onOpenChange={setAdding} />
      <UnlockDialog id={unlocking} onClose={() => setUnlocking(null)} />
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
          {w.owner && (
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Wallets in your account ({w.accountWallets.length + 1}/{MAX_ACCOUNT_WALLETS + 1})</span>
              </div>
              {[{ wid: w.owner.id, own: true }, ...w.accountWallets.map((wid) => ({ wid, own: false }))].map(({ wid, own }) => {
                const isActive = own ? !active : active === wid;
                return (
                  <div key={wid} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isActive ? "border-primary" : "border-border"}`}>
                    <button type="button" className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => !isActive && (own ? w.activateOwner() : setUnlocking(wid))}>
                      {isActive ? <Check className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
                      <span className="font-mono text-xs">{short(wid)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {own ? (w.owner?.mode === "email" ? "Account · Instant" : "Account · HashPack") : "Added"}
                      </span>
                    </button>
                    {!own && (
                      <button type="button" aria-label="Remove wallet" className="text-muted-foreground"
                        onClick={() => confirm("Remove this wallet from your account on this device? Make sure you have its key or 24 words.") && w.removeLocal(wid)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {w.accountWallets.length < MAX_ACCOUNT_WALLETS && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Add or create wallet
                </Button>
              )}
            </div>
          )}
          <div className="-mt-1">
            <WalletHoldings accountId={id} addrs={addrs} balanceHbar={w.balanceHbar} />
          </div>
          <div className="mt-3">
            <Button size="sm" variant="outline" className="w-full" onClick={w.disconnect}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
