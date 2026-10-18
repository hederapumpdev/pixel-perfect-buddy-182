import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Compass, PlusCircle, Wallet, BookOpen, LogOut, LifeBuoy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { NETWORK, PUMP_CONTRACT_ID } from "@/lib/hedera-config";
import { LiveTicker } from "@/components/LiveTicker";
import { AlertWatcher } from "@/components/PriceAlerts";
import logo from "@/assets/hederapump-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/create", label: "Create Coin" },
  { to: "/contest", label: "Contest" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/profile", label: "Profile" },
  { to: "/support", label: "Support" },
] as const;

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4863 0-.1636-.3939-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0287zM8.02 17.1211c-1.1834 0-2.1558-1.0845-2.1558-2.4189 0-1.3344.9556-2.4189 2.1558-2.4189 1.2104 0 2.176 1.0944 2.1558 2.4189 0 1.3344-.9556 2.4189-2.1558 2.4189zm7.9748 0c-1.1834 0-2.1558-1.0845-2.1558-2.4189 0-1.3344.9556-2.4189 2.1558-2.4189 1.2104 0 2.176 1.0944 2.1558 2.4189 0 1.3344-.9456 2.4189-2.1558 2.4189Z" />
    </svg>
  );
}

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
      <Button size="sm" variant="secondary" onClick={w.connectMetaMask} disabled={w.connecting}>
        MetaMask
      </Button>
      <Button size="sm" onClick={w.connect} disabled={w.connecting}>
        <Wallet className="h-4 w-4" />
        {w.connecting ? "…" : "WalletConnect"}
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
      <LiveTicker />
      <AlertWatcher />
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-2 px-4 py-2 lg:flex-nowrap lg:gap-6">
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
      <footer className="mx-auto max-w-7xl px-4 pb-24 pt-10 text-xs text-muted-foreground md:pb-10">
        <div className="mb-4 flex flex-wrap gap-3">
          <a
            href="https://x.com/hederapumpdev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary"
          >
            <span className="text-base leading-none">𝕏</span> Twitter
          </a>
          <a
            href="https://t.me/hederapump"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary"
          >
            <Send className="h-4 w-4 text-primary" /> Telegram
          </a>
          <a
            href="https://discord.gg/bYPD27QtZ"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary"
          >
            <DiscordIcon className="h-4 w-4 text-primary" /> Discord
          </a>
        </div>
        Meme coins are highly speculative. Nothing here is financial advice. © 2026 HederaPump
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {[
          { to: "/", label: "Home", Icon: Home },
          { to: "/explore", label: "Explore", Icon: Compass },
          { to: "/create", label: "Create", Icon: PlusCircle },
          { to: "/how-it-works", label: "Guide", Icon: BookOpen },
          { to: "/profile", label: "Profile", Icon: Wallet },
          { to: "/support", label: "Help", Icon: LifeBuoy },
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
