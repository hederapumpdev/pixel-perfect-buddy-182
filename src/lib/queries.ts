import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { NETWORK } from "./hedera-config";
import { TRADE_WINDOWS, type TradeWindow, type StatisticsTrade } from "./trade-statistics";
import { fallbackAddress } from "./hedera-address";

export type TokenRow = Tables<"tokens">;
export type TradeRow = Tables<"trades">;

export const tokensQuery = queryOptions({
  queryKey: ["tokens"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("network", NETWORK)
      .eq("hidden", false)
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

export const tradeStatisticsQuery = (address: string, window: TradeWindow) =>
  queryOptions({
    queryKey: ["trade-statistics", address, window],
    queryFn: async ({ signal }) => {
      const now = Date.now();
      const rows: StatisticsTrade[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from("trades")
          .select("created_at,is_buy,hbar_amount,trader")
          .eq("token", address)
          .gte("created_at", new Date(now - TRADE_WINDOWS[window]).toISOString())
          .lte("created_at", new Date(now).toISOString())
          .order("created_at", { ascending: true }).order("id", { ascending: true })
          .range(offset, offset + pageSize - 1).abortSignal(signal);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) return { rows, now };
      }
    },
    refetchInterval: 15_000,
  });

export const progressPct = (t: TokenRow) =>
  Math.min(100, (Number(t.tokens_sold) / 800_000_000) * 100);
export const priceOf = (t: TokenRow) =>
  Number(t.virtual_tokens) > 0 ? Number(t.virtual_hbar) / Number(t.virtual_tokens) : 0;
export const mcapOf = (t: TokenRow) => priceOf(t) * 1_000_000_000;
export const imageUrl = (hash: string | null) => (hash ? `/api/public/img/${hash}` : null);
export const shortAddr = fallbackAddress;

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
