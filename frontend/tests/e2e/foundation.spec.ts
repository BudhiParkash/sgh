import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { waitForAnimationsToSettle } from "./helpers/settle";

const WIDTHS = [320, 360, 390, 414, 480, 768, 1024, 1440, 1920];
const PAGES = ["/", "/ui-kit"];

test.describe("responsive: no horizontal overflow", () => {
  test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop project sweeps widths");
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      test(`${path} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });
    }
  }
});

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  // Static pass: reduced motion → no 3D, no entrance/reveal transitions → deterministic colours.
  test.use({ reducedMotion: "reduce" });
  for (const path of PAGES) {
    test(`${path} has no detectable violations`, async ({ page }) => {
      await page.goto(path);
      await waitForAnimationsToSettle(page);
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
    });
  }
});

test.describe("with 3D", () => {
  test.use({ storageState: "tests/e2e/helpers/with-3d.json" });
  test("home has no violations with the 3D scene mounted (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop renders the full scene");
  await page.goto("/");
  await page.locator('[data-scene-state="3d"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800); // poster → scene crossfade (700ms)
  await waitForAnimationsToSettle(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
});
});

test("home renders hero copy and CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("LEVEL UP");
  await expect(page.getByRole("link", { name: /Explore Tournaments/ })).toHaveAttribute("href", "/tournaments");
  await expect(page.getByRole("link", { name: "Find Your Sensitivity" })).toHaveAttribute("href", "/sensitivity");
  await expect(page.getByText(/not affiliated with KRAFTON or Tencent Games/).first()).toBeVisible();
});

test("mobile menu opens, lists all main links, and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  for (const label of ["Home", "Tournaments", "Sensitivity", "Gaming Guides", "News", "About Us", "Contact Us"]) {
    await expect(dialog.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await waitForAnimationsToSettle(page); // sheet slide-in finished, as for a real user
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // focus returns to the trigger (Radix focus management)
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("touch targets in header are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const box = await page.getByRole("button", { name: "Open menu" }).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("footer exposes all legal links and the independence disclaimer", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const label of [
    "Privacy Policy",
    "Terms and Conditions",
    "Disclaimer",
    "Cookie Policy",
    "Copyright Policy",
    "Advertising Disclosure",
    "Affiliate Disclosure",
    "Grievance Redressal",
    "Report Content",
    "Contact Us",
  ]) {
    await expect(footer.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
});

test("logo link has a readable accessible name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "SHIVANSHI GAMING HUB" })).toHaveAttribute("href", "/");
});

test("footer shows the contact email and official social links", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "budhiparkash00@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:budhiparkash00@gmail.com",
  );
  const socials = footer.getByRole("list", { name: "Official social channels" });
  const expected: [string, string][] = [
    ["YouTube", "https://www.youtube.com/@ShivanshiGamings"],
    ["Instagram", "https://www.instagram.com/shivanshigaming/"],
    ["Instagram Channel", "https://www.instagram.com/channel/7zFYFMVALxg8FyMh/"],
    ["Facebook", "https://www.facebook.com/profile.php?id=61583809210977"],
  ];
  for (const [name, href] of expected) {
    const link = socials.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
  await expect(socials.getByRole("link")).toHaveCount(expected.length);
});
