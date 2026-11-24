import { describe, expect, it } from "vitest";
import { formatDate, formatDateRange, formatINR, formatRelative } from "@/lib/format";

describe("format", () => {
  it("formats dates in IST", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India
    expect(formatDate("2026-12-31T20:00:00Z")).toBe("1 Jan 2027");
  });
  it("returns null for missing dates (never invents)", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDateRange(null, null)).toBeNull();
  });
  it("formats INR with Indian grouping", () => expect(formatINR(1500000)).toBe("₹15,00,000"));
  it("relative verification time", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    expect(formatRelative("2026-11-21T12:00:00Z", now)).toBe("2 days ago");
  });
});
