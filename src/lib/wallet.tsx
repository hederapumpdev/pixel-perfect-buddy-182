import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MIRROR_URL, NETWORK, PUMP_CONTRACT_ID, WALLETCONNECT_PROJECT_ID } from "./hedera-config";

type Connector = import("@hashgraph/hedera-wallet-connect").DAppConnector;

type WalletCtx = {
  accountId: string | null;
  evmAddress: string | null;
  balanceHbar: number | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Calls the launchpad contract. calldata = full ABI-encoded call (selector + args). */
  execute: (opts: { calldata: `0x${string}`; gas: number; payableTinybars?: bigint; contractId?: string }) => Promise<{ transactionId: string; transactionHash: string }>;
  deploy: (opts: { bytecode: string; constructorParams: `0x${string}`; gas: number }) => Promise<string>;
  refresh: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);
const hexToBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, "").match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

async function loadLibs() {
  const [wc, sdk] = await Promise.all([import("@hashgraph/hedera-wallet-connect"), import("@hiero-ledger/sdk")]);
  return { wc, sdk };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const connector = useRef<Connector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [evmAddress, setEvm] = useState<string | null>(null);
  const [balanceHbar, setBal] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tick, setTick] = useState(0);

  const init = useCallback(async () => {
    if (connector.current) return connector.current;
    if (!WALLETCONNECT_PROJECT_ID) throw new Error("Wallet connection isn't configured yet (missing WalletConnect project ID).");
    const { wc, sdk } = await loadLibs();
    const ledger = NETWORK === "mainnet" ? sdk.LedgerId.MAINNET : sdk.LedgerId.TESTNET;
    const chain = NETWORK === "mainnet" ? wc.HederaChainId.Mainnet : wc.HederaChainId.Testnet;
    const c = new wc.DAppConnector(
      { name: "HederaPump", description: "Meme coin launchpad on Hedera", url: window.location.origin, icons: [`${window.location.origin}/favicon.ico`] },
      ledger, WALLETCONNECT_PROJECT_ID, Object.values(wc.HederaJsonRpcMethod), [wc.HederaSessionEvent.ChainChanged, wc.HederaSessionEvent.AccountsChanged], [chain],
    );
    await c.init({ logger: "error" });
    connector.current = c;
    return c;
  }, []);

  const syncAccount = useCallback(() => {
    const s = connector.current?.signers[0];
    setAccountId(s ? s.getAccountId().toString() : null);
  }, []);

  // Restore an existing session on load.
  useEffect(() => {
    if (!WALLETCONNECT_PROJECT_ID) return;
    init().then(syncAccount).catch(() => {});
  }, [init, syncAccount]);

  useEffect(() => {
    if (!accountId) { setEvm(null); setBal(null); return; }
    fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}`).then((r) => r.json()).then((a) => {
      setEvm((a.evm_address as string)?.toLowerCase() ?? null);
      setBal(a.balance ? a.balance.balance / 1e8 : null);
    }).catch(() => {});
  }, [accountId, tick]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const c = await init();
      await c.openModal();
      syncAccount();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect wallet");
    } finally { setConnecting(false); }
  }, [init, syncAccount]);

  const disconnect = useCallback(async () => {
    await connector.current?.disconnectAll().catch(() => {});
    setAccountId(null);
  }, []);

  const signer = () => {
    const s = connector.current?.signers[0];
    if (!s) throw new Error("Connect your wallet first");
    return s;
  };

  const execute: WalletCtx["execute"] = useCallback(async ({ calldata, gas, payableTinybars, contractId }) => {
    const id = contractId ?? PUMP_CONTRACT_ID;
    if (!id) throw new Error("Launchpad contract isn't deployed yet");
    const { sdk } = await loadLibs();
    const s = signer();
    let tx = new sdk.ContractExecuteTransaction().setContractId(sdk.ContractId.fromString(id)).setGas(gas).setFunctionParameters(hexToBytes(calldata));
    if (payableTinybars && payableTinybars > 0n) tx = tx.setPayableAmount(sdk.Hbar.fromTinybars(payableTinybars.toString()));
    await tx.freezeWithSigner(s as never);
    const res = await tx.executeWithSigner(s as never);
    const receipt = await res.getReceiptWithSigner(s as never);
    if (receipt.status.toString() !== "SUCCESS") throw new Error(`Transaction failed: ${receipt.status}`);
    setTick((t) => t + 1);
    const hash = "0x" + [...res.transactionHash].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { transactionId: res.transactionId.toString(), transactionHash: hash.slice(0, 66) };
  }, []);

  const deploy: WalletCtx["deploy"] = useCallback(async ({ bytecode, constructorParams, gas }) => {
    const { sdk } = await loadLibs();
    const s = signer();
    const flow = new sdk.ContractCreateFlow().setBytecode(bytecode).setGas(gas).setConstructorParameters(hexToBytes(constructorParams));
    const res = await flow.executeWithSigner(s as never);
    const receipt = await res.getReceiptWithSigner(s as never);
    if (!receipt.contractId) throw new Error(`Deploy failed: ${receipt.status}`);
    return receipt.contractId.toString();
  }, []);

  return (
    <Ctx.Provider value={{ accountId, evmAddress, balanceHbar, connecting, connect, disconnect, execute, deploy, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
