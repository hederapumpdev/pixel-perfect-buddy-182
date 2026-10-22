import "./node-globals";
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
import { connectionDeadline, openWalletPicker, WalletConnectionCancelled, type WalletHandoff } from "./wallet-connection";
import { deployStep, deployProgressOf, findDeployOnMirror, type DeployProgress, type DeployState } from "./hashpack-deploy";
import { WalletHandoffHelp } from "@/components/WalletHandoffHelp";
import { MAX_ACCOUNT_WALLETS, adoptLegacyWallet, decryptKey, encryptKey, readAccountWallets, writeAccountWallets, type StoredLocalWallet } from "./local-wallet";
import { clearSigninReturn, readSigninReturn, saveSigninReturn, takeSigninReturn } from "./signin-return";
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
  mode: "hashpack" | "email" | "local" | null;
  /** The signed-in account (HashPack or email); extra wallets belong to it. */
  owner: { id: string; mode: "hashpack" | "email" } | null;
  /** Extra wallets saved in this account on this device (max 10). */
  accountWallets: string[];
  /** Imports a private key or recovery phrase; it is encrypted with the PIN and kept in this browser only. */
  importKey: (opts: { key: string; accountId?: string | undefined; pin: string }) => Promise<void>;
  /** Makes an extra wallet the active one (PIN unlocks it). */
  activateLocal: (id: string, pin: string) => Promise<void>;
  /** Switches back to the account's own wallet. */
  activateOwner: () => void;
  removeLocal: (id: string) => void;
  /** Makes a brand-new wallet in this browser; returns the 24 recovery words to write down. */
  createLocal: (pin: string) => Promise<string[]>;
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
  /** Signs a plain-text message (no transaction, no HBAR). */
  signText: (text: string) => Promise<{ signature?: string; evmSignature?: string }>;
  /** Opens one of the site's fee wallets on Hedera; the wallet pays only the network fee. */
  createFundAccount: (publicKeyHex: string, label: string) => Promise<void>;
  refresh: () => void;
};

// Keep one context object across hot reloads; a fresh one would orphan the
// already-mounted provider ("useWallet outside WalletProvider").
const g = globalThis as { __hpWalletCtx?: React.Context<WalletCtx | null> };
const Ctx = (g.__hpWalletCtx ??= createContext<WalletCtx | null>(null));
// 0.0.N contract ID -> its long-zero EVM address
const idToEvm = (id: string) =>
  "0x" + BigInt(id.split(".")[2] ?? "0").toString(16).padStart(40, "0");

