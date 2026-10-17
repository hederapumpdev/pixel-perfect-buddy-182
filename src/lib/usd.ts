import { useQuery } from "@tanstack/react-query";
import { MIRROR_URL } from "@/lib/hedera-config";

/** Live HBAR→USD rate from the Hedera mirror node (same source the bot uses). */
export function useHbarUsd() {
  return useQuery({
    queryKey: ["hbar-usd"],
    queryFn: async () => {
      const r = await fetch(`${MIRROR_URL}/api/v1/network/exchangerate`);
      if (!r.ok) throw new Error("rate unavailable");
      const { current_rate: c } = await r.json();
      return c.cent_equivalent / c.hbar_equivalent / 100 as number;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

/** Dollars with 4 decimals for values too small for cents, otherwise 2. */
export const fmtUsd = (n: number) => {
  const d = n > 0 && n < 0.01 ? 4 : 2;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

/** HBAR value with its dollar equivalent next to it. */
export function useUsd() {
  const rate = useHbarUsd().data;
  return (hbar: number) => (rate ? fmtUsd(hbar * rate) : "…");
}
