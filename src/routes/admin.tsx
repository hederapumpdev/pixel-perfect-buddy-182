import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { encodeAbiParameters } from "viem";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet";
import { NETWORK, PUMP_CONTRACT_V2_ID, HASHSCAN_URL, FEE_WALLET_EVM } from "@/lib/hedera-config";
import { toTinybars } from "@/lib/curve";
import artifact from "@/lib/contract-artifact-hts.json";

// SaucerSwap V1 mainnet (docs.saucerswap.finance/developers/contracts)
const SAUCER_ROUTER_EVM = "0x00000000000000000000000000000000002e7a5d"; // 0.0.3045981
const SAUCER_FACTORY_EVM = "0x0000000000000000000000000000000000103680"; // 0.0.1062784

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Launchpad setup — HederaPump" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [lastError, setLastError] = useState<string | null>(null);
  const p = w.deployProgress;

  // Show where the upload stands as soon as HashPack is connected.
  useEffect(() => {
    if (w.accountId && w.mode === "hashpack" && !PUMP_CONTRACT_V2_ID) {
      w.checkDeploy(artifact.bytecode).then((s) => s.contractId && setDeployed(s.contractId)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.accountId, w.mode]);

  async function deploy() {
    if (!w.accountId || !w.evmAddress) return w.connect();
    setBusy(true);
    setLastError(null);
    try {
      const params = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
        [FEE_WALLET_EVM as `0x${string}`, toTinybars(virtualHbar), toTinybars(creationFee)],
      );
      const r = await w.deploy({
        bytecode: artifact.bytecode,
        constructorParams: params,
        gas: 4_000_000,
      });
      if (r.contractId) {
        setDeployed(r.contractId);
        toast.success(`Deployed ${r.contractId}`);
      } else {
        toast.success(`Approval ${r.done} of ${r.approvals} done — tap the button for the next one.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const next = p ? Math.min(p.done + 1, p.approvals) : 1;
  const total = p?.approvals ?? 6;

  return (
    <Shell>
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Launchpad setup</h1>
        {PUMP_CONTRACT_ID ? (
          <p className="rounded-md border border-border bg-card p-4 text-sm">
            Live contract:{" "}
            <a
              className="font-mono text-accent"
              href={`${HASHSCAN_URL}/contract/${PUMP_CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
            >
              {PUMP_CONTRACT_ID}
            </a>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Deploys the bonding-curve contract to Hedera {NETWORK}. The connected wallet becomes
              the owner; fees go to 0.0.10923241. The contract is uploaded in 5 parts, then created:
              <b> 6 approvals</b>, one per tap of the button below. Expect roughly 20–25 HBAR in
              network fees. Progress is read from Hedera itself, so you can stop and continue later.
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Starting virtual liquidity (HBAR)</span>
              <Input
                value={virtualHbar}
                onChange={(e) => setV(e.target.value)}
                className="font-mono"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Creation fee (HBAR)</span>
              <Input
                value={creationFee}
                onChange={(e) => setFee(e.target.value)}
                className="font-mono"
              />
            </label>
            {p && !deployed && (
              <div className="space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(p.done / p.approvals) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{p.done} of {p.approvals} approvals done</p>
              </div>
            )}
            {!deployed && (
              <Button className="w-full" size="lg" disabled={busy} onClick={deploy}>
                {!w.accountId
                  ? "Connect wallet"
                  : busy
                    ? `Approval ${next} of ${total} — open HashPack and approve…`
                    : p && p.done > 0
                      ? `Continue: approval ${next} of ${total}`
                      : `Start deploy: approval 1 of ${total}`}
              </Button>
            )}
            {busy && (
              <p className="rounded-md border border-border bg-card p-3 text-center text-xs text-muted-foreground">
                Switch to the <b>HashPack</b> app now — the request is waiting there. Approve it, then
                come back to this page. If nothing shows up in HashPack after a minute, come back and
                tap the button again; nothing is paid twice.
              </p>
            )}
            {!busy && lastError && (
              <p className="text-center text-xs text-destructive">{lastError}</p>
            )}
            {deployed && (
              <p className="rounded-md border border-up/40 bg-up/10 p-4 text-sm">
                Deployed: <b className="font-mono">{deployed}</b> — send this ID in the chat to
                switch the launchpad on.
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
