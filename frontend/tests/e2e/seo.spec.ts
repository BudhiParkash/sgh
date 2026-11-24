import { expect, test } from "@playwright/test";

test("robots.txt blocks crawling outside production; sitemap index lists all sitemaps", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \//); // staging/local must never be indexed
  const idx = await request.get("/sitemap.xml");
  expect(idx.headers()["content-type"]).toContain("application/xml");
  const xml = await idx.text();
  for (const t of ["pages", "tournaments", "sensitivity", "devices", "articles"]) expect(xml).toContain(`/sitemaps/${t}.xml`);
  const pages = await (await request.get("/sitemaps/pages.xml")).text();
  expect(pages).toContain("<loc>");
  expect((await request.get("/sitemaps/nope.xml")).status()).toBe(404);
});

test("homepage has Organization + WebSite JSON-LD and a canonical URL", async ({ page }) => {
  await page.goto("/");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"@type":"Organization"');
  expect(ld).toContain('"@type":"WebSite"');
  expect(ld).toContain("youtube.com/@ShivanshiGamings");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/shivanshigaming\.com\/?$/);
});

test("llms.txt summarises the site", async ({ request }) => {
  const r = await request.get("/llms.txt");
  expect(r.headers()["content-type"]).toContain("text/plain");
  const t = await r.text();
  expect(t).toContain("# Shivanshi Gaming Hub");
  expect(t).toContain("## How information is verified");
});
