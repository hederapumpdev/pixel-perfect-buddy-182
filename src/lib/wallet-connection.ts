// Bound setup separately from wallet approval: opening the picker must be fast,
// while users need time to switch to their wallet and approve the connection.
export function connectionDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

type ModalConnector = {
  openModal: () => Promise<unknown>;
  walletConnectModal: {
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
  try {
    await new Promise<void>((resolve, reject) => {
      openingTimer = setTimeout(() => reject(new Error(
        "The wallet window couldn't open. Check your connection and tap WalletConnect again. If you're inside HashPack or a chat app, try Safari or Chrome.",
      )), 15_000);
      approvalTimer = setTimeout(() => reject(new Error(
        "Wallet connection timed out. Tap WalletConnect to try again.",
      )), 180_000);
      unsubscribe = connector.walletConnectModal.subscribeModal((state) => {
        if (state.open) {
          opened = true;
          clearTimeout(openingTimer);
        } else if (opened) {
          reject(new WalletConnectionCancelled("Wallet connection cancelled"));
        }
      });
      connector.openModal().then(() => resolve(), reject);
    });
  } finally {
    clearTimeout(openingTimer);
    clearTimeout(approvalTimer);
    unsubscribe();
    connector.walletConnectModal.closeModal();
  }
}