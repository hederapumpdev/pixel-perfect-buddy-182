import { createServerFn } from "@tanstack/react-start";

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const norm = (w: unknown) => String(w ?? "").toLowerCase().trim();

/** Public profile fields for a list of wallets (never returns the edit key). */
export const getProfiles = createServerFn({ method: "POST" })
  .inputValidator((d: { wallets: string[] }) => ({
    wallets: [...new Set((d.wallets ?? []).map(norm))].filter((w) => /^0x[0-9a-f]{40}$/.test(w)).slice(0, 200),
  }))
  .handler(async ({ data }) => {
    if (!data.wallets.length) return {} as Record<string, { name: string; bio: string | null; avatar: string | null }>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("wallet_profiles")
      .select("wallet, name, bio, avatar")
      .in("wallet", data.wallets);
    const out: Record<string, { name: string; bio: string | null; avatar: string | null }> = {};
    for (const r of rows ?? []) out[r.wallet] = { name: r.name, bio: r.bio, avatar: r.avatar };
    return out;
  });

/**
 * First save claims the profile and stores a hash of the browser's edit key;
 * later edits must present the same key.
 */
export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet: string; key: string; name: string; bio?: string; avatar?: string | null }) => {
    const wallet = norm(d.wallet);
    const name = String(d.name ?? "").trim();
    const bio = String(d.bio ?? "").trim();
    const avatar = d.avatar ? String(d.avatar) : null;
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) throw new Error("Connect your wallet first");
    if (typeof d.key !== "string" || d.key.length < 32) throw new Error("Missing edit key");
    if (!/^[A-Za-z0-9_.-]{2,24}$/.test(name)) throw new Error("Name: 2–24 letters, numbers, _ . -");
    if (bio.length > 300) throw new Error("Bio max 300 characters");
    if (avatar && !/^[0-9a-f]{64}$/.test(avatar)) throw new Error("Bad image");
    return { wallet, key: d.key, name, bio: bio || null, avatar };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keyHash = await sha(data.key);
    const { data: cur } = await supabaseAdmin
      .from("wallet_profiles")
      .select("edit_key_hash")
      .eq("wallet", data.wallet)
      .maybeSingle();
    if (cur && cur.edit_key_hash !== keyHash)
      throw new Error("This profile was set up on another device. Ask support to reset it.");
    const row = {
      wallet: data.wallet,
      name: data.name,
      bio: data.bio,
      avatar: data.avatar,
      edit_key_hash: keyHash,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("wallet_profiles").upsert(row, { onConflict: "wallet" });
    if (error) throw new Error(error.code === "23505" ? "That name is taken" : "Saving failed");
    return { ok: true };
  });
