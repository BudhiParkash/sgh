import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { waitForAnimationsToSettle } from "./helpers/settle";
import { totp } from "./helpers/totp";

const EMAIL = "e2e-root@sgh.test";
const PASSWORD = "E2E-Super-Admin-Passphrase-42";

test.describe.configure({ mode: "serial" });

let context: BrowserContext;
const CONSENT = { cookies: [{ name: "sgh_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, ts: 1 })), domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const }], origins: [] };
let page: Page;
let secret = "";

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ storageState: CONSENT });
  page = await context.newPage();
});
test.afterAll(async () => {
  await context.close();
});

test("unauthenticated /admin redirects to login; login page is accessible", async () => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  expect((await page.request.get("/admin/login")).headers()["x-robots-tag"]).toContain("noindex");
});

test("wrong password shows a generic error", async () => {
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
});

test("super admin must enrol 2FA, then reaches the dashboard", async () => {
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin\/setup-2fa/);
  await page.getByRole("button", { name: "Start setup" }).click();
  secret = (await page.locator("code").first().textContent())!.trim();
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel(/Enter the 6-digit code/).fill(totp(secret));
  await page.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  await expect(page.locator("ul li").filter({ hasText: /^[A-Z0-9]{5}-[A-Z0-9]{5}$/ })).toHaveCount(10);
  await page.getByRole("button", { name: /saved them/ }).click();
  await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
  // real counts: 8 seeded categories
  await expect(page.locator("li", { hasText: "Categories" }).getByText("8", { exact: true })).toBeVisible();
});

test("categories: list → create → edit → validation → trash → restore", async () => {
  await page.getByRole("link", { name: "Categories" }).click();
  await expect(page.getByRole("heading", { name: "Categories", level: 1 })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(9); // header + 8 seeded
  await page.getByRole("link", { name: /New category/ }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Required").first()).toBeVisible(); // client-side validation
  await page.getByLabel("Name").fill("Esports Insights");
  await page.getByLabel("Type").selectOption("guide");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/categories\/[a-f0-9]{24}$/);
  await expect(page.getByLabel("URL slug")).toHaveValue("esports-insights");
  await page.getByLabel("Description", { exact: true }).fill("Analysis of competitive BGMI play.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Category saved")).toBeVisible();
  await page.getByRole("link", { name: "Categories" }).first().click();
  await page.getByRole("row", { name: /Esports Insights/ }).getByRole("button", { name: /Delete/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByText("Category moved to trash")).toBeVisible();
  await page.getByRole("button", { name: "Trash" }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Category restored")).toBeVisible();
});

test("media: upload with alt text and licence", async () => {
  await page.goto("/admin/media");
  await page.getByRole("button", { name: "Upload image" }).click();
  await page.getByLabel(/^Image/).setInputFiles("tests/fixtures/sample.png");
  await page.getByLabel(/Alt text/).fill("SGH hexagon test graphic");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("Image uploaded")).toBeVisible();
  await expect(page.getByText("SGH hexagon test graphic")).toBeVisible();
  await expect(page.getByRole("img", { name: "SGH hexagon test graphic" })).toBeVisible();
});

test("settings: seeded owner values, save grievance address", async () => {
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Contact email")).toHaveValue("budhiparkash00@gmail.com");
  await page.getByLabel("Postal address").fill("Address to be provided before launch");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.getByLabel("Instagram", { exact: true }).fill("http://not-https.example");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Couldn't save settings")).toBeVisible();
});

test("audit log records the session's actions", async () => {
  await page.goto("/admin/audit");
  await expect(page.getByText("category.create").first()).toBeVisible();
  await expect(page.getByText("media.upload").first()).toBeVisible();
  await expect(page.getByText("settings.update").first()).toBeVisible();
});

test("dashboard is accessible and the mobile admin menu works", async () => {
  await page.goto("/admin");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open admin menu" }).click();
  await expect(page.getByRole("dialog", { name: "Admin menu" }).getByRole("link", { name: "Media library" })).toBeVisible();
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("tournament: create rumour → add official source → verify → confirm → publish → public pages", async () => {
  await page.goto("/admin/tournaments/new");
  await page.getByLabel("Tournament name").fill("SGH E2E Invitational");
  await page.getByLabel("Game").selectOption({ label: "BGMI" });
  await page.getByRole("textbox", { name: "Organiser", exact: true }).fill("Example Esports Org");
  await page.getByRole("tab", { name: "Dates & prize" }).click();
  await page.getByLabel("Start (IST)").fill("2030-01-10T18:00");
  await page.getByLabel("End (IST)").fill("2030-01-12T22:00");
  await page.getByLabel("Prize pool (₹)").fill("100000");
  await page.getByRole("tab", { name: "Sources & links" }).click();
  await page.getByLabel("Official announcement URL").fill("https://www.instagram.com/p/sgh-e2e-example/");
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("textbox", { name: "URL", exact: true }).fill("https://www.instagram.com/p/sgh-e2e-example/");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("official");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Organiser announcement post");
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("textbox", { name: "Description", exact: true }).fill("An invitational BGMI event used by the automated end-to-end test. Squads of four, online, free to enter, announced on the organiser's official Instagram.");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/tournaments\/[a-f0-9]{24}$/);

  // confirming without verification is rejected by the server
  await page.getByRole("tab", { name: "Details" }).click();
  await page.getByLabel("Event status").selectOption("confirmed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Record a verification/).first()).toBeVisible();
  await page.reload();

  await page.getByRole("button", { name: "Record verification" }).click();
  await page.getByLabel("What did you check?").fill("Dates and format match the organiser's official post.");
  await page.getByRole("button", { name: "Save verification" }).click();
  await expect(page.getByText("Verification recorded")).toBeVisible();
  await page.getByLabel("Event status").selectOption("confirmed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Tournament saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Done: publish")).toBeVisible();

  // Public site updates immediately (revalidation webhook)
  await page.goto("/tournaments/upcoming");
  await expect(page.getByRole("link", { name: "SGH E2E Invitational" })).toBeVisible();
  await page.getByRole("link", { name: "SGH E2E Invitational" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "SGH E2E Invitational" })).toBeVisible();
  await expect(page.getByText("Not announced / not verified")).toBeVisible(); // unverified prize hidden
  await expect(page.getByText(/Checked against official sources/)).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join(" ")).toContain('"@type":"Event"');
  expect(ld.join(" ")).not.toContain("offers");
  await page.waitForTimeout(800);
  await waitForAnimationsToSettle(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "SGH E2E Invitational" })).toBeVisible(); // homepage featured
  await page.goto("/tournaments/calendar?month=2030-01");
  await expect(page.getByRole("link", { name: "SGH E2E Invitational" }).first()).toBeVisible();
});

