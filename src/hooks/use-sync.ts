import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncChain } from "@/lib/chain.functions";

/** Pulls fresh on-chain events while the page is open, then refreshes lists. */
export function useChainSync(intervalMs = 12_000) {
  const sync = useServerFn(syncChain);
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    const run = () => sync().then((r) => { if (alive && r.synced) qc.invalidateQueries(); }).catch(() => {});
    run();
    const id = setInterval(run, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [sync, qc, intervalMs]);
  return sync;
}
