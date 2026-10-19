// Bound setup separately from wallet approval: opening the picker must be fast,
// while users need time to switch to their wallet and approve the connection.
export function connectionDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

type ModalConnector = {
  connect: (onUri: (uri: string) => void) => Promise<unknown>;
  walletConnectModal: {
    openModal: (options: { uri: string }) => Promise<void>;
    subscribeModal: (listener: (state: { open: boolean }) => void) => () => void;
    closeModal: () => void;
  };
};

export class WalletConnectionCancelled extends Error {}

export async function openWalletPicker(connector: ModalConnector): Promise<void> {
  let opened = false;
  let unsubscribe = () => {};
  let openingTimer: ReturnType<typeof setTimeout> | undefined;
  let approvalTimer: ReturnType<typeof setTimeout> | undefined;
  let dismissalTimer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  try {
    await new Promise<void>((resolve, reject) => {
      openingTimer = setTimeout(() => reject(new Error(
        "WalletConnect pairing couldn't reach the connection service. Check your connection and try again.",
      )), 45_000);
      unsubscribe = connector.walletConnectModal.subscribeModal((state) => {
        if (state.open) {
          opened = true;
          clearTimeout(openingTimer);
          clearTimeout(dismissalTimer);
          if (!approvalTimer) approvalTimer = setTimeout(() => reject(new Error(
            "Wallet connection timed out. Tap WalletConnect to try again.",
          )), 180_000);
        } else if (opened) {
          // The SDK closes in finally BEFORE its approval promise settles.
          // Only an unresolved close is a user dismissal; otherwise a successful
          // approval looks cancelled and the provider never reads the signer.
          clearTimeout(dismissalTimer);
          dismissalTimer = setTimeout(() => {
            reject(new WalletConnectionCancelled("Wallet connection cancelled"));
          }, 0);
        }
      });
      // SDK openModal waits for relay pairing before showing UI; time phases separately.
      connector.connect((uri) => {
        if (!active) return;
        clearTimeout(openingTimer);
        openingTimer = setTimeout(() => reject(new Error(
          "The wallet window couldn't open. Check your connection and tap WalletConnect again. If you're inside HashPack or a chat app, try Safari or Chrome.",
        )), 30_000);
        connector.walletConnectModal.openModal({ uri }).catch(reject);
      }).then(() => resolve(), reject);
    });
  } finally {
    active = false;
    clearTimeout(openingTimer);
    clearTimeout(approvalTimer);
    clearTimeout(dismissalTimer);
    unsubscribe();
    connector.walletConnectModal.closeModal();
  }
}