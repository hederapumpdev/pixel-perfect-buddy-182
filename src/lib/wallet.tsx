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
  WALLET_NODE_IDS,
} from "./hedera-config";

type Connector = import("@hashgraph/hedera-wallet-connect").DAppConnector;

type WalletCtx = {
  accountId: string | null;
  evmAddress: string | null;
  balanceHbar: number | null;
  connecting: boolean;
  connect: () => Promise<void>;
  connectEmail: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  mode: "hashpack" | "email" | "metamask" | null;
  disconnect: () => Promise<void>;
  /** Calls the launchpad contract. calldata = full ABI-encoded call (selector + args). */
  execute: (opts: {
    calldata: `0x${string}`;
    gas: number;
    payableTinybars?: bigint;
    contractId?: string;
  }) => Promise<{ transactionId: string; transactionHash: string }>;
  /** Adds an HTS token to the connected account (one-time, before the first buy). */
  associateToken: (tokenId: string) => Promise<void>;
  /** Lets the launchpad spend the account's HTS tokens (one-time, before the first sell). */
  approveToken: (tokenId: string, spenderId: string, amount: bigint) => Promise<void>;
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

// Keep one context object across hot reloads; a fresh one would orphan the
// already-mounted provider ("useWallet outside WalletProvider").
const g = globalThis as { __hpWalletCtx?: React.Context<WalletCtx | null> };
const Ctx = (g.__hpWalletCtx ??= createContext<WalletCtx | null>(null));
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
    // Trades sign instantly in the app (pump.fun-style quick trading), no confirm popup.
    walletServicesConfig: { confirmationStrategy: "auto-approve" },
  } as never);
  await w.init();
  web3auth = w;
  return w;
}

