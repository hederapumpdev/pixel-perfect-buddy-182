export type Token = {
  id: string; name: string; ticker: string; emoji: string; creator: string;
  price: number; mcap: number; volume: number; ageMin: number; holders: number;
  progress: number; change: number; graduated: boolean; description: string;
};

const names: [string, string, string][] = [
  ["Hashcat", "HCAT", "🐱"], ["Gossip Frog", "GFROG", "🐸"], ["Consensus Dog", "CDOG", "🐶"],
  ["HBAR Moon", "HMOON", "🌙"], ["Tinybar", "TINY", "🪙"], ["Node Goblin", "GOB", "👺"],
  ["Ledger Llama", "LLAMA", "🦙"], ["Shard Shark", "SHRK", "🦈"], ["Pepe Graph", "PGRAPH", "🕸️"],
  ["Mirror Monke", "MONKE", "🐒"], ["Atomic Duck", "QUACK", "🦆"], ["Fair Order", "FAIR", "⚖️"],
];

export const DEMO_TOKENS: Token[] = names.map(([name, ticker, emoji], i) => {
  const progress = [12, 87, 45, 100, 5, 63, 100, 28, 74, 91, 38, 19][i]!;
  const mcap = 4000 + progress * 820 + i * 333;
  return {
    id: ticker.toLowerCase(), name, ticker, emoji,
    creator: `0.0.${4810000 + i * 1371}`,
    price: mcap / 1_000_000_000, mcap, volume: mcap * (0.3 + (i % 4) * 0.4),
    ageMin: [3, 45, 120, 1440, 1, 300, 2880, 18, 90, 600, 7, 30][i]!,
    holders: 20 + progress * 7 + i * 3, progress,
    change: [42.1, -12.4, 8.9, 155.2, 3.1, -4.7, 22.0, -31.5, 67.3, 11.8, 0.6, -2.2][i]!,
    graduated: progress >= 100,
    description: `${name} is a community meme coin launched on HederaPump. Demo listing.`,
  };
});

export const getToken = (id: string) => DEMO_TOKENS.find((t) => t.id === id);

export const fmtHbar = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M ℏ` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K ℏ` : `${n.toFixed(2)} ℏ`;
export const fmtAge = (m: number) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`);

export function demoTrades(t: Token) {
  return Array.from({ length: 12 }, (_, i) => ({
    side: (i * 7 + t.ticker.length) % 3 === 0 ? "sell" : "buy",
    account: `0.0.${5120000 + i * 913 + t.holders}`,
    hbar: ((i + 3) * 37.5) % 900 + 10,
    ago: `${i * 2 + 1}m`,
  }));
}

export function demoChart(t: Token) {
  let v = 50;
  return Array.from({ length: 48 }, (_, i) => {
    v += Math.sin(i * 0.7 + t.holders) * 4 + (t.change > 0 ? 1 : -0.6);
    return Math.max(5, v);
  });
}