type EvmSigner = import("ethers").Signer;
let web3auth: import("@web3auth/modal").Web3Auth | null = null;
let web3authInit: Promise<import("@web3auth/modal").Web3Auth> | null = null;
function initWeb3Auth(beforeInit?: (w: import("@web3auth/modal").Web3Auth) => void) {
  if (web3auth) return Promise.resolve(web3auth);
  if (!web3authInit) web3authInit = createWeb3Auth(beforeInit).catch((e) => { web3authInit = null; throw e; });
  return web3authInit;
}
async function createWeb3Auth(beforeInit?: (w: import("@web3auth/modal").Web3Auth) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (await import("@web3auth/modal")) as any;
  // Production bundles may nest the exports under `default`.
  const m = (raw.Web3Auth ? raw : raw.default?.Web3Auth ? raw.default : raw.default?.default ?? raw) as typeof import("@web3auth/modal");
  if (typeof m.Web3Auth !== "function") throw new Error("Sign-in service failed to load. Please refresh and try again.");
  // Free plan: the EVM wallet-services embed is refused (403), so sign-in never completes.
  // Use the plain key provider and sign locally with ethers instead.
  const chain = {
    chainNamespace: "other",
    chainId: "0x" + EVM_CHAIN_ID.toString(16),
    rpcTarget: EVM_RPC_URL,
    displayName: NETWORK === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet",
    blockExplorerUrl: HASHSCAN_URL,
    ticker: "HBAR",
    tickerName: "HBAR",
    decimals: 18,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nm = (await import("@web3auth/no-modal")) as any;
  const PK = nm.CommonPrivateKeyProvider ?? nm.default?.CommonPrivateKeyProvider;
  const privateKeyProvider = new PK({ config: { chain, chains: [chain], keyExportEnabled: true } });
  const w = new m.Web3Auth({
    privateKeyProvider,
    clientId: WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: m.WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    chains: [
      {
        chainNamespace: "other",
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
    modalConfig: {
      hideWalletDiscovery: true,
      connectors: {
        auth: { label: "Sign in", showOnModal: true },
        metamask: { label: "MetaMask", showOnModal: false },
        "wallet-connect-v2": { label: "WalletConnect", showOnModal: false },
        coinbase: { label: "Coinbase", showOnModal: false },
        "base-account": { label: "Base Account", showOnModal: false },
      },
    },
    // No walletServicesConfig: the sign-in service's free plan rejects wallet services
    // (403 "not available on base plan"), which blocks every email/Google sign-in.
    // Same-tab sign-in: phone browsers block the login popup ("popup window is blocked")
    // because it opens after async work, not directly from the tap.
    // Inside a frame (e.g. the editor preview) Google refuses to load in-page, so keep the popup there.
    uiConfig: { uxMode: window.self !== window.top ? "popup" : "redirect" },
  } as never);
  beforeInit?.(w);
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
  const [mode, setMode] = useState<"hashpack" | "email" | "local" | null>(null);
  const [owner, setOwnerState] = useState<{ key: string; id: string; mode: "hashpack" | "email" } | null>(null);
  const ownerRef = useRef<typeof owner>(null);
  const ownerEvm = useRef<EvmSigner | null>(null);
  const [accountWallets, setAccountWallets] = useState<StoredLocalWallet[]>([]);
  const setOwner = useCallback((o: typeof owner) => {
    ownerRef.current = o;
    setOwnerState(o);
    setAccountWallets(o ? adoptLegacyWallet(o.key) : []);
  }, []);
  // Imported wallet: decrypted key lives only in memory, inside an operator client.
  const local = useRef<{ client: import("@hiero-ledger/sdk").Client; key: import("@hiero-ledger/sdk").PrivateKey; id: string } | null>(null);
  const evmSigner = useRef<EvmSigner | null>(null);
  const [deployProgress, setDeployProgress] = useState<DeployProgress | null>(null);
  // Set when the wallet app was asked to open but never came back.
  const [handoff, setHandoff] = useState<WalletHandoff | null>(null);

  const attachEmail = useCallback(async (w: import("@web3auth/modal").Web3Auth) => {
    if (!w.provider) return;
    const { Wallet, JsonRpcProvider } = await import("ethers");
    const pk = (await w.provider.request({ method: "private_key" })) as string;
    const signer = new Wallet(pk.startsWith("0x") ? pk : "0x" + pk, new JsonRpcProvider(EVM_RPC_URL));
    evmSigner.current = signer;
    const addr = (await signer.getAddress()).toLowerCase();
    setMode("email");
    setEvm(addr);
    // Hedera creates the account on first HBAR deposit; until then show the address.
    const a = await fetch(`${MIRROR_URL}/api/v1/accounts/${addr}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setAccountId(a?.account ?? addr);
    setOwner({ key: addr, id: a?.account ?? addr, mode: "email" });
  }, [setOwner]);

  const initPromise = useRef<Promise<Connector> | null>(null);
  const init = useCallback(() => {
    if (connector.current) return Promise.resolve(connector.current);
    // Share one in-flight init so a click during page-load setup doesn't hit a half-ready connector.
    if (initPromise.current) return initPromise.current;
    initPromise.current = (async () => {
      if (!WALLETCONNECT_PROJECT_ID)
        throw new Error("Wallet connection isn't configured yet (missing WalletConnect project ID).");
      const { wc, sdk } = await connectionDeadline(loadLibs(), 20_000,
        "WalletConnect couldn't load. Refresh the page and try again.");
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
      await connectionDeadline(c.init({ logger: "error" }), 20_000,
        "WalletConnect couldn't reach the connection service. Check your connection and try again.");
      // The SDK logs init failures instead of rejecting them. Never cache a
      // connector that cannot actually generate a pairing request.
      if (!c.walletConnectClient) throw new Error(
        "WalletConnect couldn't start. Check your connection and try again.",
      );
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
    const id = s ? s.getAccountId().toString() : null;
    if (s) setMode("hashpack");
    setAccountId(id);
    setOwner(id ? { key: id, id, mode: "hashpack" } : null);
  }, [setOwner]);

  // Restore an email-wallet session on load, including the return from same-tab sign-in.
  useEffect(() => {
    if (!WEB3AUTH_CLIENT_ID) return;
    // Read the sign-in result before the SDK wipes it from the address bar.
    const back = readSigninReturn(window.location.hash, window.location.search);
    const savedPath = takeSigninReturn();
    const returning = back.present || savedPath != null;
    const TOAST = "signin-return";
    let done = false;
    let stop = () => {};
    // Defer: the toast area mounts after this provider on first load.
    // The toast area mounts after this provider on first load; wait for it.
    const whenToasts = (fn: () => void) => {
      let tries = 0;
      const tick = () => document.querySelector('section[aria-label^="Notifications"]') || ++tries > 50
        ? setTimeout(fn, 50) : setTimeout(tick, 100);
      tick();
    };
    if (returning) whenToasts(() => { if (!done) toast.loading("Finishing sign-in…", { id: TOAST, duration: Infinity }); });
    const fail = (e: unknown) => {
      console.error("Sign-in restore failed", e);
      if (!returning || done) return;
      done = true;
      clearSigninReturn();
      stop();
      const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
      whenToasts(() => toast.error(`Sign-in didn't finish: ${msg}`, { id: TOAST, duration: Infinity, closeButton: true }));
    };
    if (returning && back.error) fail(new Error(back.error));
    const finish = async (w: import("@web3auth/modal").Web3Auth) => {
      if (done || !w.connected || !w.provider) return;
      done = true;
      try {
        await attachEmail(w);
        if (returning) {
          clearSigninReturn();
          stop();
          toast.success("Signed in", { id: TOAST, duration: 4000 });
          const target = savedPath ?? window.location.pathname;
          if (target !== window.location.pathname + window.location.search) window.location.replace(target);
        }
      } catch (e) {
        done = false;
        fail(e);
      }
    };
    // Covers a sign-in service that never finishes starting, too.
    const giveUp = setTimeout(() => {
      if (done || !returning) return;
      fail(new Error(back.present
        ? (back.hasSession
          ? "the sign-in service sent you back but couldn't open your wallet. Please try again."
          : "the sign-in service sent you back without a login. Please try again.")
        : "you came back without a login result from Google/e-mail. Please try again, and stay in the same browser tab."));
    }, 25_000);
    let poll: ReturnType<typeof setInterval> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ev: any = null;
    const onConnected = () => ev && void finish(ev);
    const onConsent = () => ev?.acceptConsent?.().then(() => finish(ev)).catch(fail);
    const onError = (e: unknown) => fail(e);
    stop = () => {
      clearInterval(poll);
      clearTimeout(giveUp);
      if (!ev) return;
      ev.off("connected", onConnected);
      ev.off("authorized", onConnected);
      ev.off("consent_requiring", onConsent);
      ev.off("rehydration_error", onError);
      ev.off("errored", onError);
    };
    // Listen BEFORE init: the SDK reports the redirect result during init.
    initWeb3Auth((w) => {
      ev = w;
      ev.on("connected", onConnected);
      ev.on("authorized", onConnected);
      ev.on("consent_requiring", onConsent);
      ev.on("rehydration_error", onError);
      ev.on("errored", onError);
    })
      .then((w) => {
        ev = w;
        if (done) return;
        // The return from Google can finish a moment after init; keep checking briefly.
        poll = setInterval(() => void finish(w), 500);
        if (ev.status === "consent_requiring") onConsent();
        void finish(w);
      })
      .catch(fail);
    return () => stop();
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
        if (typeof a.account === "string" && /^\d+\.\d+\.\d+$/.test(a.account)) setAccountId(a.account);
        if (a.evm_address) setEvm((a.evm_address as string).toLowerCase());
        setBal(a.balance ? a.balance.balance / 1e8 : 0);
      })
      .catch(() => {});
  }, [accountId, tick]);

  const connectInFlight = useRef(false);
  const connect = useCallback(async () => {
    if (connectInFlight.current) return;
    connectInFlight.current = true;
    setConnecting(true);
    try {
      try {
        const c = await init();
        await openWalletPicker(c, { onHandoff: setHandoff });
      } catch (e) {
        // A stale WalletConnect pairing makes the relay reject messages
        // ("Failed to publish custom payload"). Clear it and retry once.
        const msg = e instanceof Error ? e.message : String(e);
        if (!/publish|relay|pairing|session|expired|no matching key/i.test(msg)) throw e;
        const old = connector.current;
        old?.walletConnectModal.closeModal();
        if (old) await connectionDeadline(old.disconnectAll(), 3_000, "Connection reset timed out").catch(() => {});
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("wc@2") || k.startsWith("walletconnect"))
            .forEach((k) => localStorage.removeItem(k));
        } catch { /* storage unavailable */ }
        connector.current = null;
        initPromise.current = null;
        toast.message("Resetting the wallet connection, trying again…");
        const c = await init();
        await openWalletPicker(c, { onHandoff: setHandoff });
      }
      syncAccount();
    } catch (e) {
      if (!(e instanceof WalletConnectionCancelled))
        toast.error(e instanceof Error ? e.message : "Couldn't connect wallet");
    } finally {
      connectInFlight.current = false;
      setConnecting(false);
      setHandoff(null);
    }
  }, [init, syncAccount]);

  const connectEmail = useCallback(async () => {
    setConnecting(true);
    try {
      const w = await initWeb3Auth();
      // Same-tab sign-in leaves this page; remember where to come back to.
      saveSigninReturn(window.location.pathname + window.location.search);
      if (!w.connected) await w.connect();
      if (w.connected) clearSigninReturn();
      await attachEmail(w);
    } catch (e) {
      clearSigninReturn();
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setConnecting(false);
    }
  }, [attachEmail]);

  const saveWallets = useCallback((list: StoredLocalWallet[]) => {
    const o = ownerRef.current;
    if (!o) return;
    writeAccountWallets(o.key, list);
    setAccountWallets(list);
  }, []);

  const attachLocal = useCallback(async (keyText: string, id: string) => {
    const { sdk } = await loadLibs();
    const key = sdk.PrivateKey.fromStringDer(keyText);
    // A new wallet starts as an address; Hedera opens the 0.0.x account on its first HBAR deposit.
    if (id.startsWith("0x")) {
      const a = await fetch(`${MIRROR_URL}/api/v1/accounts/${id}?transactions=false`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (a?.account) {
        const o = ownerRef.current;
        if (o) saveWallets(readAccountWallets(o.key).map((s) => (s.accountId === id ? { ...s, accountId: a.account } : s)));
        id = a.account;
      }
    }
    const acct = id.startsWith("0x") ? sdk.AccountId.fromEvmAddress(0, 0, id) : sdk.AccountId.fromString(id);
    const client = sdk.Client.forMainnet().setOperator(acct, key);
    // Keep the account session; park its email signer while an extra wallet is active.
    if (evmSigner.current) ownerEvm.current = evmSigner.current;
    evmSigner.current = null;
    local.current = { client, key, id };
    setMode("local");
    setAccountId(id);
  }, [saveWallets]);

  const addWallet = useCallback(async (id: string, der: string, pin: string) => {
    const o = ownerRef.current;
    if (!o) throw new Error("Sign in to your account first (HashPack or email).");
    const list = readAccountWallets(o.key).filter((s) => s.accountId !== id);
    if (list.length >= MAX_ACCOUNT_WALLETS) throw new Error(`An account can hold at most ${MAX_ACCOUNT_WALLETS} wallets. Remove one first.`);
    if (id === o.id) throw new Error("That is already your account wallet.");
    saveWallets([...list, await encryptKey(id, der, pin)]);
    await attachLocal(der, id);
  }, [attachLocal, saveWallets]);

  const importKey: WalletCtx["importKey"] = useCallback(async ({ key, accountId: given, pin }) => {
    if (!ownerRef.current) throw new Error("Sign in to your account first (HashPack or email).");
    const { sdk } = await loadLibs();
    const text = key.trim();
    const cands: import("@hiero-ledger/sdk").PrivateKey[] = [];
    if (text.split(/\s+/).length >= 12) {
      const m = await sdk.Mnemonic.fromString(text.toLowerCase());
      cands.push(await m.toStandardECDSAsecp256k1PrivateKey("", 0), await m.toStandardEd25519PrivateKey("", 0));
      try { cands.push(await m.toEd25519PrivateKey()); } catch { /* not a legacy phrase */ }
    } else {
      const hex = text.replace(/^0x/, "");
      try { cands.push(sdk.PrivateKey.fromStringDer(hex)); } catch { /* raw key */ }
      if (!cands.length && /^[0-9a-f]{64}$/i.test(hex)) {
        cands.push(sdk.PrivateKey.fromStringECDSA(hex), sdk.PrivateKey.fromStringED25519(hex));
      }
    }
    if (!cands.length) throw new Error("That isn't a valid private key or recovery phrase.");
    const want = given?.trim();
    let match: { id: string; key: import("@hiero-ledger/sdk").PrivateKey } | null = null;
    for (const k of cands) {
      const pub = k.publicKey.toStringRaw().toLowerCase();
      if (want) {
        const a = await fetch(`${MIRROR_URL}/api/v1/accounts/${want}?transactions=false`).then((r) => (r.ok ? r.json() : null));
        if (!a) throw new Error("That account doesn't exist on Hedera.");
        if (String(a.key?.key ?? "").toLowerCase() === pub) match = { id: a.account, key: k };
      } else {
        const j = await fetch(`${MIRROR_URL}/api/v1/accounts?account.publickey=${pub}&limit=1`).then((r) => (r.ok ? r.json() : null));
        const id = j?.accounts?.[0]?.account;
        if (id) match = { id, key: k };
      }
      if (match) break;
    }
    if (!match) throw new Error(want ? "This key doesn't belong to that account." : "No Hedera account found for this key. Enter your account ID too.");
    await addWallet(match.id, match.key.toStringDer(), pin);
  }, [addWallet]);

  const createLocal: WalletCtx["createLocal"] = useCallback(async (pin) => {
    if (!ownerRef.current) throw new Error("Sign in to your account first (HashPack or email).");
    const { sdk } = await loadLibs();
    const m = await sdk.Mnemonic.generate();
    const key = await m.toStandardECDSAsecp256k1PrivateKey("", 0);
    const addr = ("0x" + key.publicKey.toEvmAddress()).toLowerCase();
    await addWallet(addr, key.toStringDer(), pin);
    return m.toString().split(/\s+/);
  }, [addWallet]);

  const activateLocal: WalletCtx["activateLocal"] = useCallback(async (id, pin) => {
    const o = ownerRef.current;
    const s = o && readAccountWallets(o.key).find((x) => x.accountId === id);
    if (!s) throw new Error("That wallet isn't in your account.");
    await attachLocal(await decryptKey(s, pin), s.accountId);
  }, [attachLocal]);

  const activateOwner = useCallback(() => {
    const o = ownerRef.current;
    local.current = null;
    if (!o) {
      setMode(null);
      setAccountId(null);
      return;
    }
    if (o.mode === "email") {
      evmSigner.current = ownerEvm.current ?? evmSigner.current;
      setMode("email");
      setAccountId(o.id);
    } else {
      setMode("hashpack");
      setAccountId(o.id);
    }
  }, []);

  const removeLocal = useCallback((id: string) => {
    const o = ownerRef.current;
    if (!o) return;
    saveWallets(readAccountWallets(o.key).filter((s) => s.accountId !== id));
    if (local.current?.id === id) activateOwner();
  }, [activateOwner, saveWallets]);

  const disconnect = useCallback(async () => {
    local.current = null;
    ownerEvm.current = null;
    ownerRef.current = null;
    setOwner(null);
    setAccountWallets([]);
    await connector.current?.disconnectAll().catch(() => {});
    if (web3auth?.connected) await web3auth.logout().catch(() => {});
    evmSigner.current = null;
    setMode(null);
    setAccountId(null);
  }, []);

  const signer = () => {
    if (local.current) {
      const l = local.current;
      return {
        getAccountId: () => l.client.operatorAccountId!,
        sign: async (msgs: Uint8Array[]) => msgs.map((m) => ({ signature: l.key.sign(m) })),
      } as unknown as NonNullable<Connector["signers"][0]>;
    }
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
        res = await (local.current ? tx.execute(local.current.client as never) : tx.executeWithSigner(s as never));
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
      execute: (c: never) => Promise<{ transactionId: { toString(): string } }>;
    }) => {
      const { sdk } = await loadLibs();
      const s = signer();
      const client = sdk.Client.forMainnet();
      tx.setNodeAccountIds(WALLET_NODE_IDS.map((n) => sdk.AccountId.fromString(n)) as never);
      tx.setTransactionId(sdk.TransactionId.generate(s.getAccountId()) as never);
      await tx.freezeWith(client as never);
      let res: { transactionId: { toString(): string } };
      try {
        res = await (local.current ? tx.execute(local.current.client as never) : tx.executeWithSigner(s as never));
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
    if (local.current) throw new Error("Deploy with HashPack, not an imported wallet");
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

  /**
   * Opens one of the site's fee wallets on Hedera. Hedera needs a real account before an
   * address can hold HBAR, so this is signed by the user's wallet (the bot can't sign here).
   * One wallet request; the result is read from Hedera's public record, never retried.
   */
  const createFundAccount: WalletCtx["createFundAccount"] = useCallback(async (publicKeyHex, label) => {
    if (evmSigner.current) throw new Error("Create this wallet with HashPack, not an email wallet");
    const { sdk } = await loadLibs();
    const s = signer();
    const client = sdk.Client.forMainnet();
    const key = sdk.PublicKey.fromBytesECDSA(hexToBytes(publicKeyHex));
    const tx = new sdk.AccountCreateTransaction().setECDSAKeyWithAlias(key);
    tx.setNodeAccountIds(WALLET_NODE_IDS.map((n) => sdk.AccountId.fromString(n)) as never);
    tx.setTransactionId(sdk.TransactionId.generate(s.getAccountId()));
    tx.setTransactionMemo(`hederaPump:${label}`);
    await tx.freezeWith(client);
    const txId = tx.transactionId?.toString() ?? "";
    try {
      await (local.current ? tx.execute(local.current.client as never) : tx.executeWithSigner(s as never));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/INSUFFICIENT_PAYER_BALANCE|INSUFFICIENT_ACCOUNT_BALANCE/i.test(msg))
        throw new Error("Not enough HBAR in your wallet to open this. Nothing was charged.");
      if (/getByKey|unhealthy|txError/i.test(msg))
        throw new Error("HashPack couldn't send this to Hedera. Nothing was charged — please try again.");
      throw e;
    }
    const [acct, ts] = txId.split("@");
    const mirrorId = `${acct}-${(ts ?? "").replace(".", "-")}`;
    let result: string | null = null;
    for (let i = 0; i < 40 && !result; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const j = await fetch(`${MIRROR_URL}/api/v1/transactions/${mirrorId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      result = j?.transactions?.[0]?.result ?? null;
    }
    if (!result) throw new Error("Sent, but no confirmation yet. Check your wallet history before trying again.");
    if (result !== "SUCCESS") throw new Error(`Wallet not created: ${result}`);
    setTick((t) => t + 1);
  }, []);

  const signText: WalletCtx["signText"] = useCallback(async (text) => {
    if (evmSigner.current) return { evmSignature: await evmSigner.current.signMessage(text) };
    if (local.current) {
      const sig = local.current.key.sign(new TextEncoder().encode(`\x19Hedera Signed Message:\n${text.length}${text}`));
      return { signature: Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("") };
    }
    const [r] = await signer().sign([new TextEncoder().encode(text)]);
    if (!r) throw new Error("Wallet did not sign");
    const hex = Array.from(r.signature, (b) => b.toString(16).padStart(2, "0")).join("");
    return { signature: hex };
  }, []);

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
        owner: owner && { id: owner.id, mode: owner.mode },
        accountWallets: accountWallets.map((s) => s.accountId),
        importKey,
        createLocal,
        activateLocal,
        activateOwner,
        removeLocal,
        disconnect,
        execute,
        associateToken,
        approveToken,
        deploy,
        checkDeploy,
        deployProgress,
        signText,
        createFundAccount,
        refresh: () => setTick((t) => t + 1),
      }}
    >
      {children}
      {handoff && (
        <WalletHandoffHelp uri={handoff.uri} retry={handoff.retry} onClose={() => setHandoff(null)} />
      )}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
