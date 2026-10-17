import { BadgeCheck } from "lucide-react";
import { isOfficial } from "@/lib/promotions";

export function OfficialBadge({ creator }: { creator: string }) {
  if (!isOfficial(creator)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <BadgeCheck className="h-3 w-3" /> Official
    </span>
  );
}
