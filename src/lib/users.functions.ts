import { createServerFn } from "@tanstack/react-start";
import type { UserStats } from "@/lib/user-stats";

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
    return stats as unknown as UserStats;
  });
