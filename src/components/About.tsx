const paras: [string, string][] = [
  [
    "Launch in seconds",
    "HederaPump is a Pump.fun-style launchpad built on the Hedera network. Create a coin with a name, ticker and image, buy in at launch, and watch the price climb as people trade on the bonding curve — no coding, no liquidity pools to set up, no gatekeepers.",
  ],
  [
    "Real tokens, real trades",
    "Every coin is a real Hedera token (HTS), visible in HashPack and on HashScan from the moment it's created. Trading happens on-chain through a smart contract: every buy pushes the price up, every sell brings it down, and a 1% fee keeps the platform running — 30% goes straight to the coin's creator with every trade, automatically.",
  ],
  [
    "Graduation, no rug pulls",
    "At 800 million tokens sold, a coin graduates: the contract automatically creates a liquidity pool on SaucerSwap with all raised HBAR and the remaining tokens, and locks the LP forever — no rug pulls, no exit scams.",
  ],
  [
    "Your wallet, your choice",
    "You can trade right in the app with an email wallet, or connect HashPack if you prefer to sign every transaction yourself. Your profile shows every coin you've made and the fees you've earned, claimable with one click. DexScreener tracks coins live, even before they graduate.",
  ],
];

export function About() {
  return (
    <section className="mt-10 rounded-xl border border-border bg-card px-5 py-8 md:px-10 md:py-10">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">About HederaPump</p>
      <h2 className="mt-3 font-display text-2xl font-bold md:text-3xl">
        Meme coin launching on Hedera
      </h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {paras.map(([t, d]) => (
          <div key={t}>
            <h3 className="font-display text-lg font-semibold">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center font-display text-xl font-bold md:text-2xl">
        Fast, cheap and fully on-chain —{" "}
        <span className="text-primary">HederaPump. Create. Trade. Graduate.</span>
      </p>
    </section>
  );
}