test("sensitivity: device → tested setup (spreadsheet paste) → finder exact match → setup page → PNG card", async () => {
  // Device
  await page.goto("/admin/devices/new");
  await page.getByLabel("Brand").fill("SGH Test");
  await page.getByRole("textbox", { name: "Model", exact: true }).fill("X1");
  await page.getByLabel("Display refresh rate (Hz)").fill("120");
  for (const f of ["60 FPS", "90 FPS", "120 FPS"]) await page.getByRole("button", { name: f }).click();
  await page.getByLabel("Spec source URL").fill("https://example.com/specs/x1");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/devices\/[a-f0-9]{24}$/);
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Done: publish")).toBeVisible();

  // Setup
  await page.goto("/admin/sensitivity/new");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("SGH Test X1 — 90 FPS, gyro always on (balanced)");
  await page.getByRole("combobox", { name: "Game", exact: true }).selectOption({ label: "BGMI" });
  await page.getByRole("combobox", { name: "Device", exact: true }).selectOption({ label: "SGH Test X1" });
  await page.getByLabel("Game version").fill("4.1");
  await page.getByRole("tab", { name: "Values" }).click();
  await page.getByRole("button", { name: "Paste from spreadsheet" }).click();
  const rows = Array.from({ length: 9 }, (_, i) => [120 - i * 8, 100 - i * 7, 300 - i * 10, 290 - i * 10].join("\t")).join("\n");
  await page.getByLabel("Values to paste").fill(rows);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("Camera (free look) — 3rd person, no scope")).toHaveValue("120");
  await page.getByRole("tab", { name: "Testing" }).click();
  await page.getByLabel("Tested by (public display name)").fill("Shivanshi");
  await page.getByLabel("Tested on").fill("2026-11-20");
  await page.getByLabel("Device used (model + RAM)").fill("SGH Test X1 (8 GB)");
  await page.getByRole("tab", { name: "Explanation" }).click();
  const words = Array.from({ length: 170 }, (_, i) => `insight${i}`).join(" ");
  await page.getByRole("textbox", { name: /Why these values/ }).fill(words);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/sensitivity\/[a-f0-9]{24}$/);
  await expect(page.getByText("✓ Ready to publish")).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Done: publish")).toBeVisible();

  // Public finder
  await page.goto("/sensitivity");
  await page.getByLabel("Mobile brand").selectOption({ label: "SGH Test" });
  await page.getByLabel("Mobile model").selectOption({ label: "X1" });
  await page.getByText("90", { exact: true }).click();
  await page.getByRole("button", { name: "Show my settings" }).click();
  await expect(page).toHaveURL(/device=sgh-test-x1/);
  await expect(page.getByText(/Exact match for your phone/)).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("120");
  await page.getByRole("link", { name: /Full guide/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("SGH Test X1");
  await expect(page.getByText(/Tested by/).first()).toContainText("Shivanshi");
  const cardHref = await page.getByRole("link", { name: /Download card/ }).getAttribute("href");
  const card = await page.request.get(cardHref!);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/png");
  expect((await card.body()).length).toBeGreaterThan(20_000);
  await page.waitForTimeout(800);
  await waitForAnimationsToSettle(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
  await page.goto("/sensitivity/devices/sgh-test/sgh-test-x1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("SGH Test X1");
});

test("share codes: public submission → moderation → public library", async () => {
  await page.goto("/sensitivity/codes");
  await page.getByLabel("Share code").fill("7001-2233-SGHE-2E01");
  await page.getByLabel("Phone model").fill("SGH Test X1");
  await page.getByLabel("Your display name").fill("E2E Player");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/will appear after our team checks it/)).toBeVisible();
  await page.goto("/admin/sensitivity-codes");
  await page.getByRole("link", { name: "7001-2233-SGHE-2E01", exact: true }).click();
  await page.getByRole("button", { name: "Verify & publish" }).click();
  await expect(page.getByText("Code verified")).toBeVisible();
  await page.goto("/sensitivity/codes");
  await expect(page.getByText("7001-2233-SGHE-2E01")).toBeVisible();
});

