import { createServerFn } from "@tanstack/react-start";
import { walletPnl, type UserStats, type PnlTrade, type PnlCoin } from "@/lib/user-stats";
import { NETWORK } from "@/lib/hedera-config";

/** How many people use the launchpad (PIN-protected, for the admin page). */
export const getUserStats = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => {
    if (typeof d.pin !== "string" || d.pin.length > 200) throw new Error("Invalid PIN");
    return d;
  })
  .handler(async ({ data }) => {
    const pin = process.env["ADMIN_PIN"];
    if (!pin || data.pin.trim() !== pin.trim()) throw new Error("Wrong PIN");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stats, error } = await supabaseAdmin.rpc("admin_user_stats");
    if (error || !stats) throw new Error("Loading failed");
    const counts = stats as unknown as UserStats;
    const wallets = counts.recent.slice(0, 12).map((r) => r.wallet);
    if (!wallets.length) return counts;
    const trades: PnlTrade[] = [];
    const snapshot = new Date().toISOString();
    for (let offset = 0; ; offset += 500) {
      const page = await supabaseAdmin.from("trades")
        .select("trader,token,is_buy,hbar_amount,token_amount,fee")
        .eq("network", NETWORK).in("trader", wallets).lte("created_at", snapshot)
        .order("created_at").order("id").range(offset, offset + 499);
      if (page.error) throw new Error("Loading trading results failed");
      trades.push(...(page.data ?? []));
      if (!page.data || page.data.length < 500) break;
    }
    const tokens = [...new Set(trades.map((t) => t.token))];
    const coins: PnlCoin[] = [];
    for (let offset = 0; offset < tokens.length; offset += 100) {
      const page = await supabaseAdmin.from("tokens")
        .select("address,virtual_hbar,virtual_tokens,graduated").eq("network", NETWORK)
        .in("address", tokens.slice(offset, offset + 100));
      if (page.error) throw new Error("Loading coin values failed");
      coins.push(...(page.data ?? []));
    }
    const pnl = walletPnl(wallets, trades, coins);
    return { ...counts, recent: counts.recent.map((r) => ({ ...r, pnl_hbar: pnl.get(r.wallet) ?? null })) };
  });
