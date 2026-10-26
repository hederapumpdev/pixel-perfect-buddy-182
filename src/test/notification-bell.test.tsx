import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/NotificationBell";
import { NOTIF_SESSION_KEY } from "@/lib/notifications";

// The bell reads the connected wallet and its stored session, so both are steered from here.
const { state } = vi.hoisted(() => ({ state: { accountId: "0.0.10927104" as string | null } }));

// Link needs a router context the header never has on its own.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: unknown; className?: string }) => <div className={className}>{children}</div>,
}));

// Server calls would leave the test; each one answers from fixed rows instead.
vi.mock("@tanstack/react-start", () => ({
  useServerFn: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ accountId: state.accountId, signText: async () => ({}) }),
}));

vi.mock("@/components/ProfileEditor", () => ({
  Avatar: () => <span data-testid="avatar" />,
  useProfiles: () => ({ "0.0.5": { name: "Alice", avatar: null } }),
}));

const FOLLOWER_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "new_follower",
  actor: "0.0.5",
  token: null,
  symbol: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  read_at: null,
};

vi.mock("@/lib/notifications.functions", () => ({
  getNotifications: async () => ({ rows: [{ ...FOLLOWER_ROW }], unread: 1 }),
  markNotificationsRead: async () => ({ ok: true }),
  getNotificationPrefs: async () => [{ kind: "comment", enabled: false }],
  setNotificationPref: async () => ({ ok: true }),
  loginNotifications: async () => ({ token: "a".repeat(64), expiresAt: new Date(Date.now() + 86_400_000).toISOString() }),
}));

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

function useSession() {
  localStorage.setItem(
    NOTIF_SESSION_KEY,
    JSON.stringify({ token: "a".repeat(64), account: "0.0.10927104", expiresAt: new Date(Date.now() + 86_400_000).toISOString() }),
  );
}

beforeEach(() => {
  localStorage.clear();
  state.accountId = "0.0.10927104";
});

describe("the header bell", () => {
  it("is missing for a signed-out visitor", () => {
    state.accountId = null;
    renderBell();
    expect(screen.queryByLabelText(/notifications/i)).toBeNull();
  });

  it("counts what nobody has opened yet", async () => {
    useSession();
    renderBell();
    await waitFor(() => expect(screen.getByLabelText("1 unread notifications")).toHaveTextContent("1"));
  });

  it("shows who followed and when", async () => {
    useSession();
    renderBell();
    fireEvent.click(await screen.findByLabelText("1 unread notifications"));
    expect(await screen.findByText("started following you")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });

  it("asks for one signature before it can show anything", async () => {
    renderBell();
    fireEvent.click(await screen.findByLabelText("Notifications"));
    expect(await screen.findByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
  });

  it("lists every notice type with the one the wallet switched off left off", async () => {
    useSession();
    renderBell();
    fireEvent.click(await screen.findByLabelText("1 unread notifications"));
    fireEvent.click(await screen.findByLabelText("Notification settings"));
    expect(await screen.findByText("New follower")).toBeInTheDocument();
    expect(screen.getByText("Someone I follow bought")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Comment on my coin" })).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByRole("switch", { name: "New follower" })).toHaveAttribute("aria-checked", "true");
  });
});