test("articles: write in the rich-text editor → publish → news page, article page, search, homepage", async () => {
  await page.goto("/admin/articles/new");
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("BGMI E2E update explained");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("news");
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "BGMI News (news)" });
  await page.getByRole("textbox", { name: /Summary/ }).fill("A plain-English walkthrough of the latest update, written by the automated test.");
  const editor = page.getByRole("textbox", { name: "Content", exact: true });
  await editor.click();
  await page.getByRole("button", { name: "Heading 2" }).click();
  await page.keyboard.type("What changed");
  await page.keyboard.press("Enter");
  await page.keyboard.type(Array.from({ length: 330 }, (_, i) => `detail${i}`).join(" "));
  await expect(page.getByText(/33[0-9] words/)).toBeVisible();
  await page.getByRole("tab", { name: "Details" }).click();
  await page.getByRole("button", { name: "Add source" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Official patch notes");
  await page.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com/patch-notes");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[a-f0-9]{24}$/);
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Done: publish")).toBeVisible();

  await page.goto("/news");
  await page.getByRole("link", { name: "BGMI E2E update explained" }).click();
  await expect(page).toHaveURL(/\/news\/bgmi-news\/bgmi-e2e-update-explained$/);
  await expect(page.getByRole("heading", { level: 2, name: "What changed" })).toHaveAttribute("id", "what-changed");
  await expect(page.getByText("By E2E Root")).toBeVisible();
  await expect(page.getByRole("link", { name: "Official patch notes" })).toBeVisible();
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"@type":"NewsArticle"');
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
  // wrong section → canonical redirect
  await page.goto("/guides/bgmi-news/bgmi-e2e-update-explained");
  await expect(page).toHaveURL(/\/news\/bgmi-news\/bgmi-e2e-update-explained$/);
  await page.goto("/search?q=walkthrough");
  await expect(page.getByRole("link", { name: "BGMI E2E update explained" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Latest gaming news" })).toBeVisible();
});

test("legal: publish a drafted policy (staging allows with warnings) → public page shows settings values and placeholders", async () => {
  await page.goto("/admin/legal");
  await page.getByRole("link", { name: "Privacy Policy", exact: true }).click();
  await expect(page.getByText(/Not yet marked as reviewed by qualified legal counsel/)).toBeVisible();
  await expect(page.getByText("{{grievanceOfficer.address}}", { exact: true })).toBeVisible(); // tokens panel
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Done: publish")).toBeVisible();
  await page.goto("/legal/privacy-policy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("Budhi Parkash").first()).toBeVisible();
  await expect(page.getByText("Version 1")).toBeVisible();
});

test("public forms: contact, report (ticket) and feedback reach the admin inboxes", async () => {
  await page.goto("/contact");
  await page.getByRole("textbox", { name: "Your name", exact: true }).fill("Asha Tester");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("asha@example.com");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hello! Is there a BGMI tournament for college teams?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please agree so we can reply to you")).toBeVisible(); // consent required
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/we'll reply by email/)).toBeVisible();

  await page.goto("/report?url=/tournaments/sgh-e2e-invitational");
  await expect(page.getByLabel("Page on this website")).toHaveValue("/tournaments/sgh-e2e-invitational");
  await page.getByLabel("Describe the problem").fill("The registration deadline shown here differs from the organiser's post.");
  await page.getByRole("textbox", { name: "Your name", exact: true }).fill("Ravi Tester");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ravi@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByText(/SGH-\d{4}-\d{6}/)).toBeVisible();

  await page.goto("/sensitivity/sgh-test-x1-90-fps-gyro-always-on-balanced");
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks for the feedback.")).toBeVisible();

  await page.goto("/admin/enquiries");
  await expect(page.getByRole("link", { name: "Asha Tester", exact: true })).toBeVisible();
  await page.goto("/admin/reports");
  await page.getByRole("link", { name: /SGH-\d{4}/ }).first().click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9]{24}$/); // the list page also has a "Status" filter
  await page.getByLabel("Status").selectOption("resolved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Add a resolution note/).first()).toBeVisible();
  await page.getByLabel(/Resolution/).fill("Deadline corrected against the organiser's post.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Report saved")).toBeVisible();
  await page.goto("/admin/feedback");
  await expect(page.getByRole("cell", { name: "sgh-test-x1-90-fps-gyro-always-on-balanced" })).toBeVisible();
});

test("retention: follow + save → My saved (header badge), calendar reminder, share, unfollow", async () => {
  await page.goto("/tournaments/sgh-e2e-invitational");
  await page.getByRole("button", { name: "Follow" }).click();
  await expect(page.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "My saved (1)" })).toBeVisible();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  const ics = await page.request.get("/tournaments/sgh-e2e-invitational/calendar.ics");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const body = await ics.text();
  expect(body).toContain("BEGIN:VEVENT");
  expect(body).toContain("SGH E2E Invitational");

  await page.goto("/sensitivity/sgh-test-x1-90-fps-gyro-always-on-balanced");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("link", { name: "My saved (2)" })).toBeVisible();

  await page.getByRole("link", { name: "My saved (2)" }).click();
  await expect(page.getByRole("heading", { name: "Followed tournaments" })).toBeVisible();
  await expect(page.getByRole("link", { name: "SGH E2E Invitational" })).toBeVisible();
  await expect(page.getByRole("link", { name: /SGH Test X1/ })).toBeVisible();
  await waitForAnimationsToSettle(page); // client-side navigation fades the page in
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
  await page.getByRole("button", { name: "Unfollow SGH E2E Invitational" }).click();
  await expect(page.getByRole("link", { name: "My saved (1)" })).toBeVisible();
  // persists across reloads (stored on the device)
  await page.reload();
  await expect(page.getByRole("link", { name: /SGH Test X1/ })).toBeVisible();
});

