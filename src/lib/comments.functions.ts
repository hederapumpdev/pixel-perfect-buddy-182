import { createServerFn } from "@tanstack/react-start";

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token).toLowerCase().slice(0, 80) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("coin_comments")
      .select("id, author, body, created_at")
      .eq("token", data.token)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });

export const postComment = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; author: string; body: string }) => {
    const token = String(d.token ?? "").toLowerCase().trim();
    const author = String(d.author ?? "").trim();
    const body = String(d.body ?? "").trim();
    if (!/^0x[0-9a-f]{40}$/.test(token)) throw new Error("Unknown coin");
    if (author.length < 3 || author.length > 100) throw new Error("Connect your wallet to comment");
    if (body.length < 1 || body.length > 500) throw new Error("Comment must be 1–500 characters");
    return { token, author, body };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 20_000).toISOString();
    const { count } = await supabaseAdmin
      .from("coin_comments")
      .select("id", { count: "exact", head: true })
      .eq("author", data.author)
      .gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("Slow down — wait a few seconds");
    const { error } = await supabaseAdmin.from("coin_comments").insert(data);
    if (error) throw new Error("Posting failed, please try again");
    const { notifyCoinCreatorOfComment, notifyFollowersOfComment } = await import("./notifications.server");
    await notifyCoinCreatorOfComment(supabaseAdmin, data.token, data.author);
    await notifyFollowersOfComment(supabaseAdmin, data.token, data.author).catch(() => {});
    return { ok: true };
  });
