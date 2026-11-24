import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("consent banner: equal choices, reject stores choice, no analytics, settings can be reopened", async ({ page }) => {
  const gaRequests: string[] = [];
  page.on("request", (r) => r.url().includes("googletagmanager") && gaRequests.push(r.url()));
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookies" });
  await expect(banner).toBeVisible();
  const reject = banner.getByRole("button", { name: "Reject all" });
  const accept = banner.getByRole("button", { name: "Accept all" });
  // Same visual weight: identical size class (no dark patterns)
  expect(await reject.getAttribute("class")).toBe(await accept.getAttribute("class"));
  await reject.click();
  await expect(banner).toBeHidden();
  const cookie = (await page.context().cookies()).find((c) => c.name === "sgh_consent");
  expect(decodeURIComponent(cookie!.value)).toContain('"analytics":false');
  await page.reload();
  await expect(page.getByRole("region", { name: "Cookies" })).toBeHidden();
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("dialog", { name: "Cookie settings" })).toBeVisible();
  expect(gaRequests).toEqual([]);
});

test("production CSP header is present and strict on framing/plugins", async ({ page }) => {
  const res = await page.goto("/");
  const csp = res!.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
});
