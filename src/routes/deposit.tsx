import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";

// Hosted SODAX swap widget, locked to HBAR on Hedera as the destination.
// Funds go user → SODAX directly; HederaPump never touches them.
const WIDGET_ORIGIN = "https://widget.sodax.com";
const WIDGET_SRC = `${WIDGET_ORIGIN}/?embed=1&dstChain=hedera&dstToken=HBAR&lockDst=1&theme=dark&surface=0b1220&accent=00c805&cta=00c805&text=e6edf3`;

export const Route = createFileRoute("/deposit")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Deposit from any chain — HederaPump" },
      { name: "description", content: "Swap crypto from Base, Solana, Arbitrum and more into HBAR on Hedera, then trade meme coins on HederaPump." },
      { property: "og:title", content: "Deposit from any chain — HederaPump" },
      { property: "og:description", content: "Bring crypto from other networks to Hedera as HBAR in one swap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deposit,
});

function Deposit() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const f = ref.current;
      if (!f || e.source !== f.contentWindow || e.origin !== WIDGET_ORIGIN) return;
      const d = e.data as { type?: string; height?: unknown } | null;
      if (d?.type === "sodax:resize" && typeof d.height === "number" && Number.isFinite(d.height))
        f.style.height = `${Math.max(760, Math.min(1600, d.height))}px`;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <Shell>
      <section className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Deposit</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Deposit from any chain</h1>
        <p className="mt-3 text-muted-foreground">
          Swap crypto from Base, Arbitrum, Solana and other networks into HBAR on Hedera. Then buy coins on HederaPump.
          You can swap back the same way when you're done.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Send the HBAR to your own Hedera wallet address (e.g. your HashPack account).</li>
          <li>Swaps are real and on mainnet. Check the quote before you confirm.</li>
        </ul>
        <div className="mt-6 flex justify-center">
          <iframe
            ref={ref}
            src={WIDGET_SRC}
            title="SODAX swap"
            loading="lazy"
            referrerPolicy="origin"
            allow="ethereum; solana; clipboard-write"
            className="w-full max-w-[480px] rounded-3xl border-0"
            style={{ height: 760 }}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Swaps are run by SODAX, an independent cross-chain protocol, not by HederaPump. HederaPump never holds your funds.
          Not financial advice.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild><Link to="/explore">Explore coins</Link></Button>
        </div>
      </section>
    </Shell>
  );
}
