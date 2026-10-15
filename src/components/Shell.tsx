import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Compass, PlusCircle, Wallet, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/create", label: "Create Coin" },
  { to: "/how-it-works", label: "How It Works" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">ℏ</span>
      Hedera<span className="text-primary">Pump</span>
    </Link>
  );
}

export function DemoBadge() {
  return <span className="rounded border border-warn/50 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warn">Demo data</span>;
}

export function Shell({ children }: { children: ReactNode }) {
  const connect = () => toast("Wallet connection (HashPack / WalletConnect) arrives in the next phase.");
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="border-b border-warn/30 bg-warn/10 py-1 text-center font-mono text-[11px] text-warn">
        HEDERA TESTNET · Interface preview — all figures are DEMO DATA
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Logo />
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }} activeOptions={{ exact: true }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground sm:flex">
              <span className="h-2 w-2 rounded-full bg-warn" /> Testnet
            </span>
            <Button size="sm" onClick={connect}><Wallet className="h-4 w-4" />Connect</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto hidden max-w-7xl px-4 py-10 text-xs text-muted-foreground md:block">
        Meme coins are highly speculative. Nothing here is financial advice. © 2026 HederaPump
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {[
          { to: "/", label: "Home", Icon: Home },
          { to: "/explore", label: "Explore", Icon: Compass },
          { to: "/create", label: "Create", Icon: PlusCircle },
          { to: "/how-it-works", label: "Guide", Icon: BookOpen },
        ].map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>
            <Icon className="h-5 w-5" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
