import { describe, expect, it, vi } from "vitest";
import { isLongZero, memoMatches, resolveCreatorAlias } from "../lib/token-meta";

describe("token metadata creator resolution", () => {
  it("recognizes long-zero EVM addresses only", () => {
    expect(isLongZero("0x0000000000000000000000000000000000a6bc00")).toBe(true);
    expect(isLongZero("0xd14adf40256c7fdab669ec2a5eee25afaa755392")).toBe(false);
  });

  it("maps a long-zero address to the account alias via the mirror node", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ evm_address: "0xD14aDF40256C7FDab669Ec2a5eEE25aFaa755392" })),
    );
    const alias = await resolveCreatorAlias("0x0000000000000000000000000000000000a6bc00", fetcher);
    expect(alias).toBe("0xd14adf40256c7fdab669ec2a5eee25afaa755392");
    expect(fetcher.mock.calls[0]?.[0]).toContain("/api/v1/accounts/0.0.10927104");
  });

  it("never rewrites alias addresses or failed lookups", async () => {
    expect(await resolveCreatorAlias("0xd14adf40256c7fdab669ec2a5eee25afaa755392")).toBeNull();
    const failing = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    expect(await resolveCreatorAlias("0x0000000000000000000000000000000000a6bc00", failing)).toBeNull();
  });
});
