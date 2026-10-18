import { createServerFn } from "@tanstack/react-start";

/** Public contest data: past prize winners and the number of free-coin refunds (no other payout details). */
export const getContestPayouts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [prizes, refunds] = await Promise.all([
    supabaseAdmin
      .from("bot_payouts")
      .select("id,token,hbar_amount")
      .eq("kind", "prize")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("bot_payouts").select("id", { count: "exact", head: true }).eq("kind", "refund"),
  ]);
  if (prizes.error || refunds.error) throw new Error("Loading failed");
  return { winners: prizes.data ?? [], refunds: refunds.count ?? 0 };
});
