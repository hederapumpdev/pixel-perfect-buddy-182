import { describe, expect, it } from "vitest";
import { profileWalletAddress } from "@/lib/profile-wallets";

describe("wallet profile matching", () => {
  it("matches a Hedera holder ID to its long-zero profile address", () => {
    expect(profileWalletAddress("0.0.10923241")).toBe("0x0000000000000000000000000000000000a6ace9");
  });
  it("normalizes EVM wallets without changing their identity", () => {
    expect(profileWalletAddress(" 0xD14aDF40256C7FDab669Ec2a5eEE25aFaa755392 ")).toBe("0xd14adf40256c7fdab669ec2a5eee25afaa755392");
  });
});