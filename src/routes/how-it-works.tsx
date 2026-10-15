import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — HederaPump" },
      {
        name: "description",
        content: "How bonding curves, fees and DEX graduation work on HederaPump.",
      },
      { property: "og:title", content: "How it works — HederaPump" },
      { property: "og:description", content: "Bonding curves, fees and graduation explained." },
    ],
  }),
  component: How,
});

const steps = [
  ["Launch", "Anyone creates a coin with a fixed supply. No presale and no team allocation."],
  [
    "Trade on the curve",
    "Price rises as people buy and falls as they sell, following a public bonding-curve formula.",
  ],
  [
    "Graduate",
    "When the curve fills, liquidity moves to a supported Hedera DEX and trading continues there.",
  ],
  ["Fees", "A disclosed 1% fee per curve trade funds the platform and rewards the coin's creator."],
];

function How() {
  return (
    <Shell>
      <h1 className="text-3xl font-bold">How it works</h1>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {steps.map(([t, d], i) => (
          <div key={t} className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-sm text-primary">0{i + 1}</p>
            <h2 className="mt-1 text-xl font-semibold">{t}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
        Meme coins are extremely risky and most lose value. Only trade what you can afford to lose.
      </p>
    </Shell>
  );
}
