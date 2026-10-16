import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { deployStep, deployProgressOf, findDeployOnMirror, type DeployProgress, type DeployState } from "./hashpack-deploy";
import {
  MIRROR_URL,
  NETWORK,
  PUMP_CONTRACT_ID,
  WALLETCONNECT_PROJECT_ID,
  WEB3AUTH_CLIENT_ID,
  EVM_CHAIN_ID,
  EVM_RPC_URL,
  HASHSCAN_URL,
} from "./hedera-config";

type Connector = import("@hashgraph/hedera-wallet-connect").DAppConnector;

type WalletCtx = {
  accountId: string | null;
  evmAddress: string | null;
  balanceHbar: number | null;
  connecting: boolean;
  connect: () => Promise<void>;
  connectEmail: () => Promise<void>;
  mode: "hashpack" | "email" | null;
  disconnect: () => Promise<void>;
  /** Calls the launchpad contract. calldata = full ABI-encoded call (selector + args). */
  execute: (opts: {
    calldata: `0x${string}`;
    gas: number;
    payableTinybars?: bigint;
    contractId?: string;
  }) => Promise<{ transactionId: string; transactionHash: string }>;
  /** Sends ONE deploy approval to HashPack; call again (from a tap) for the next one. */
  deploy: (opts: {
    bytecode: string;
    constructorParams: `0x${string}`;
    gas: number;
  }) => Promise<DeployProgress>;
  /** Reads how far the deploy got (from Hedera), without asking the wallet anything. */
  checkDeploy: (bytecode: string) => Promise<DeployProgress>;
  /** Last known deploy progress, so the UI can say which approval is next. */
  deployProgress: DeployProgress | null;
  refresh: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);
// 0.0.N contract ID -> its long-zero EVM address
const idToEvm = (id: string) =>
  "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

type EvmSigner = import("ethers").JsonRpcSigner;
let web3auth: import("@web3auth/modal").Web3Auth | null = null;
async function initWeb3Auth() {
  if (web3auth) return web3auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (await import("@web3auth/modal")) as any;
  // Production bundles may nest the exports under `default`.
  const m = (raw.Web3Auth ? raw : raw.default?.Web3Auth ? raw.default : raw.default?.default ?? raw) as typeof import("@web3auth/modal");
  if (typeof m.Web3Auth !== "function") throw new Error("Sign-in service failed to load. Please refresh and try again.");
  const w = new m.Web3Auth({
    clientId: WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: m.WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    chains: [
      {
        chainNamespace: m.CHAIN_NAMESPACES.EIP155,
        chainId: "0x" + EVM_CHAIN_ID.toString(16),
        rpcTarget: EVM_RPC_URL,
        displayName: NETWORK === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet",
        blockExplorerUrl: HASHSCAN_URL,
        ticker: "HBAR",
        tickerName: "HBAR",
        decimals: 18,
        logo: "https://hashscan.io/favicon.ico",
      } as never,
    ],
    defaultChainId: "0x" + EVM_CHAIN_ID.toString(16),
  } as never);
  await w.init();
  web3auth = w;
  return w;
}

