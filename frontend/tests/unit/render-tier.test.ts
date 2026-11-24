import { describe, expect, it } from "vitest";
import { detectTier } from "@/components/3d/use-render-tier";

const base = { reducedMotion: false, saveData: false, userReduced: false, webgl: true, deviceMemory: 8, cores: 8, coarsePointer: false, width: 1440 };

describe("detectTier", () => {
  it("high on capable desktop", () => expect(detectTier(base)).toBe("high"));
  it("none when reduced motion, save-data, user opt-out or no WebGL", () => {
    expect(detectTier({ ...base, reducedMotion: true })).toBe("none");
    expect(detectTier({ ...base, saveData: true })).toBe("none");
    expect(detectTier({ ...base, userReduced: true })).toBe("none");
    expect(detectTier({ ...base, webgl: false })).toBe("none");
  });
  it("low on typical mid-range phone, medium on flagship phone", () => {
    expect(detectTier({ ...base, coarsePointer: true, width: 390, deviceMemory: 4, cores: 8 })).toBe("low");
    expect(detectTier({ ...base, coarsePointer: true, width: 390, deviceMemory: 8, cores: 8 })).toBe("medium");
  });
  it("none on very weak hardware", () => expect(detectTier({ ...base, deviceMemory: 2 })).toBe("none"));
  it("medium on tablets", () => expect(detectTier({ ...base, coarsePointer: true, width: 1024 })).toBe("medium"));
});