test("installable app: manifest, icons, service worker; visited pages work offline", async () => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  const icon = await page.request.get("/icons/512");
  expect(icon.headers()["content-type"]).toContain("image/png");
  await page.goto("/sensitivity/sgh-test-x1-90-fps-gyro-always-on-balanced");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker → page cached
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("SGH Test X1");
    await page.goto("/news/never-visited-category");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("service worker keeps redirects working (old URLs → new URLs)", async () => {
  await page.goto("/news");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.goto("/guides/bgmi-news/bgmi-e2e-update-explained");
  await expect(page).toHaveURL(/\/news\/bgmi-news\/bgmi-e2e-update-explained$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BGMI E2E update explained");
});

test("SEO: published content appears in sitemaps; managed redirects (301/410) work live; audit page", async () => {
  const arts = await (await page.request.get("/sitemaps/articles.xml")).text();
  expect(arts).toContain("/news/bgmi-news/bgmi-e2e-update-explained");
  const tours = await (await page.request.get("/sitemaps/tournaments.xml")).text();
  expect(tours).toContain("/tournaments/sgh-e2e-invitational");
  const sens = await (await page.request.get("/sitemaps/sensitivity.xml")).text();
  expect(sens).toContain("/sensitivity/sgh-test-x1-90-fps-gyro-always-on-balanced");

  await page.goto("/admin/redirects/new");
  await page.getByRole("textbox", { name: "From path", exact: true }).fill("/old-e2e-page");
  await page.getByRole("textbox", { name: /To \(path/ }).fill("/tournaments/upcoming");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/redirects\/[a-f0-9]{24}$/);
  await page.goto("/admin/redirects/new");
  await page.getByRole("textbox", { name: "From path", exact: true }).fill("/removed-e2e-page");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("410");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/redirects\/[a-f0-9]{24}$/);
  await expect.poll(async () => (await page.request.get("/old-e2e-page", { maxRedirects: 0 })).status(), { timeout: 70_000, intervals: [2000] }).toBe(301);
  expect((await page.request.get("/old-e2e-page", { maxRedirects: 0 })).headers().location).toMatch(/\/tournaments\/upcoming$/);
  expect((await page.request.get("/removed-e2e-page", { maxRedirects: 0 })).status()).toBe(410);

  await page.goto("/admin/seo");
  await expect(page.getByRole("heading", { name: "SEO audit" })).toBeVisible();
  await expect(page.getByRole("link", { name: "articles" })).toBeVisible();
});

test("sign out ends the session", async () => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/login/);
});
