import { Copy, Download, ExternalLink, Image } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TokenImage } from "@/components/TokenCard";
import type { TokenRow } from "@/lib/queries";
import { logoRequest, logoSubmission, TOKEN_ICON_FORM } from "@/lib/token-logo-submission";

export function TokenLogoSubmission({ token }: { token: TokenRow }) {
  const origin = "https://hederapump.dev";
  const info = logoSubmission(token, origin);
  const request = logoRequest(token, origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      toast.success("Token details copied");
    } catch {
      toast.error("Could not copy. Select the token details below.");
    }
  }

  function downloadDetails() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(info, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `token-logo-${info.tokenId ?? token.address}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadLogo() {
    if (!token.image_url) return;
    try {
      const response = await fetch(`/api/public/img/${token.image_url}`);
      if (!response.ok) throw new Error("Logo unavailable");
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `token-logo-${info.tokenId ?? token.address}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not download the logo. Please try again.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Image className="size-4" />Submit token logo</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Token logo · HashPack</DialogTitle>
          <DialogDescription>Manual submission · HashPack reviews requests. Automatic submission and approval are not available.</DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 items-center gap-3">
          <TokenImage t={token} className="size-12" />
          <div className="min-w-0"><p className="break-words font-semibold">{token.name} · ${token.symbol}</p><p className="break-all font-mono text-xs text-muted-foreground">{info.tokenId ?? token.address}</p></div>
        </div>
        <Textarea aria-label="Token logo submission details" value={request} readOnly className="min-h-56 font-mono text-xs" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy}><Copy className="size-4" />Copy details</Button>
          <Button variant="outline" onClick={downloadDetails}><Download className="size-4" />Details JSON</Button>
          <Button variant="outline" onClick={downloadLogo} disabled={!token.image_url}><Download className="size-4" />Download logo</Button>
          <Button variant="outline" asChild><a href={TOKEN_ICON_FORM} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />HashPack form</a></Button>
          <Button variant="outline" asChild><a href="https://davincigraph.io/#pics_home" target="_blank" rel="noreferrer"><ExternalLink className="size-4" />DaVinci Pics</a></Button>
        </div>
        <p className="text-xs text-muted-foreground">DaVinci may require the treasury or token-creation account. Support for contract-created tokens must be confirmed by DaVinci. This does not change token metadata or confirm a listing.</p>
      </DialogContent>
    </Dialog>
  );
}