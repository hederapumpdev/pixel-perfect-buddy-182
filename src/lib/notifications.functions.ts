import { createServerFn } from "@tanstack/react-start";
import { NOTIF_SESSION_MS, isNotificationKind, notificationsLoginMessage } from "./notifications";

const TOKEN_RE = /^[a-f0-9]{64}$/;
const ACCOUNT_RE = /^0\.0\.\d{1,20}$/;

/** One wallet signature opens this account's own notification feed for a week. */
export const loginNotifications = createServerFn({ method: "POST" })
  .inputValidator((d: { account: string; time: string; nonce: string; signature?: string; evmSignature?: string }) => {
    if (!ACCOUNT_RE.test(d.account)) throw new Error("Connect your wallet first");
    if (typeof d.time !== "string" || d.time.length > 40 || !/^[a-f0-9]{32}$/.test(d.nonce)) throw new Error("Invalid signature");
    if ((d.signature?.length ?? 0) > 300 || (d.evmSignature?.length ?? 0) > 300) throw new Error("Invalid signature");
    return { ...d };
  })
  .handler(async ({ data }) => {
    const { verifyWalletSignature, tokenHash } = await import("./community-auth.server");
    const message = notificationsLoginMessage(data.account, data.time, data.nonce);
    await verifyWalletSignature({ account: data.account, time: data.time, message, signature: data.signature, evmSignature: data.evmSignature });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + NOTIF_SESSION_MS).toISOString();
    const { error } = await supabaseAdmin.from("community_sessions").insert({ author: data.account, token_hash: await tokenHash(token), expires_at: expiresAt });
    if (error) throw new Error("Could not turn on notifications");
    return { token, expiresAt };
  });

/** Resolves a session token to the account that signed it. */
async function accountForToken(token: string) {
  if (!TOKEN_RE.test(token)) throw new Error("Sign in to see notifications");
  const { tokenHash } = await import("./community-auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("community_sessions")
    .select("author")
    .eq("token_hash", await tokenHash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data || !ACCOUNT_RE.test(data.author)) throw new Error("Sign in to see notifications");
  return data.author;
}

export const getNotifications = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const account = await accountForToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").delete().eq("account", account).lt("created_at", new Date(Date.now() - 60 * 86_400_000).toISOString());
    const [list, unread] = await Promise.all([
      supabaseAdmin
        .from("notifications")
        .select("id,kind,actor,token,symbol,created_at,read_at")
        .eq("account", account)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("notifications").select("id", { count: "exact", head: true }).eq("account", account).is("read_at", null),
    ]);
    return { rows: list.data ?? [], unread: unread.count ?? 0 };
  });

/** Marks the whole feed, or only the notices the bell just showed, as read. */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; ids?: string[] }) => ({
    token: String(d.token ?? ""),
    ids: Array.isArray(d.ids) ? d.ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 50) : undefined,
  }))
  .handler(async ({ data }) => {
    const account = await accountForToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("account", account).is("read_at", null);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error("Could not mark notifications read");
    return { ok: true };
  });

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token ?? "") }))
  .handler(async ({ data }) => {
    const account = await accountForToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("notification_prefs").select("kind,enabled").eq("account", account);
    if (error) throw new Error("Could not load your notification settings");
    return rows ?? [];
  });

/** Saving a switch is what opts a wallet out of (or back into) one notice type. */
export const setNotificationPref = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; kind: string; enabled: boolean }) => {
    if (!isNotificationKind(d.kind)) throw new Error("Unknown notification type");
    return { token: String(d.token ?? ""), kind: d.kind, enabled: !!d.enabled };
  })
  .handler(async ({ data }) => {
    const account = await accountForToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notification_prefs")
      .upsert({ account, kind: data.kind, enabled: data.enabled, updated_at: new Date().toISOString() }, { onConflict: "account,kind" });
    if (error) throw new Error("Could not save your notification settings");
    return { ok: true };
  });
