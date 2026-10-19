import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionDeadline, openWalletPicker, WalletConnectionCancelled } from "../lib/wallet-connection";

afterEach(() => vi.useRealTimers());

function mockConnector() {
  let listener = (_state: { open: boolean }) => {};
  const unsubscribe = vi.fn();
  const closeModal = vi.fn();
  let approve = () => {};
  let sendUri = () => {};
  const connector = {
    connect: vi.fn((onUri: (uri: string) => void) => new Promise<void>((resolve) => {
      approve = resolve;
      sendUri = () => onUri("wc:test-pairing");
    })),
    walletConnectModal: {
      openModal: vi.fn(async (_options: { uri: string }) => {}),
      subscribeModal: (fn: typeof listener) => { listener = fn; return unsubscribe; },
      closeModal,
    },
  };
  return { connector, uri: () => sendUri(), emit: (open: boolean) => listener({ open }), approve: () => approve(), unsubscribe, closeModal };
}

describe("wallet connection recovery", () => {
  it("releases stalled setup after 20 seconds", async () => {
    vi.useFakeTimers();
    const result = connectionDeadline(new Promise(() => {}), 20_000, "setup timed out");
    const assertion = expect(result).rejects.toThrow("setup timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it("rejects when no picker opens within 30 seconds after pairing and cleans up", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const assertion = expect(openWalletPicker(mock.connector)).rejects.toThrow("couldn't open");
    mock.uri();
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
    expect(mock.closeModal).toHaveBeenCalledOnce();
    expect(mock.connector.connect).toHaveBeenCalledOnce();
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

  it("accepts approval when the SDK closes the picker before its promise resolves", async () => {
    const mock = mockConnector();
    const result = openWalletPicker(mock.connector);
    mock.emit(true);
    // DAppConnector.openModal closes in finally, before its promise settles.
    mock.emit(false);
    mock.approve();
    await expect(result).resolves.toBeUndefined();
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
    expect(mock.closeModal).toHaveBeenCalledOnce();
  });

  it("preserves a wallet rejection when the SDK closes before rejecting", async () => {
    const mock = mockConnector();
    let rejectApproval = (_error: Error) => {};
    mock.connector.connect.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectApproval = reject;
    }));
    const result = openWalletPicker(mock.connector);
    mock.emit(true);
    mock.emit(false);
    rejectApproval(new Error("Wallet rejected connection"));
    await expect(result).rejects.toThrow("Wallet rejected connection");
  });

  it("bounds wallet approval to three minutes without retrying", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const assertion = expect(openWalletPicker(mock.connector)).rejects.toThrow("timed out");
    mock.emit(true);
    await vi.advanceTimersByTimeAsync(180_000);
    await assertion;
    expect(mock.connector.connect).toHaveBeenCalledOnce();
  });

  it("allows a new pairing to take longer than 15 seconds", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const result = openWalletPicker(mock.connector);
    await vi.advanceTimersByTimeAsync(25_000);
    mock.uri();
    expect(mock.connector.walletConnectModal.openModal).toHaveBeenCalledWith({ uri: "wc:test-pairing" });
    mock.emit(true);
    await vi.advanceTimersByTimeAsync(35_000);
    mock.approve();
    await expect(result).resolves.toBeUndefined();
  });

  it("stops a stalled pairing after 45 seconds and ignores its late URI", async () => {
    vi.useFakeTimers();
    const mock = mockConnector();
    const assertion = expect(openWalletPicker(mock.connector)).rejects.toThrow("pairing");
    await vi.advanceTimersByTimeAsync(45_000);
    await assertion;
    mock.uri();
    expect(mock.connector.walletConnectModal.openModal).not.toHaveBeenCalled();
  });
});