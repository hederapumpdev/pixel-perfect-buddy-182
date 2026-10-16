import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Compass, PlusCircle, Wallet, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { NETWORK, PUMP_CONTRACT_ID } from "@/lib/hedera-config";
import logo from "@/assets/hederapump-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/create", label: "Create Coin" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/profile", label: "Profile" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <img src={logo} alt="HederaPump logo" width={32} height={32} className="h-8 w-8 object-contain" />
      Hedera<span className="text-primary">Pump</span>
    </Link>
  );
}

function WalletButton() {
  const w = useWallet();
  if (w.accountId)
    return (
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {w.balanceHbar != null ? `${w.balanceHbar.toFixed(2)} ℏ` : ""}
        </span>
        <span className="max-w-[9rem] truncate rounded-md bg-secondary px-2 py-1 font-mono text-xs">
          {w.accountId}
        </span>
        <Button size="icon" variant="ghost" aria-label="Disconnect wallet" onClick={w.disconnect}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={w.connectEmail} disabled={w.connecting}>
        Sign in
      </Button>
      <Button size="sm" onClick={w.connect} disabled={w.connecting}>
        <Wallet className="h-4 w-4" />
        {w.connecting ? "…" : "HashPack"}
      </Button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const live = NETWORK === "mainnet";
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div
        className={`border-b py-1 text-center font-mono text-[11px] ${live ? "border-up/30 bg-up/10 text-up" : "border-warn/30 bg-warn/10 text-warn"}`}
      >
        HEDERA {NETWORK.toUpperCase()} · {live ? "real HBAR — trades are final" : "test network"}
        {!PUMP_CONTRACT_ID && " · launchpad contract not deployed yet"}
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Logo />
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground bg-secondary" }}
                activeOptions={{ exact: true }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto hidden max-w-7xl px-4 py-10 text-xs text-muted-foreground md:block">
        Meme coins are highly speculative. Nothing here is financial advice. © 2026 HederaPump
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {[
          { to: "/", label: "Home", Icon: Home },
          { to: "/explore", label: "Explore", Icon: Compass },
          { to: "/create", label: "Create", Icon: PlusCircle },
          { to: "/how-it-works", label: "Guide", Icon: BookOpen },
          { to: "/profile", label: "Profile", Icon: Wallet },
        ].map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: true }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
