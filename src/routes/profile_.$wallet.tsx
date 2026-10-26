import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { TokenCard } from "@/components/TokenCard";
import { WalletHoldings } from "@/components/WalletHoldings";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Cover, XLink, useProfiles } from "@/components/ProfileEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResultChart } from "@/components/ResultChart";
import { listCommentsByAuthor } from "@/lib/comments.functions";
import { FollowPanel } from "@/components/FollowPanel";
import { supabase } from "@/integrations/supabase/client";
import { HASHSCAN_URL, MIRROR_URL, NETWORK } from "@/lib/hedera-config";
import { fmtAge, fmtHbar } from "@/lib/queries";

export const Route = createFileRoute("/profile_/$wallet")({
  staticData: { sitemap: false },
  head: ({ params }) => ({
    meta: [
      { title: `Trader ${params.wallet} — HederaPump` },
      { name: "description", content: `Coins, holdings and trades of ${params.wallet} on HederaPump.` },
      { property: "og:title", content: `Trader ${params.wallet} — HederaPump` },
      { property: "og:description", content: "Public HederaPump profile: launched coins, holdings and recent trades." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProfile,
});

const longZero = (id: string) => "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

function PublicProfile() {
  const { wallet } = Route.useParams();
  const input = wallet.trim().toLowerCase();
  const valid = /^\d+\.\d+\.\d+$/.test(input) || /^0x[0-9a-f]{40}$/.test(input);

  const acct = useQuery({
    queryKey: ["public-account", input],
    enabled: valid,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${input}?transactions=false`);
      if (!r.ok) return null;
      const j = await r.json();
      return { id: j.account as string, evm: (j.evm_address as string | null)?.toLowerCase() ?? null };
    },
  });
  const id = acct.data?.id ?? null;
  const addrs = id ? [...new Set([longZero(id), acct.data?.evm].filter(Boolean) as string[])] : [];
  const profile = useProfiles(id ? [id] : [])[id ?? ""];

  const coins = useQuery({
    queryKey: ["public-coins", addrs],
    enabled: addrs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("network", NETWORK)
        .eq("hidden", false)
        .in("creator", addrs)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const trades = useQuery({
    queryKey: ["public-trades", addrs],
    enabled: addrs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("id, token, is_buy, hbar_amount, created_at, tx_hash")
        .in("trader", addrs)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const symbols = useQuery({
    queryKey: ["public-trade-symbols", trades.data?.map((t) => t.token)],
    enabled: !!trades.data?.length,
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("address, symbol").in("address", [...new Set(trades.data!.map((t) => t.token))]);
      return new Map((data ?? []).map((t) => [t.address, t.symbol]));
    },
  });

  const getComments = useServerFn(listCommentsByAuthor);
  const comments = useQuery({
    queryKey: ["public-comments", id, addrs],
    enabled: !!id,
    queryFn: () => getComments({ data: { authors: [id!, ...addrs] } }),
  });
  const commentSymbols = useQuery({
    queryKey: ["public-comment-symbols", comments.data?.map((c) => c.token)],
    enabled: !!comments.data?.length,
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("address, symbol").in("address", [...new Set(comments.data!.map((c) => c.token))]);
      return new Map((data ?? []).map((t) => [t.address, t.symbol]));
    },
  });
  const [tab, setTab] = useState("open");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${profile?.name ?? id} on HederaPump`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      /* closed share sheet */
    }
  }

  if (!valid || acct.data === null)
    return (
      <Shell>
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">Wallet not found</h1>
          <p className="mt-2 text-muted-foreground">Use a Hedera account ID like 0.0.1234.</p>
          <Link to="/leaderboard" className="mt-4 inline-block text-primary underline">Browse the leaderboard</Link>
        </div>
      </Shell>
    );
  if (!id) return <Shell><p className="py-16 text-center text-muted-foreground">Loading profile…</p></Shell>;

  return (
    <Shell>
      <Cover hash={profile?.banner} />
      <div className="-mt-12 flex items-end justify-between gap-3 px-1">
        <div className="rounded-full border-4 border-background">
          <Avatar hash={profile?.avatar} size={88} />
        </div>
        <Button variant="outline" size="sm" onClick={share} aria-label="Share profile">
          <Share2 className="mr-1 h-4 w-4" /> Share
        </Button>
      </div>
      <div className="mt-3 min-w-0">
        <h1 className="truncate text-3xl font-bold">{profile?.name ?? id}</h1>
        <a className="font-mono text-sm text-muted-foreground" href={`${HASHSCAN_URL}/account/${id}`} target="_blank" rel="noreferrer">{id}</a>
      </div>
      {profile?.bio && <p className="mt-3 max-w-2xl text-muted-foreground">{profile.bio}</p>}
      {profile?.x && <XLink handle={profile.x} />}
      <FollowPanel account={id} />

      <ResultChart trades={trades.data ?? []} />

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="coins">Coins ({coins.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <WalletHoldings accountId={id} addrs={addrs} balanceHbar={null} own={false} />
          <p className="mt-2 text-xs text-muted-foreground">Portfolio counts HederaPump coins only. Values are estimates at current prices.</p>
        </TabsContent>

        <TabsContent value="coins">
          {coins.data?.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coins.data.map((c) => <TokenCard key={c.address} t={c} />)}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No coins launched yet.</p>
          )}
        </TabsContent>

        <TabsContent value="comments">
          {comments.data?.length ? (
            <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {comments.data.map((c) => (
                <div key={c.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/token/$id" params={{ id: c.token }} className="font-medium hover:underline">
                      {commentSymbols.data?.get(c.token) ?? "coin"}
                    </Link>
                    <span className="text-xs text-muted-foreground">{fmtAge(c.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {trades.data?.length ? (
            <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {trades.data.slice(0, 50).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className={t.is_buy ? "text-primary" : "text-destructive"}>{t.is_buy ? "Buy" : "Sell"}</span>
                  <Link to="/token/$id" params={{ id: t.token }} className="font-medium hover:underline">
                    {symbols.data?.get(t.token) ?? "coin"}
                  </Link>
                  <span className="font-mono">{fmtHbar(Number(t.hbar_amount))}</span>
                  <span className="text-muted-foreground">{fmtAge(t.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No trades yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </Shell>
  );
}
