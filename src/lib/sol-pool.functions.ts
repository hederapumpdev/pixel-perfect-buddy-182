// Admin-only: open a SaucerSwap HBAR/SOL pool from the bot wallet, with the cost shown first.
// Nothing is sent unless the bot already holds the SOL and enough HBAR for the whole plan.
import { createServerFn } from "@tanstack/react-start";
import { MIRROR_URL, SAUCERSWAP_V1_ROUTER_ID } from "./hedera-config";
import { SOL_DECIMALS, SOL_TOKEN_ID, encodeAddLiquidityETHNewPool, poolCreateFeeTinybars, poolPlan, solPriceHbar, solPoolExists } from "./sol-pool";
import { idToEvm } from "./markets";

const checkPin = async (p: unknown, action?: string) => (await import("./admin-auth.server")).requireAdmin(p, action);
const RESERVE_TINYBARS = 5n * 100_000_000n; // gas money the bot must always keep
const hbarText = (t: bigint) => (Number(t) / 1e8).toFixed(2);

async function balanceOf(accountId: string, tokenId: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) return 0n;
  const j = await r.json();
  return BigInt(j?.tokens?.[0]?.balance ?? 0);
}

async function hbarOf(accountId: string): Promise<bigint> {
  const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}`, { signal: AbortSignal.timeout(10_000) });
  const j = r.ok ? await r.json() : null;
  return BigInt(j?.balance?.balance ?? 0);
}

async function hbarUsd(): Promise<number> {
  const r = await fetch(`${MIRROR_URL}/api/v1/network/exchangerate`, { signal: AbortSignal.timeout(10_000) });
  const c = (await r.json()).current_rate as { cent_equivalent: number; hbar_equivalent: number };
  return c.cent_equivalent / c.hbar_equivalent / 100;
}

/** Live picture of the HBAR/SOL pool: does it exist, what it costs, what the bot holds. */
export const getSolPoolAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: unknown }) => {
    if (typeof d.pin !== "string" && typeof d.pin !== "number") throw new Error("Admin sign-in needed");
    return d;
  })
  .handler(async ({ data }) => {
    await checkPin(data.pin, "sol pool status");
    const { botWallet } = await import("./bot.server");
    const w = botWallet();
    const acc = await fetch(`${MIRROR_URL}/api/v1/accounts/${w.address}`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const accountId = acc?.account as string | undefined;
    const [fee, usd, solUnits, hbar, quote] = await Promise.all([
      poolCreateFeeTinybars().catch(() => 0n),
      hbarUsd().catch(() => 0),
      accountId ? balanceOf(accountId, SOL_TOKEN_ID).catch(() => 0n) : Promise.resolve(0n),
      accountId ? hbarOf(accountId).catch(() => 0n) : Promise.resolve(0n),
      solPriceHbar(),
    ]);
    const exists = await solPoolExists().catch(() => false);
    const sol = Number(solUnits) / 10 ** SOL_DECIMALS;
    return {
      exists,
      tokenId: SOL_TOKEN_ID,
      routerId: SAUCERSWAP_V1_ROUTER_ID,
      accountId: accountId ?? null,
      feeTinybars: fee.toString(),
      feeHbar: Number(fee) / 1e8,
      hbarUsd: usd,
      sol,
      hbar: Number(hbar) / 1e8,
      // HBAR per SOL from SODAX's live quote; 0 when the quote is unavailable.
      hbarPerSol: quote?.hbarPerSol ?? 0,
      // The bot's HBAR that may actually be spent, after the reserve it needs for gas.
      spendableHbar: Math.max(0, (Number(hbar) - Number(RESERVE_TINYBARS)) / 1e8),
    };
  });

/**
 * Opens the pool. One transaction per call: a one-time approval for the router first,
 * then the pool creation itself. Nothing is sent when the SOL or HBAR isn't there yet.
 */
export const createSolPool = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: unknown; sol: string }) => {
    if (typeof d.pin !== "string" && typeof d.pin !== "number") throw new Error("Admin sign-in needed");
    if (!/^\d+(?:\.\d{1,8})?$/.test(String(d.sol).trim())) throw new Error("Enter a SOL amount");
    return { pin: d.pin, sol: String(d.sol).trim() };
  })
  .handler(async ({ data }) => {
    await checkPin(data.pin, "create HBAR/SOL pool");
    const { botWallet, botFee } = await import("./bot.server");
    const { ethers } = await import("ethers");
    if (await solPoolExists()) throw new Error("This pool already exists — nothing was sent");

    const w = botWallet();
    const acc = await fetch(`${MIRROR_URL}/api/v1/accounts/${w.address}`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const accountId = acc?.account as string | undefined;
    if (!accountId) throw new Error("The bot wallet has no Hedera account id yet");

    const fee = await poolCreateFeeTinybars();
    const price = await solPriceHbar();
    if (!price) throw new Error("No live SOL price right now — try again in a minute");
    const plan = poolPlan({ sol: data.sol, hbarPerSol: price.hbarPerSol, feeTinybars: fee, hbarUsd: await hbarUsd() });

    const held = await balanceOf(accountId, SOL_TOKEN_ID);
    if (held < plan.solUnits)
      throw new Error(
        `The bot holds ${(Number(held) / 10 ** SOL_DECIMALS).toFixed(4)} SOL but the pool needs ${data.sol}. ` +
          `Send SOL to ${accountId} first — nothing was sent.`,
      );
    const hbar = await hbarOf(accountId);
    if (hbar < plan.totalTinybars + RESERVE_TINYBARS)
      throw new Error(
        `This pool needs ${hbarText(plan.totalTinybars)} HBAR (liquidity + creation fee) plus gas. ` +
          `The bot has ${(Number(hbar) / 1e8).toFixed(2)} HBAR — top it up, nothing was sent.`,
      );

    const erc = new ethers.Contract(idToEvm(SOL_TOKEN_ID), [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
    ], w);
    const router = idToEvm(SAUCERSWAP_V1_ROUTER_ID);
    const allowed: bigint = await erc.getFunction("allowance")(w.address, router);
    const feeOpts = await botFee(w);

    if (allowed < plan.solUnits) {
      const tx = await w.sendTransaction({
        to: idToEvm(SOL_TOKEN_ID),
        data: erc.interface.encodeFunctionData("approve", [router, plan.solUnits * 2n]),
        gasLimit: 1_000_000n,
        ...feeOpts,
      });
      await tx.wait();
      return { step: "approved", message: "One-time approval done — tap Create again to open the pool." };
    }

    const tx = await w.sendTransaction({
      to: router,
      data: encodeAddLiquidityETHNewPool({
        solUnits: plan.solUnits,
        amountTokenMin: plan.amountTokenMin,
        amountETHMin: plan.amountETHMin,
        to: w.address,
      }),
      gasLimit: BigInt(3_200_000),
      value: plan.totalTinybars * 10_000_000_000n,
      ...feeOpts,
    });
    const rec = await tx.wait();
    return {
      step: "created",
      message: `Pool created — ${hbarText(plan.totalTinybars)} HBAR used (fee included).`,
      hash: rec?.hash ?? tx.hash,
    };
  });
