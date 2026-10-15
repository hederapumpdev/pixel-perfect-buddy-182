import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { NETWORK } from "./hedera-config";

export type TokenRow = Tables<"tokens">;
export type TradeRow = Tables<"trades">;

export const tokensQuery = queryOptions({
  queryKey: ["tokens"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("network", NETWORK)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },
  refetchInterval: 15_000,
});

export const tokenQuery = (address: string) =>
  queryOptions({
    queryKey: ["token", address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("address", address)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });

export const tradesQuery = (address: string) =>
  queryOptions({
    queryKey: ["trades", address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("token", address)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });

export const progressPct = (t: TokenRow) =>
  Math.min(100, (Number(t.tokens_sold) / 800_000_000) * 100);
export const priceOf = (t: TokenRow) =>
  Number(t.virtual_tokens) > 0 ? Number(t.virtual_hbar) / Number(t.virtual_tokens) : 0;
export const mcapOf = (t: TokenRow) => priceOf(t) * 1_000_000_000;
export const imageUrl = (hash: string | null) => (hash ? `/api/public/img/${hash}` : null);
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const fmtHbar = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M ℏ`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(1)}K ℏ`
      : n >= 1
        ? `${n.toFixed(2)} ℏ`
        : `${n.toPrecision(3)} ℏ`;
export function fmtAge(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}
