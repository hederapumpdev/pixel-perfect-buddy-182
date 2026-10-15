import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { encodeAbiParameters } from "viem";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { NETWORK, PUMP_CONTRACT_ID, HASHSCAN_URL } from "@/lib/hedera-config";
import { toTinybars } from "@/lib/curve";
import artifact from "@/lib/contract-artifact.json";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Launchpad setup — HederaPump" },
      { name: "description", content: "Deploy and configure the HederaPump launchpad contract." },
      { property: "og:title", content: "Launchpad setup — HederaPump" },
      { property: "og:description", content: "Deploy the HederaPump contract." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const w = useWallet();
  const [virtualHbar, setV] = useState("20000");
  const [creationFee, setFee] = useState("10");
  const [busy, setBusy] = useState(false);
  const [deployed, setDeployed] = useState<string | null>(null);

  async function deploy() {
    if (!w.accountId || !w.evmAddress) return w.connect();
    setBusy(true);
    try {
      const params = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
        [w.evmAddress as `0x${string}`, toTinybars(virtualHbar), toTinybars(creationFee)],
      );
      const id = await w.deploy({ bytecode: artifact.bytecode, constructorParams: params, gas: 4_000_000 });
      setDeployed(id);
      toast.success(`Deployed ${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deploy failed");
    } finally { setBusy(false); }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Launchpad setup</h1>
        {PUMP_CONTRACT_ID ? (
          <p className="rounded-md border border-border bg-card p-4 text-sm">
            Live contract: <a className="font-mono text-accent" href={`${HASHSCAN_URL}/contract/${PUMP_CONTRACT_ID}`} target="_blank" rel="noreferrer">{PUMP_CONTRACT_ID}</a>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Deploys the bonding-curve contract to Hedera {NETWORK}. The connected wallet becomes the owner and fee recipient.
              Your wallet will ask you to approve a few transactions (upload + create). Expect a few HBAR in network fees.
            </p>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Starting virtual liquidity (HBAR)</span>
              <Input value={virtualHbar} onChange={(e) => setV(e.target.value)} className="font-mono" /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Creation fee (HBAR)</span>
              <Input value={creationFee} onChange={(e) => setFee(e.target.value)} className="font-mono" /></label>
            <Button className="w-full" size="lg" disabled={busy} onClick={deploy}>{busy ? "Approve in wallet…" : w.accountId ? "Deploy contract" : "Connect wallet"}</Button>
            {deployed && <p className="rounded-md border border-up/40 bg-up/10 p-4 text-sm">Deployed: <b className="font-mono">{deployed}</b> — send this ID in the chat to switch the launchpad on.</p>}
          </>
        )}
      </div>
    </Shell>
  );
}
