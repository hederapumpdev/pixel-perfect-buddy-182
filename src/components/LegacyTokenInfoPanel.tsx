import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HASHSCAN_URL } from "@/lib/hedera-config";
import { isLegacyHtsToken, legacyInfoRequest, legacyMetadata, legacyTokenId, type LegacyTokenInfo } from "@/lib/legacy-token-info";

export function LegacyTokenInfoPanel({ tokens, loading, error }: { tokens: LegacyTokenInfo[]; loading: boolean; error: boolean }) {
  const legacy = useMemo(() => tokens.filter(isLegacyHtsToken), [tokens]);
  const [address, setAddress] = useState("");
  const token = legacy.find((t) => t.address === address) ?? legacy[0];
  const request = token ? legacyInfoRequest(token) : "";
  const id = token ? legacyTokenId(token.address) : null;

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(request);
      toast.success("Token-info request copied");
    } catch {
      toast.error("Copy failed. Select and copy the request below.");
    }
  }

  function download() {
    if (!token) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(legacyMetadata(token), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `saucerswap-${id ?? token.address}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">SaucerSwap · older tokens</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pre-v4 tokens have no editable on-chain metadata. Manual display changes require SaucerSwap’s support; preparing a request does not update or list the token.</p>
      </div>
      {error ? <p className="text-sm text-destructive">Could not load tokens. Refresh to try again.</p> : loading ? <p className="text-sm text-muted-foreground">Loading tokens…</p> : !token ? <p className="text-sm text-muted-foreground">No pre-v4 HTS tokens found.</p> : (
        <>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Older HTS token</span>
            <select aria-label="Older HTS token" className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={token.address} onChange={(e) => setAddress(e.target.value)}>
              {legacy.map((t) => <option key={t.address} value={t.address}>{t.name} (${t.symbol}) · {legacyTokenId(t.address) ?? t.address}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            {token.image_url && <img src={`/api/public/img/${token.image_url}`} alt={token.name} className="size-12 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0">
              <p className="break-words font-semibold">{token.name} <span className="text-muted-foreground">${token.symbol}</span></p>
              <a href={`${HASHSCAN_URL}/token/${id ?? token.address}`} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-accent">{id ?? token.address}</a>
              <p className="text-xs text-muted-foreground">{token.graduated ? "Graduated" : "Not graduated · no SaucerSwap pool yet"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyRequest}><Copy />Copy request</Button>
            <Button variant="outline" onClick={download}><Download />Token-info JSON</Button>
          </div>
          <Textarea aria-label="SaucerSwap token-info request" readOnly value={request} className="min-h-72 font-mono text-xs" />
        </>
      )}
    </section>
  );
}