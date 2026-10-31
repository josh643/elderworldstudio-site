const { test, expect } = require("@playwright/test");
const { SMS_CONSENT, blockAds, layoutAudit } = require("./helpers");

const PRICES = ["$349", "$19/mo", "$699", "$39/mo", "$1,299", "$69/mo", "$249"];
const CLIENT_NAMES = /marlon|cap\s*bar/i;
const MARKUP = /markup|mark-up|margin|wholesale|our cost|cost\s*[x×*+]|\b\d(\.\d+)?\s*[x×]\s*(cost|price)/i;

async function open(page, vp) {
  await blockAds(page);
  await page.route("**/challenges.cloudflare.com/**", (r) => r.abort());
  if (vp) await page.setViewportSize(vp);
  const resp = await page.goto("/build/", { waitUntil: "domcontentloaded" });
  expect(resp && resp.ok()).toBeTruthy();
}

test.describe("/build/ web builder page", () => {
  test("shows the three flat tier prices, launch offer and domain line", async ({ page }) => {
    await open(page);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const p of PRICES) expect(text, `missing ${p}`).toContain(p);
    for (const tier of ["Starter", "Business", "Plus"]) await expect(page.locator(`[data-tier="${tier.toLowerCase()}"]`)).toBeVisible();
    expect(text).toContain("first 10 Memphis shops");
    expect(text).toContain("Custom domain available");
    expect(text).toContain("Already have hosting? Take it with you: $99 one time.");
    expect(text).toContain("No monthly fee; edits and support not included.");
    await expect(page.locator("#faq-take-it")).toContainText("Take it with you");
    expect(text).toMatch(/not a template/i);
    await expect(page).toHaveTitle(/AI Web Builder/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elderworldstudio.com/build/");
  });

  test("has no markup math, client names, checkout or extra ad scripts", async ({ page }) => {
    await open(page);
    const html = await page.content();
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(MARKUP);
    expect(html).not.toMatch(CLIENT_NAMES);
    expect(html).not.toMatch(/checkout|stripe\.com|googletagmanager|fbq\(|gtag\(/i);
  });

  test("structured data lists the three tiers as Product/Offer", async ({ page }) => {
    await open(page);
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw);
    const prices = data.filter((d) => d["@type"] === "Product").map((d) => d.offers.price);
    expect(prices).toEqual(["349", "699", "1299"]);
  });

  test("CTA leads to the lead form, which submits type web-builder to /api/lead", async ({ page }) => {
    await open(page);
    let posted = null;
    await page.route("**/api/lead", async (route) => {
      posted = route.request().postData() || "";
      await route.fulfill({ status: 303, headers: { Location: "/build/?sent=1#reserve" } });
    });
    await page.locator('[data-tier="business"] a', { hasText: "Reserve your spot" }).click();
    await expect(page.locator("#plan-select")).toHaveValue(/^Business/);
    const form = page.locator("#build-form");
    await expect(form).toHaveAttribute("action", "/api/lead");
    await form.locator('[name="name"]').fill("Test Person");
    await form.locator('[name="email"]').fill("test@example.com");
    await form.locator('[name="business"]').fill("Test Shop");
    await form.locator('[name="description"]').fill("A small test shop.");
    await form.locator('button[type="submit"]', { hasText: "Get started" }).click();
    await expect.poll(() => posted).not.toBeNull();
    const f = new URLSearchParams(posted);
    expect(f.get("type")).toBe("web-builder");
    expect(f.get("business")).toBe("Test Shop");
    expect(f.get("return_to")).toBe("/build/");
    expect(f.get("budget")).toMatch(/^Business/);
    await expect(page.locator("#form-status")).toContainText("Thanks");
  });

  test("SMS consent wording matches the approved text", async ({ page }) => {
    await open(page);
    const text = (await page.locator(".sms-opt span").innerText()).replace(/\s+/g, " ").trim();
    expect(text.startsWith(SMS_CONSENT)).toBeTruthy();
  });

  test("mobile: no overflow, hamburger works, 44px tap targets", async ({ page }) => {
    await open(page, { width: 360, height: 740 });
    const audit = await layoutAudit(page);
    expect(audit.docW).toBeLessThanOrEqual(audit.vw + 1);
    expect(audit.overflowing).toEqual([]);
    await expect(page.locator(".nav-toggle")).toBeVisible();
    for (const el of await page.locator(".tier .btn, #build-form button[type=submit], .nav-toggle").all()) {
      const b = await el.boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator(".nav-toggle").click();
    await expect(page.locator('#site-nav a[href$="services/index.html"]')).toBeVisible();
    await expect(page.locator('#site-nav a.nav-cta')).toBeVisible();
  });
});

test.describe("site-wide repositioning", () => {
  test("homepage is repositioned and links to /build/", async ({ page }) => {
    await blockAds(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toHaveText(/AI websites, receptionists and shop systems for local businesses/i);
    await expect(page).toHaveTitle(/Local Businesses/);
    await expect(page.locator('a[href="build/index.html"]').first()).toBeVisible();
    const svc = await page.locator("#services").innerText();
    for (const w of ["web builder", "POS", "Kiosk", "receptionist", "Asset packs", "Merch"]) {
      expect(svc.toLowerCase()).toContain(w.toLowerCase());
    }
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld["@graph"].map((x) => x["@type"])).toEqual(["Organization", "LocalBusiness"]);
  });

  test("sitemap lists /build/ and /services/", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("https://elderworldstudio.com/build/");
    expect(sm).toContain("https://elderworldstudio.com/services/");
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  });
});
