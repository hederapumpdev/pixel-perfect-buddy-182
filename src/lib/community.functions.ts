import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CHAT_SESSION_MS, chatAuthor, chatBody } from "./community";

export const listCommunity = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Chat is unavailable.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await db.from("community_messages").select("id,author,body,created_at").is("removed_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load community messages.");
  return (data ?? []).reverse();
});

export const loginCommunity = createServerFn({ method: "POST" }).inputValidator((d: { author: string; time: string; nonce: string; signature?: string; evmSignature?: string }) => {
  if (typeof d.time !== "string" || d.time.length > 40 || !/^[a-f0-9]{32}$/.test(d.nonce) || (d.signature?.length ?? 0) > 300 || (d.evmSignature?.length ?? 0) > 300) throw new Error("Invalid login.");
  return { ...d, author: chatAuthor(d.author) };
}).handler(async ({ data }) => {
  const { verifyChatLogin, tokenHash } = await import("./community-auth.server");
  await verifyChatLogin(data);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + CHAT_SESSION_MS).toISOString();
  const { error } = await supabaseAdmin.from("community_sessions").insert({ author: data.author, token_hash: await tokenHash(token), expires_at: expiresAt });
  if (error) throw new Error("Could not sign in to chat.");
  return { token, author: data.author, expiresAt };
});

export const postCommunity = createServerFn({ method: "POST" }).inputValidator((d: { token: string; body: string }) => {
  if (!/^[a-f0-9]{64}$/.test(d.token)) throw new Error("Sign in to chat first.");
  return { token: d.token, body: chatBody(d.body) };
}).handler(async ({ data }) => {
  const { tokenHash } = await import("./community-auth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: id, error } = await supabaseAdmin.rpc("send_community_message", { p_token_hash: await tokenHash(data.token), p_body: data.body });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Could not send message.");
  return { id };
});

export const getCommunityModeration = createServerFn({ method: "POST" }).inputValidator((d: { pin: string }) => d).handler(async ({ data }) => {
  await (await import("./admin-auth.server")).requireAdmin(data.pin);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [messages, blocks] = await Promise.all([
    supabaseAdmin.from("community_messages").select("id,author,body,created_at").is("removed_at", null).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("community_blocks").select("author,created_at").order("created_at", { ascending: false }),
  ]);
  if (messages.error || blocks.error) throw new Error("Could not load chat moderation.");
  return { messages: messages.data ?? [], blocks: blocks.data ?? [] };
});
export const moderateCommunity = createServerFn({ method: "POST" }).inputValidator((d: { pin: string; action: "remove" | "block" | "unblock"; id?: string; author?: string }) => {
  if (!["remove", "block", "unblock"].includes(d.action)) throw new Error("Invalid action.");
  if (d.action === "remove" && !/^[a-f0-9-]{36}$/.test(d.id ?? "")) throw new Error("Invalid message.");
  return { ...d, author: d.action === "remove" ? undefined : chatAuthor(d.author) };
}).handler(async ({ data }) => {
  const auth = await import("./admin-auth.server");
  const actor = await auth.requireAdmin(data.pin);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = data.action === "remove"
    ? await supabaseAdmin.from("community_messages").update({ removed_at: new Date().toISOString() }).eq("id", data.id ?? "")
    : await supabaseAdmin.rpc("moderate_community_author", { p_author: data.author ?? "", p_block: data.action === "block" });
  if (result.error) throw new Error("Moderation failed.");
  await auth.logAdmin(actor, `Community ${data.action}: ${data.id ?? data.author}`);
  return { ok: true };
});