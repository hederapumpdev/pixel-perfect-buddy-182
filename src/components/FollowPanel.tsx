import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, useProfiles } from "@/components/ProfileEditor";
import { getFollows, setFollow } from "@/lib/follow.functions";
import { followMessage } from "@/lib/follow-message";
import { useWallet } from "@/lib/wallet";

/** Followers/following counts + lists; shows a Follow button when viewing someone else. */
export function FollowPanel({ account }: { account: string }) {
  const w = useWallet();
  const qc = useQueryClient();
  const get = useServerFn(getFollows);
  const set = useServerFn(setFollow);
  const [tab, setTab] = useState<"followers" | "following" | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["follows", account], queryFn: () => get({ data: { account } }), staleTime: 15_000 });
  const me = w.accountId;
  const isFollowing = !!me && !!q.data?.followers.includes(me);
  const list = tab === "followers" ? q.data?.followers ?? [] : tab === "following" ? q.data?.following ?? [] : [];
  const profiles = useProfiles(list);

  async function toggle() {
    if (!me) {
      toast.error("Connect your wallet to follow");
      return;
    }
    setBusy(true);
    try {
      const time = new Date().toISOString();
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      const msg = { follower: me, followee: account, follow: !isFollowing, time, nonce };
      const sig = await w.signText(followMessage(msg));
      await set({ data: { ...msg, ...sig } });
      await qc.invalidateQueries({ queryKey: ["follows"] });
      toast.success(msg.follow ? "Following" : "Unfollowed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" onClick={() => setTab(tab === "followers" ? null : "followers")} className="hover:underline">
          <span className="font-semibold">{q.data?.followerCount ?? 0}</span> <span className="text-muted-foreground">Followers</span>
        </button>
        <button type="button" onClick={() => setTab(tab === "following" ? null : "following")} className="hover:underline">
          <span className="font-semibold">{q.data?.followingCount ?? 0}</span> <span className="text-muted-foreground">Following</span>
        </button>
        {me !== account && (
          <Button size="sm" variant={isFollowing ? "outline" : "default"} disabled={busy || q.isLoading} onClick={toggle}>
            {isFollowing ? "Unfollow" : "Follow"}
          </Button>
        )}
      </div>
      {tab && (
        <div className="mt-3 max-w-md rounded-lg border border-border bg-card p-2">
          {list.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">{tab === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
          ) : (
            list.map((id) => (
              <Link key={id} to="/profile/$wallet" params={{ wallet: id }} className="flex items-center gap-2 rounded p-2 hover:bg-muted">
                <Avatar hash={profiles[id]?.avatar} size={28} />
                <span className="truncate font-medium">{profiles[id]?.name ?? id}</span>
                {profiles[id] && <span className="ml-auto font-mono text-xs text-muted-foreground">{id}</span>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
