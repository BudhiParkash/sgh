import { expect, test } from "@playwright/test";

test.describe("homepage (API unavailable → honest empty states)", () => {
  test("renders hero, empty tournament state, finder state and community links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("LEVEL UP");
    await expect(page.getByRole("heading", { name: "Featured tournaments", exact: true })).toBeVisible();
    await expect(page.getByText("No featured tournaments right now")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find your sensitivity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Join Shivanshi Gaming" })).toBeVisible();
    // Sections without data are hidden, never filled with placeholders
    await expect(page.getByRole("heading", { name: "Latest gaming news" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Popular devices" })).toHaveCount(0);
  });

  test("content is visible without JavaScript", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Join Shivanshi Gaming" })).toBeVisible();
    await ctx.close();
  });

  test("no console errors on load (besides expected API fetch failures)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => !/api\/v1|Failed to load resource/.test(e))).toEqual([]);
  });
});

test.describe("3D progressive enhancement", () => {
  // These tests need 3D enabled (the default test state switches 3D off to reduce load).
  test.use({ storageState: "tests/e2e/helpers/with-3d.json" });
  test("reduced motion keeps the static poster and never creates a canvas", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForTimeout(3000);
    await expect(page.locator("[data-scene-state]").first()).toHaveAttribute("data-scene-state", "poster");
    await expect(page.locator("canvas")).toHaveCount(0);
    await ctx.close();
  });

  test("the 'Reduce 3D effects' switch turns scenes off", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop check");
    await page.goto("/");
    await page.getByRole("switch", { name: "Reduce 3D effects" }).click();
    await expect(page.getByRole("switch", { name: "Reduce 3D effects" })).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await page.waitForTimeout(3000);
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("capable desktop mounts the hero WebGL scene after idle", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones use the poster or a light scene depending on hardware");
    await page.goto("/");
    await expect(page.locator('[data-scene-state="3d"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 }); // 3D chunk is lazy-loaded by design
  });

  test("hero visual reserves its space (no layout shift when the scene mounts)", async ({ page }) => {
    await page.goto("/");
    const before = await page.locator("[data-scene-state]").first().boundingBox();
    await page.waitForTimeout(3500);
    const after = await page.locator("[data-scene-state]").first().boundingBox();
    expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let v = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) v += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => resolve(v), 500);
        }),
    );
    expect(cls).toBeLessThan(0.05);
  });
});

test("below-the-fold cards reveal when scrolled into view", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("heading", { name: "Join Shivanshi Gaming" }).locator("xpath=ancestor::section").locator("[data-reveal]").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-revealed/);
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});
