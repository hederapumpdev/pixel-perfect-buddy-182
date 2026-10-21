import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getXPosting = createServerFn({ method: "POST" })
  .inputValidator(z.object({ pin: z.string().max(200) }))
  .handler(async ({ data }) => {
    await (await import("./admin-auth.server")).requireAdmin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [state, posts] = await Promise.all([
      db.from("x_posting_state").select("enabled,pause_reason").eq("id", 1).maybeSingle(),
      db.from("x_daily_posts").select("slot,text,status,tweet_id,error,created_at").order("created_at", { ascending: false }).limit(12),
    ]);
    if (state.error || posts.error) throw new Error("Could not load X posts");
    return { state: state.data, posts: posts.data ?? [] };
  });

export const setXPosting = createServerFn({ method: "POST" })
  .inputValidator(z.object({ pin: z.string().max(200), enabled: z.boolean(), resume: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    await (await import("./admin-auth.server")).requireAdmin(data.pin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (data.resume) {
      const { data: unknown, error } = await db.from("x_daily_posts").select("slot").in("status", ["sending", "unknown"]).limit(1);
      if (error) throw new Error("Could not check post confirmations");
      if (unknown?.length) throw new Error("An unconfirmed post needs review before resuming.");
    }
    const { error } = await db.from("x_posting_state").upsert({ id: 1, enabled: data.enabled, ...(data.resume ? { pause_reason: null } : {}) });
    if (error) throw new Error("Could not save X settings");
    return { ok: true };
  });