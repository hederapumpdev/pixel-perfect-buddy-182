import { describe, expect, it } from "vitest";
import { staffAllocationAllowed, staffClaimable, staffEarned } from "@/lib/staff";

describe("staff fee share", () => {
  it("default: each staff member gets 5% of the platform's 70% share", () => {
    expect(staffEarned(100)).toBeCloseTo(3.5);
  });
  it("four staff at default together get 20% of the platform share", () => {
    expect(staffEarned(100) * 4).toBeCloseTo(14);
  });
  it("a custom % applies to the platform share", () => {
    expect(staffEarned(100, 10)).toBeCloseTo(7);
  });
  it("claimable subtracts what was already paid and never goes negative", () => {
    expect(staffClaimable(3.5, 1)).toBeCloseTo(2.5);
    expect(staffClaimable(1, 2)).toBe(0);
  });
  it("allows more than four staff within the shared 20% cap", () => {
    expect(staffAllocationAllowed([3, 3, 3, 3, 3], 5)).toBe(true);
  });
  it("rejects a combined allocation above 20%", () => {
    expect(staffAllocationAllowed([5, 5, 5], 5.01)).toBe(false);
  });
  it("allows adjusting a member within the remaining allocation", () => {
    expect(staffAllocationAllowed([8, 7], 5)).toBe(true);
    expect(staffAllocationAllowed([8, 7], 6)).toBe(false);
  });
  it("allows zero allocation when the shared pot is fully allocated", () => {
    expect(staffAllocationAllowed([10, 10], 0)).toBe(true);
  });
  it("rejects invalid percentages", () => {
    expect(staffAllocationAllowed([], NaN)).toBe(false);
    expect(staffAllocationAllowed([], Infinity)).toBe(false);
    expect(staffAllocationAllowed([], -1)).toBe(false);
  });
});
