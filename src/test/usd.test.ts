import { describe, expect, it } from "vitest";
import { fmtUsd } from "@/lib/usd";

describe("fmtUsd", () => {
  it("shows two decimals for normal amounts", () => {
    expect(fmtUsd(12.5)).toBe("$12.50");
    expect(fmtUsd(1234.567)).toBe("$1,234.57");
  });

  it("shows four decimals when a value is too small for cents", () => {
    expect(fmtUsd(0.0042)).toBe("$0.0042");
  });

  it("keeps zero at two decimals", () => {
    expect(fmtUsd(0)).toBe("$0.00");
  });
});
