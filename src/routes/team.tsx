import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Shell } from "@/components/Shell";
import { Avatar } from "@/components/ProfileEditor";
import { listTeam } from "@/lib/staff.functions";
import { HASHSCAN_URL } from "@/lib/hedera-config";

const teamQuery = queryOptions({ queryKey: ["team"], queryFn: () => listTeam() });

export const Route = createFileRoute("/team")({
  staticData: { sitemap: true },
  loader: ({ context }) => context.queryClient.ensureQueryData(teamQuery),
  head: () => ({
    meta: [
      { title: "Team — HederaPump" },
      { name: "description", content: "Meet the people behind HederaPump, the meme coin launchpad on Hedera." },
      { property: "og:title", content: "Team — HederaPump" },
      { property: "og:description", content: "Meet the people behind HederaPump." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Team,
});

function Team() {
  const { data } = useSuspenseQuery(teamQuery);
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="mt-2 text-muted-foreground">The people building and growing HederaPump.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {data.map((s) => (
            <div key={s.wallet} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
              <Avatar hash={s.avatar} size={64} />
              <div className="min-w-0">
                <p className="text-lg font-semibold">{s.name}</p>
                {s.account_id && (
                  <a className="font-mono text-xs text-muted-foreground hover:text-primary" href={`${HASHSCAN_URL}/account/${s.account_id}`} target="_blank" rel="noreferrer">{s.account_id}</a>
                )}
                <p className="text-xs text-muted-foreground">Since {new Date(s.joined_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="text-muted-foreground">Team coming soon.</p>}
        </div>
      </div>
    </Shell>
  );
}
