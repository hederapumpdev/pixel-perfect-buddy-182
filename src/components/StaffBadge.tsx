import { useQuery } from "@tanstack/react-query";
import { listTeam } from "@/lib/staff.functions";
import { imageUrl } from "@/lib/queries";
import { profileWalletAddress } from "@/lib/profile-wallets";

/** Shows the staff member's HederaPump badge next to their name, only for active team wallets. */
export function StaffBadge({ wallet }: { wallet: string }) {
  const { data = [] } = useQuery({ queryKey: ["team"], queryFn: () => listTeam(), staleTime: 300_000 });
  const w = profileWalletAddress(wallet);
  const s = data.find((m) => profileWalletAddress(m.wallet) === w || (m.account_id && profileWalletAddress(m.account_id) === w));
  if (!s) return null;
  return (
    <span title={`${s.name} · HederaPump Team`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/50 bg-primary/10 py-0.5 pl-0.5 pr-2 align-middle text-[10px] font-semibold text-primary">
      {s.avatar ? <img src={imageUrl(s.avatar)} alt="" width={16} height={16} className="h-4 w-4 rounded-full" /> : null}
      Team
    </span>
  );
}
