import { describe, expect, it } from "vitest";
import { httpsUrlSchema, slugify, slugSchema } from "./common";

describe("slugify", () => {
  it("creates clean slugs", () => {
    expect(slugify("BGMI 90 FPS Sensitivity — iQOO Neo 9 Pro!")).toBe("bgmi-90-fps-sensitivity-iqoo-neo-9-pro");
  });
  it("output always passes slugSchema", () => {
    for (const s of ["  Hello  World  ", "M416 / AKM", "Ünïcödé tëxt"]) {
      expect(slugSchema.safeParse(slugify(s)).success).toBe(true);
    }
  });
});

describe("httpsUrlSchema", () => {
  it("rejects http and javascript urls", () => {
    expect(httpsUrlSchema.safeParse("http://example.com").success).toBe(false);
    expect(httpsUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpsUrlSchema.safeParse("https://www.instagram.com/reel/abc/").success).toBe(true);
  });
});
