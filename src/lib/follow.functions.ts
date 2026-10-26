import { createServerFn } from "@tanstack/react-start";
import { followMessage, isAccountId } from "./follow-message";

/** Public follower/following lists for one account (newest first, capped). */
export const getFollows = createServerFn({ method: "POST" })
  .inputValidator((d: { account: string }) => {
    if (!isAccountId(d.account)) throw new Error("Bad account");
    return { account: d.account };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [fr, fg, c1, c2] = await Promise.all([
      supabaseAdmin.from("wallet_follows").select("follower").eq("followee", data.account).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("wallet_follows").select("followee").eq("follower", data.account).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("wallet_follows").select("*", { count: "exact", head: true }).eq("followee", data.account),
      supabaseAdmin.from("wallet_follows").select("*", { count: "exact", head: true }).eq("follower", data.account),
    ]);
    return {
      followers: (fr.data ?? []).map((r) => r.follower),
      following: (fg.data ?? []).map((r) => r.followee),
      followerCount: c1.count ?? 0,
      followingCount: c2.count ?? 0,
    };
  });

/** Follow/unfollow; proven by a fresh wallet signature from the follower. */
export const setFollow = createServerFn({ method: "POST" })
  .inputValidator((d: { follower: string; followee: string; follow: boolean; time: string; nonce: string; signature?: string; evmSignature?: string }) => {
    if (!isAccountId(d.follower) || !isAccountId(d.followee)) throw new Error("Connect your wallet first");
    if (d.follower === d.followee) throw new Error("You can't follow yourself");
    if (typeof d.time !== "string" || d.time.length > 40 || !/^[a-f0-9]{32}$/.test(d.nonce)) throw new Error("Invalid signature");
    if ((d.signature?.length ?? 0) > 300 || (d.evmSignature?.length ?? 0) > 300) throw new Error("Invalid signature");
    return { ...d, follow: !!d.follow };
  })
  .handler(async ({ data }) => {
    const { verifyWalletSignature } = await import("./community-auth.server");
    await verifyWalletSignature({ account: data.follower, time: data.time, message: followMessage(data), signature: data.signature, evmSignature: data.evmSignature });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.follow) {
      const { count } = await supabaseAdmin.from("wallet_follows").select("*", { count: "exact", head: true }).eq("follower", data.follower);
      if ((count ?? 0) >= 1000) throw new Error("You follow the maximum of 1000 wallets");
      const { error } = await supabaseAdmin.from("wallet_follows").upsert({ follower: data.follower, followee: data.followee }, { onConflict: "follower,followee", ignoreDuplicates: true });
      if (error) throw new Error("Following failed");
    } else {
      const { error } = await supabaseAdmin.from("wallet_follows").delete().eq("follower", data.follower).eq("followee", data.followee);
      if (error) throw new Error("Unfollowing failed");
    }
    return { ok: true };
  });
