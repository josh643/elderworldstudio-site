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
    expect(text).toContain("first 10 shops");
    expect(text).toContain("MEMPHIS249");
    expect(text).toContain("Custom domain available");
    expect(text).toContain("Already have hosting? Take it with you: $99 one time.");
    expect(text).toContain("No monthly fee; edits and support not included.");
    await expect(page.locator("#faq-take-it")).toContainText("Take it with you");
    expect(text).toMatch(/not a template/i);
    await expect(page).toHaveTitle(/AI Web Builder/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://elderworldstudio.com/build/");
  });

  test("has no markup math, client names, Stripe embeds or extra ad scripts", async ({ page }) => {
    await open(page);
    const html = await page.content();
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(MARKUP);
    expect(html).not.toMatch(CLIENT_NAMES);
    expect(html).not.toMatch(/stripe\.com|googletagmanager|fbq\(|gtag\(/i);
  });

  test("structured data lists the three tiers as Product/Offer", async ({ page }) => {
    await open(page);
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw);
    const prices = data.filter((d) => d["@type"] === "Product").map((d) => d.offers.price);
    expect(prices).toEqual(["349", "699", "1299"]);
  });

  test("plan CTAs replace the reservation form and the launch code is shown", async ({ page }) => {
    await open(page);
    await expect(page.locator("#build-form")).toHaveCount(0);
    await expect(page.locator(".launch-offer")).toContainText("MEMPHIS249");
    await expect(page.locator('[data-tier="starter"] a[data-plan="Starter"]')).toBeVisible();
  });

  test("mobile: no overflow, hamburger works, 44px tap targets", async ({ page }) => {
    await open(page, { width: 360, height: 740 });
    const audit = await layoutAudit(page);
    expect(audit.docW).toBeLessThanOrEqual(audit.vw + 1);
    expect(audit.overflowing).toEqual([]);
    await expect(page.locator(".nav-toggle")).toBeVisible();
    for (const el of await page.locator(".tier .btn, .nav-toggle").all()) {
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
    await expect(page.locator("#in-action h2")).toHaveText(/See it in action/i);
    await expect(page.locator('#in-action iframe[title="Agent OS demo"]')).toHaveAttribute("src", /\/embed\/_2jDV6lu-2k/);
    await expect(page.locator('#in-action iframe[title="EWS Kiosk OS demo"]')).toHaveAttribute("src", /\/embed\/iNfnsQ5NIK0/);
    for (const frame of await page.locator("#in-action iframe").all()) {
      await expect(frame).toHaveAttribute("loading", "lazy");
    }
  });

  test("merch lists our shops without client names", async ({ page }) => {
    await blockAds(page);
    await page.goto("/merch/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#shops h2")).toHaveText(/Our shops/i);
    const html = await page.content();
    expect(html).not.toMatch(CLIENT_NAMES);
    for (const host of ["bluffcitymade.com", "riverbendtackle.com", "thirdshotgoods.com"]) {
      await expect(page.locator(`#shops a[href="https://${host}"]`)).toBeVisible();
    }
  });

  test("sitemap lists /build/ and /services/", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("https://elderworldstudio.com/build/");
    expect(sm).toContain("https://elderworldstudio.com/services/");
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
  });
});
