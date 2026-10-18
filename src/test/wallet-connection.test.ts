import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionDeadline, openWalletPicker, WalletConnectionCancelled } from "../lib/wallet-connection";

afterEach(() => vi.useRealTimers());

function mockConnector() {
  let listener = (_state: { open: boolean }) => {};
  const unsubscribe = vi.fn();
  const closeModal = vi.fn();
  let approve = () => {};
  const connector = {
    openModal: vi.fn(() => new Promise<void>((resolve) => { approve = resolve; })),
    walletConnectModal: {
      subscribeModal: (fn: typeof listener) => { listener = fn; return unsubscribe; },
      closeModal,
    },
  };
  return { connector, emit: (open: boolean) => listener({ open }), approve: () => approve(), unsubscribe, closeModal };
}

describe("wallet connection recovery", () => {
  it("releases stalled setup after 20 seconds", async () => {
    vi.useFakeTimers();
    const result = connectionDeadline(new Promise(() => {}), 20_000, "setup timed out");
    const assertion = expect(result).rejects.toThrow("setup timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it("rejects when no picker opens within 15 seconds and cleans up", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const assertion = expect(openWalletPicker(mock.connector)).rejects.toThrow("couldn't open");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
    expect(mock.closeModal).toHaveBeenCalledOnce();
    expect(mock.connector.openModal).toHaveBeenCalledOnce();
  });

  it("allows approval after the opening timeout when picker is visible", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const result = openWalletPicker(mock.connector);
    mock.emit(true);
    await vi.advanceTimersByTimeAsync(30_000);
    mock.approve();
    await expect(result).resolves.toBeUndefined();
  });

  it("cancels immediately when the user closes the picker", async () => {
    const mock = mockConnector();
    const result = openWalletPicker(mock.connector);
    mock.emit(true);
    mock.emit(false);
    await expect(result).rejects.toBeInstanceOf(WalletConnectionCancelled);
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
  });

  it("bounds wallet approval to three minutes without retrying", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const assertion = expect(openWalletPicker(mock.connector)).rejects.toThrow("timed out");
    mock.emit(true);
    await vi.advanceTimersByTimeAsync(180_000);
    await assertion;
    expect(mock.connector.openModal).toHaveBeenCalledOnce();
  });
});