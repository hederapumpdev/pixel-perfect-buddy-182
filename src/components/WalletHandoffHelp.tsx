import { createPortal } from "react-dom";
import { toast } from "sonner";

/**
 * Shown when the wallet app was asked to open but never came back — the usual
 * cause on iPhone is Safari's small "Open in HashPack?" prompt going unnoticed.
 */
export function WalletHandoffHelp({
  uri,
  retry,
  onClose,
}: {
  uri: string;
  retry: () => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      toast.success("Connection code copied.");
    } catch {
      toast.error("Copying didn't work — use the button above.");
    }
  };

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[2147483000] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-card-foreground">HashPack should open now</p>
          <button
            type="button"
            aria-label="Dismiss this message"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Safari asks one thing: tap <span className="font-medium text-card-foreground">Open</span> in the small
          prompt at the top-left of your screen. Don't see it? Try again below — or open hederapump.dev on a
          computer and scan the code with HashPack.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Open HashPack again
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-card-foreground hover:bg-muted"
          >
            Copy connection code
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