const hexToBytes = (h: string) =>
  Uint8Array.from((h.replace(/^0x/, "").match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

// Remembers an interrupted contract upload so the next attempt continues where it
// stopped instead of paying for the same bytes again.
const DEPLOY_STATE_KEY = "hederaPump.deploy.v2";
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
  const [mode, setMode] = useState<"hashpack" | "email" | "metamask" | null>(null);
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

  // MetaMask (or any injected EVM wallet) on Hedera's EVM network.
  const connectMetaMask = useCallback(async () => {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      // Phone browser without MetaMask: reopen this page inside the MetaMask app.
      window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
      return;
    }
    setConnecting(true);
    try {
      const chainHex = `0x${EVM_CHAIN_ID.toString(16)}`;
      await eth.request({ method: "eth_requestAccounts" });
      const current = await eth.request({ method: "eth_chainId" }).catch(() => null);
      if (current !== chainHex) try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      } catch {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chainHex,
            chainName: NETWORK === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet",
            nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
            rpcUrls: [EVM_RPC_URL],
            blockExplorerUrls: [HASHSCAN_URL],
          }],
        });
      }
      const { BrowserProvider } = await import("ethers");
      const signer = await new BrowserProvider(eth as never).getSigner();
      evmSigner.current = signer;
      const addr = (await signer.getAddress()).toLowerCase();
      setMode("metamask");
      setEvm(addr);
      const a = await fetch(`${MIRROR_URL}/api/v1/accounts/${addr}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      setAccountId(a?.account ?? addr);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect MetaMask");
    } finally {
      setConnecting(false);
    }
  }, []);

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
        // Don't rely on the wallet's own receipt polling (MetaMask mobile stalls on
        // Hedera); ask the mirror node for the result instead.
        let done = false;
        for (let i = 0; i < 60 && !done; i++) {
          await new Promise((res) => setTimeout(res, 2000));
          const res = await fetch(`${MIRROR_URL}/api/v1/contracts/results/${tx.hash}`)
            .then((x) => (x.ok ? x.json() : null))
            .catch(() => null);
          if (!res?.result) continue;
          if (res.result !== "SUCCESS") throw new Error(`Transaction failed: ${res.result}`);
          done = true;
        }
        if (!done) throw new Error("Hedera hasn't confirmed this yet — check your wallet history before trying again.");
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
      tx.setNodeAccountIds(WALLET_NODE_IDS.map((n) => sdk.AccountId.fromString(n)) as never);
      tx.setTransactionId(sdk.TransactionId.generate(s.getAccountId()));
      await tx.freezeWith(client);
      // One wallet request (sign + submit). The wallet's receipt query breaks
      // ("Query.fromBytes() not implemented"), so read the result from the mirror node.
      let res: Awaited<ReturnType<typeof tx.executeWithSigner>>;
      try {
        res = await tx.executeWithSigner(s as never);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // The signer retries a failed transaction as a query, which hides the
        // wallet's real answer behind "Query.fromBytes() not implemented".
        if (/INSUFFICIENT_PAYER_BALANCE|INSUFFICIENT_ACCOUNT_BALANCE/i.test(msg))
          throw new Error("Not enough HBAR in your wallet for this. Nothing was charged — top up or use a smaller amount.");
        if (/getByKey|unhealthy|txError/i.test(msg))
          throw new Error(
            "HashPack couldn't send this to Hedera. Nothing was charged — please try again.",
          );
        throw e;
      }
      const [acct, ts] = res.transactionId.toString().split("@");
      const mirrorId = `${acct}-${(ts ?? "").replace(".", "-")}`;
      let result: string | null = null;
      for (let i = 0; i < 40 && !result; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const j = await fetch(`${MIRROR_URL}/api/v1/transactions/${mirrorId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        result = j?.transactions?.[0]?.result ?? null;
      }
      if (!result) throw new Error("Sent, but no confirmation yet. Check your wallet history.");
      if (result !== "SUCCESS") throw new Error(`Transaction failed: ${result}`);
      setTick((t) => t + 1);
      const hash =
        "0x" + [...res.transactionHash].map((b) => b.toString(16).padStart(2, "0")).join("");
      return { transactionId: res.transactionId.toString(), transactionHash: hash.slice(0, 66) };
    },
    [],
  );

  // Sends one non-contract Hedera transaction (associate / allowance) through
  // the connected wallet, same freeze + mirror-confirm pattern as execute().
  const submitTx = useCallback(
    async (tx: {
      setNodeAccountIds: (n: never) => unknown;
      setTransactionId: (id: never) => unknown;
      freezeWith: (c: never) => Promise<unknown>;
      executeWithSigner: (s: never) => Promise<{ transactionId: { toString(): string } }>;
    }) => {
      const { sdk } = await loadLibs();
      const s = signer();
      const client = sdk.Client.forMainnet();
      tx.setNodeAccountIds(WALLET_NODE_IDS.map((n) => sdk.AccountId.fromString(n)) as never);
      tx.setTransactionId(sdk.TransactionId.generate(s.getAccountId()) as never);
      await tx.freezeWith(client as never);
      let res: { transactionId: { toString(): string } };
      try {
        res = await tx.executeWithSigner(s as never);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/INSUFFICIENT_PAYER_BALANCE|INSUFFICIENT_ACCOUNT_BALANCE/i.test(msg))
          throw new Error("Not enough HBAR in your wallet for this. Nothing was charged — top up or use a smaller amount.");
        if (/getByKey|unhealthy|txError/i.test(msg))
          throw new Error(
            "HashPack couldn't send this to Hedera. Nothing was charged — please try again.",
          );
        throw e;
      }
      const [acct, ts] = res.transactionId.toString().split("@");
      const mirrorId = `${acct}-${(ts ?? "").replace(".", "-")}`;
      let result: string | null = null;
      for (let i = 0; i < 40 && !result; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const j = await fetch(`${MIRROR_URL}/api/v1/transactions/${mirrorId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        result = j?.transactions?.[0]?.result ?? null;
      }
      if (!result) throw new Error("Sent, but no confirmation yet. Check your wallet history.");
      if (result !== "SUCCESS") throw new Error(`Transaction failed: ${result}`);
      setTick((t) => t + 1);
    },
    [],
  );

  const associateToken: WalletCtx["associateToken"] = useCallback(
    async (tokenId) => {
      if (evmSigner.current) {
        // HTS precompile: associateToken(address account, address token)
        const data =
          "0x0914e2e2" +
          (await evmSigner.current.getAddress()).slice(2).padStart(64, "0") +
          idToEvm(tokenId).slice(2).padStart(64, "0");
        const tx = await evmSigner.current.sendTransaction({
          to: "0x0000000000000000000000000000000000000167",
          data: data as `0x${string}`,
          gasLimit: 800_000n,
        });
        const r = await tx.wait();
        if (!r || r.status !== 1) throw new Error("Adding the token failed");
        setTick((t) => t + 1);
        return;
      }
      const { sdk } = await loadLibs();
      const tx = new sdk.TokenAssociateTransaction()
        .setAccountId(signer().getAccountId())
        .setTokenIds([sdk.TokenId.fromString(tokenId)]);
      await submitTx(tx as never);
    },
    [submitTx],
  );

  const approveToken: WalletCtx["approveToken"] = useCallback(
    async (tokenId, spenderId, amount) => {
      if (evmSigner.current) {
        // ERC20 approve(spender, amount) on the token's EVM address.
        const data =
          "0x095ea7b3" +
          idToEvm(spenderId).slice(2).padStart(64, "0") +
          amount.toString(16).padStart(64, "0");
        const tx = await evmSigner.current.sendTransaction({
          to: idToEvm(tokenId),
          data: data as `0x${string}`,
          gasLimit: 800_000n,
        });
        const r = await tx.wait();
        if (!r || r.status !== 1) throw new Error("Approving the sale failed");
        setTick((t) => t + 1);
        return;
      }
      const { sdk } = await loadLibs();
      const tx = new sdk.AccountAllowanceApproveTransaction().approveTokenAllowance(
        sdk.TokenId.fromString(tokenId),
        signer().getAccountId(),
        sdk.AccountId.fromString(spenderId),
        // The amount is in the token's smallest unit (v2 coins: 8 decimals).
        sdk.Long.fromString(amount.toString()) as never,
      );
      await submitTx(tx as never);
    },
    [submitTx],
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
        connectMetaMask,
        mode,
        disconnect,
        execute,
        associateToken,
        approveToken,
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
