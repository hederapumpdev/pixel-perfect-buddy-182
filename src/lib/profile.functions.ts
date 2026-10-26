import { createServerFn } from "@tanstack/react-start";
import { profileEditMessage, xHandle } from "./profile-message";

const norm = (w: unknown) => String(w ?? "").toLowerCase().trim();
type Pub = { name: string; bio: string | null; avatar: string | null; x: string | null };

/** Public profile fields for a list of wallets (never returns the edit key). */
export const getProfiles = createServerFn({ method: "POST" })
  .inputValidator((d: { wallets: string[] }) => ({
    wallets: [...new Set((d.wallets ?? []).map(norm))].filter((w) => /^0x[0-9a-f]{40}$/.test(w)).slice(0, 200),
  }))
  .handler(async ({ data }) => {
    if (!data.wallets.length) return {} as Record<string, Pub>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("wallet_profiles")
      .select("wallet, name, bio, avatar, x_handle")
      .in("wallet", data.wallets);
    const out: Record<string, Pub> = {};
    for (const r of rows ?? []) out[r.wallet] = { name: r.name, bio: r.bio, avatar: r.avatar, x: r.x_handle };
    return out;
  });

/** Saving requires a fresh signature from the wallet itself over the exact profile content. */
export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { accountId: string; wallet: string; time: string; nonce: string; signature?: string; evmSignature?: string; name: string; bio?: string; avatar?: string | null; x?: string | null }) => {
      const wallet = norm(d.wallet);
      const name = String(d.name ?? "").trim();
      const bio = String(d.bio ?? "").trim();
      const avatar = d.avatar ? String(d.avatar) : null;
      if (!/^0x[0-9a-f]{40}$/.test(wallet) || !/^0\.0\.\d{1,20}$/.test(d.accountId)) throw new Error("Connect your wallet first");
      if (!/^[A-Za-z0-9_.-]{2,24}$/.test(name)) throw new Error("Name: 2–24 letters, numbers, _ . -");
      if (bio.length > 300) throw new Error("Bio max 300 characters");
      if (avatar && !/^[0-9a-f]{64}$/.test(avatar)) throw new Error("Bad image");
      if (typeof d.time !== "string" || d.time.length > 40 || !/^[a-f0-9]{32}$/.test(d.nonce)) throw new Error("Invalid signature");
      if ((d.signature?.length ?? 0) > 300 || (d.evmSignature?.length ?? 0) > 300) throw new Error("Invalid signature");
      return { ...d, wallet, name, bio, avatar, x: xHandle(d.x) };
    },
  )
  .handler(async ({ data }) => {
    const { verifyWalletSignature } = await import("./community-auth.server");
    const message = profileEditMessage({ ...data, bio: data.bio });
    const acct = await verifyWalletSignature({ account: data.accountId, time: data.time, message, signature: data.signature, evmSignature: data.evmSignature });
    const longZero = "0x" + BigInt(data.accountId.split(".")[2]!).toString(16).padStart(40, "0");
    if (data.wallet !== longZero && data.wallet !== acct.evm) throw new Error("This wallet does not belong to the signing account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("wallet_profiles").select("updated_at").eq("wallet", data.wallet).maybeSingle();
    if (cur && Date.now() - Date.parse(cur.updated_at) < 10_000) throw new Error("Please wait a few seconds before saving again");
    const { error } = await supabaseAdmin.from("wallet_profiles").upsert(
      { wallet: data.wallet, name: data.name, bio: data.bio || null, avatar: data.avatar, x_handle: data.x, updated_at: new Date().toISOString() },
      { onConflict: "wallet" },
    );
    if (error) throw new Error(error.code === "23505" ? "That name is taken" : "Saving failed");
    return { ok: true };
  });
