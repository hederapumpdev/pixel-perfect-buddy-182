import { describe, expect, it } from "vitest";
import { STAFF_MAX, staffClaimable, staffEarned } from "@/lib/staff";

describe("staff fee share", () => {
  it("each staff member gets 5% of the platform's 70% share", () => {
    expect(staffEarned(100)).toBeCloseTo(3.5);
  });
  it("four staff together get 20% of the platform share", () => {
    expect(staffEarned(100) * STAFF_MAX).toBeCloseTo(14);
  });
  it("claimable subtracts what was already paid and never goes negative", () => {
    expect(staffClaimable(3.5, 1)).toBeCloseTo(2.5);
    expect(staffClaimable(1, 2)).toBe(0);
  });
});