const hexToBytes = (h: string) =>
  Uint8Array.from((h.replace(/^0x/, "").match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

// Remembers an interrupted contract upload so the next attempt continues where it
// stopped instead of paying for the same bytes again.
const DEPLOY_STATE_KEY = "hederaPump.deploy.v1";
const LEGACY_DEPLOY = { account: "0.0.10923241", state: { fileId: "0.0.10923830", uploaded: 4096 } };
const fingerprint = (bc: string) => `${bc.length}:${bc.slice(0, 16)}:${bc.slice(-16)}`;

async function loadLibs() {
  const [wc, sdk] = await Promise.all([
    import("@hashgraph/hedera-wallet-connect"),
    import("@hiero-ledger/sdk"),
  ]);
  return { wc, sdk };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const connector = useRef<Connector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [evmAddress, setEvm] = useState<string | null>(null);
  const [balanceHbar, setBal] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<"hashpack" | "email" | null>(null);
  const evmSigner = useRef<EvmSigner | null>(null);
  const [deployProgress, setDeployProgress] = useState<DeployProgress | null>(null);

  const attachEmail = useCallback(async (w: import("@web3auth/modal").Web3Auth) => {
    if (!w.provider) return;
    const { BrowserProvider } = await import("ethers");
    const signer = await new BrowserProvider(w.provider as never).getSigner();
    evmSigner.current = signer;
    const addr = (await signer.getAddress()).toLowerCase();
    setMode("email");
    setEvm(addr);
    // Hedera creates the account on first HBAR deposit; until then show the address.
    const a = await fetch(`${MIRROR_URL}/api/v1/accounts/${addr}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setAccountId(a?.account ?? addr);
  }, []);

  const initPromise = useRef<Promise<Connector> | null>(null);
  const init = useCallback(() => {
    if (connector.current) return Promise.resolve(connector.current);
    // Share one in-flight init so a click during page-load setup doesn't hit a half-ready connector.
    if (initPromise.current) return initPromise.current;
    initPromise.current = (async () => {
      if (!WALLETCONNECT_PROJECT_ID)
        throw new Error("Wallet connection isn't configured yet (missing WalletConnect project ID).");
      const { wc, sdk } = await loadLibs();
      const ledger = NETWORK === "mainnet" ? sdk.LedgerId.MAINNET : sdk.LedgerId.TESTNET;
      const chain = NETWORK === "mainnet" ? wc.HederaChainId.Mainnet : wc.HederaChainId.Testnet;
      const c = new wc.DAppConnector(
        {
          name: "HederaPump",
          description: "Meme coin launchpad on Hedera",
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
        ledger,
        WALLETCONNECT_PROJECT_ID,
        Object.values(wc.HederaJsonRpcMethod),
        [wc.HederaSessionEvent.ChainChanged, wc.HederaSessionEvent.AccountsChanged],
        [chain],
      );
      await c.init({ logger: "error" });
      connector.current = c;
      return c;
    })().catch((e) => {
      initPromise.current = null; // allow a retry on the next click
      console.error("WalletConnect init failed", e);
      throw e;
    });
    return initPromise.current;
  }, []);

  const syncAccount = useCallback(() => {
    const s = connector.current?.signers[0];
    if (s) setMode("hashpack");
    setAccountId(s ? s.getAccountId().toString() : null);
  }, []);

  // Restore an email-wallet session on load.
  useEffect(() => {
    if (!WEB3AUTH_CLIENT_ID) return;
    initWeb3Auth()
      .then((w) => (w.connected ? attachEmail(w) : undefined))
      .catch(() => {});
  }, [attachEmail]);

  // Restore an existing session on load.
  useEffect(() => {
    if (!WALLETCONNECT_PROJECT_ID) return;
    init()
      .then(syncAccount)
      .catch(() => {});
  }, [init, syncAccount]);

  useEffect(() => {
    if (!accountId) {
      setEvm(null);
      setBal(null);
      return;
    }
    fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!a) return setBal(0);
        if (a.evm_address) setEvm((a.evm_address as string).toLowerCase());
        setBal(a.balance ? a.balance.balance / 1e8 : 0);
      })
      .catch(() => {});
  }, [accountId, tick]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const c = await init();
      await c.openModal();
      syncAccount();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect wallet");
    } finally {
      setConnecting(false);
    }
  }, [init, syncAccount]);

  const connectEmail = useCallback(async () => {
    setConnecting(true);
    try {
      const w = await initWeb3Auth();
      if (!w.connected) await w.connect();
      await attachEmail(w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setConnecting(false);
    }
  }, [attachEmail]);

  const disconnect = useCallback(async () => {
    await connector.current?.disconnectAll().catch(() => {});
    if (web3auth?.connected) await web3auth.logout().catch(() => {});
    evmSigner.current = null;
    setMode(null);
    setAccountId(null);
  }, []);

  const signer = () => {
    const s = connector.current?.signers[0];
    if (!s) throw new Error("Connect your wallet first");
    return s;
  };

  const execute: WalletCtx["execute"] = useCallback(
    async ({ calldata, gas, payableTinybars, contractId }) => {
      const id = contractId ?? PUMP_CONTRACT_ID;
      if (!id) throw new Error("Launchpad contract isn't deployed yet");
      if (evmSigner.current) {
        const tx = await evmSigner.current.sendTransaction({
          to: idToEvm(id),
          data: calldata,
          gasLimit: BigInt(gas),
          // JSON-RPC uses 18 decimals: 1 tinybar = 1e10 weibar
          value: (payableTinybars ?? 0n) * 10_000_000_000n,
        });
        const r = await tx.wait();
        if (!r || r.status !== 1) throw new Error("Transaction failed");
        setTick((t) => t + 1);
        return { transactionId: tx.hash, transactionHash: tx.hash };
      }
      const { sdk } = await loadLibs();
      const s = signer();
      // The WalletConnect signer's node list can contain nodes the wallet's own
      // client rejects (e.g. 0.0.17). Freeze against the SDK's full mainnet node
      // list instead; signing still happens in the wallet.
      const client = sdk.Client.forMainnet();
      let tx = new sdk.ContractExecuteTransaction()
        .setContractId(sdk.ContractId.fromString(id))
        .setGas(gas)
        .setFunctionParameters(hexToBytes(calldata));
      if (payableTinybars && payableTinybars > 0n)
        tx = tx.setPayableAmount(sdk.Hbar.fromTinybars(payableTinybars.toString()));
      tx.setNodeAccountIds(Object.values(client.network).slice(0, 1) as never);
      await tx.freezeWith(client);
      await tx.signWithSigner(s as never);
      const res = await tx.executeWithSigner(s as never);
      const receipt = await res.getReceiptWithSigner(s as never);
      if (receipt.status.toString() !== "SUCCESS")
        throw new Error(`Transaction failed: ${receipt.status}`);
      setTick((t) => t + 1);
      const hash =
        "0x" + [...res.transactionHash].map((b) => b.toString(16).padStart(2, "0")).join("");
      return { transactionId: res.transactionId.toString(), transactionHash: hash.slice(0, 66) };
    },
    [],
  );

  // Where the upload stands: Hedera's own record first, this browser's memory second.
  const resolveDeploy = useCallback(async (bc: string): Promise<{ resume: DeployState | null; contractId: string | null }> => {
    const id = accountId && /^\d+\.\d+\.\d+$/.test(accountId) ? accountId : null;
    const fp = fingerprint(bc.replace(/^0x/, ""));
    let local: DeployState | null = null;
    try {
      const stored = JSON.parse(localStorage.getItem(DEPLOY_STATE_KEY) ?? "null") as
        (DeployState & { fingerprint?: string }) | null;
      if (stored?.fileId && stored.fingerprint === fp && typeof stored.uploaded === "number")
        local = { fileId: stored.fileId, uploaded: stored.uploaded };
    } catch { local = null; }
    const chain = id ? await findDeployOnMirror(MIRROR_URL, id, bc).catch(() => null) : null;
    if (chain?.contractId) return { resume: chain.state, contractId: chain.contractId };
    let resume = chain?.state ?? local;
    if (chain?.state && local && local.fileId === chain.state.fileId)
      resume = { fileId: local.fileId, uploaded: Math.max(local.uploaded, chain.state.uploaded) };
    // First part of the 4096-byte upload already paid for on 16 Oct 2026 (before step memos existed).
    if (!resume && id === LEGACY_DEPLOY.account) resume = LEGACY_DEPLOY.state;
    return { resume, contractId: null };
  }, [accountId]);

  const checkDeploy: WalletCtx["checkDeploy"] = useCallback(async (bytecode) => {
    const { resume, contractId } = await resolveDeploy(bytecode);
    const p = deployProgressOf(bytecode, resume, contractId);
    setDeployProgress(p);
    return p;
  }, [resolveDeploy]);

  const deploy: WalletCtx["deploy"] = useCallback(async ({ bytecode, constructorParams, gas }) => {
    if (evmSigner.current) throw new Error("Deploy with HashPack, not an email wallet");
    const { sdk } = await loadLibs();
    const s = signer();
    const fp = fingerprint(bytecode.replace(/^0x/, ""));
    const { resume, contractId } = await resolveDeploy(bytecode);
    if (contractId) {
      const done = deployProgressOf(bytecode, resume, contractId);
      setDeployProgress(done);
      return done;
    }
    const p = await deployStep(sdk, s, MIRROR_URL, { bytecode, constructorParams, gas, resume });
    setDeployProgress(p);
    try {
      if (p.contractId) localStorage.removeItem(DEPLOY_STATE_KEY);
      else if (p.fileId) localStorage.setItem(DEPLOY_STATE_KEY, JSON.stringify({ fileId: p.fileId, uploaded: p.uploaded, fingerprint: fp }));
      else localStorage.removeItem(DEPLOY_STATE_KEY);
    } catch { /* storage unavailable: Hedera's record still has the progress */ }
    return p;
  }, [resolveDeploy]);

  return (
    <Ctx.Provider
      value={{
        accountId,
        evmAddress,
        balanceHbar,
        connecting,
        connect,
        connectEmail,
        mode,
        disconnect,
        execute,
        deploy,
        checkDeploy,
        deployProgress,
        refresh: () => setTick((t) => t + 1),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
