const { test, expect } = require("@playwright/test");
const { PRODUCT_ROUTES, SMS_CONSENT, blockAds, layoutAudit } = require("./helpers");

const CLIENT_NAMES = /marlon|cap\s*bar/i;

test.describe("product routes", () => {
  for (const route of PRODUCT_ROUTES) {
    test(`${route.path} returns 200 with unique title, canonical, viewport and no phone overflow`, async ({ page }) => {
      await blockAds(page);
      await page.setViewportSize({ width: 412, height: 915 });
      const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(resp && resp.status(), route.path).toBe(200);
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", route.canonical);
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", await page.title());
      const audit = await layoutAudit(page);
      expect(audit.vpContent).toMatch(/width\s*=\s*device-width/i);
      expect(audit.docW, `${route.path} scrollWidth ${audit.docW} > ${audit.vw}`).toBeLessThanOrEqual(audit.vw + 1);
      expect(audit.overflowing).toEqual([]);
    });
  }

  test("product titles are unique", async ({ page }) => {
    await blockAds(page);
    const seen = new Set();
    for (const route of PRODUCT_ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      expect(seen.has(title), `duplicate title: ${title}`).toBeFalsy();
      seen.add(title);
    }
  });

  test("nav links resolve from /services/", async ({ page }) => {
    await blockAds(page);
    await page.goto("/services/", { waitUntil: "domcontentloaded" });
    const hrefs = await page.locator("#site-nav a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs.join(" ")).toMatch(/services/);
    expect(hrefs.join(" ")).toMatch(/demo/);
    for (const href of hrefs) {
      const url = new URL(href, "http://127.0.0.1:8765/services/");
      const resp = await page.request.get(url.pathname);
      expect(resp.ok(), href).toBeTruthy();
    }
  });

  test("/services/#request is a JS-free link to the demo form", async ({ page }) => {
    await blockAds(page);
    await page.goto("/services/#request", { waitUntil: "domcontentloaded" });
    const request = page.locator("#request");
    await expect(request).toBeVisible();
    await expect(page.locator('#request a[href*="demo"][href*="request"]')).toBeVisible();
  });

  test("/demo/ form posts and redirects to /demo/?sent=1", async ({ page }) => {
    await blockAds(page);
    await page.route("**/challenges.cloudflare.com/**", (r) => r.abort());
    let posted = null;
    await page.route("**/api/lead", async (route) => {
      posted = route.request().postData() || "";
      await route.fulfill({ status: 303, headers: { Location: "/demo/?sent=1#request" } });
    });
    await page.goto("/demo/?type=POS", { waitUntil: "domcontentloaded" });
    await expect(page.locator('.lead-form [name="type"]')).toHaveValue("POS");
    const form = page.locator(".lead-form");
    await expect(form).toHaveAttribute("action", "/api/lead");
    await form.locator('[name="name"]').fill("Test Person");
    await form.locator('[name="email"]').fill("test@example.com");
    await form.locator('[name="business"]').fill("Test Shop");
    await form.locator('[name="description"]').fill("A small test shop.");
    await form.locator('button[type="submit"]').click();
    await expect.poll(() => posted).not.toBeNull();
    const f = new URLSearchParams(posted);
    expect(f.get("type")).toBe("POS");
    expect(f.get("return_to")).toBe("/demo/");
    expect(f.get("website_url")).toBe("");
    expect(page.url()).toMatch(/\/demo\/\?sent=1/);
    await expect(page.locator("#form-status")).toContainText("Thanks");
  });

  test("SMS consent wording on /demo/ is unchanged", async ({ page }) => {
    await blockAds(page);
    await page.goto("/demo/", { waitUntil: "domcontentloaded" });
    const text = (await page.locator(".sms-opt span").innerText()).replace(/\s+/g, " ").trim();
    expect(text.startsWith(SMS_CONSENT)).toBeTruthy();
  });

  test("/websites/ has approved prices and links to /build/", async ({ page }) => {
    await blockAds(page);
    await page.goto("/websites/", { waitUntil: "domcontentloaded" });
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const p of ["$349", "$19/mo", "$699", "$39/mo", "$1,299", "$69/mo", "$249"]) {
      expect(text, `missing ${p}`).toContain(p);
    }
    await expect(page.locator('a[href$="build/index.html"]').first()).toBeVisible();
    expect(text).toContain("Already have hosting? Take it with you: $99 one time.");
    expect(text).toContain("No monthly fee; edits and support not included.");
    await expect(page.locator("#faq-take-it")).toContainText("Take it with you");
    expect(text).not.toMatch(/markup|mark-up|wholesale|our cost/i);
  });

  test("/demo/ offers Take it with you as a request type", async ({ page }) => {
    await blockAds(page);
    await page.goto("/demo/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('.lead-form [name="type"] option', { hasText: "Take it with you" })).toHaveCount(1);
  });

  test("no client names on public product pages", async ({ request }) => {
    for (const route of PRODUCT_ROUTES) {
      expect(await (await request.get(route.path)).text(), route.path).not.toMatch(CLIENT_NAMES);
    }
  });

  test("sitemap lists every product route with lastmod 2026-10-31", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    for (const route of PRODUCT_ROUTES) {
      expect(sm).toContain(`https://elderworldstudio.com${route.path}`);
    }
    expect(sm).toContain("<lastmod>2026-10-31</lastmod>");
  });

  test("_headers CSP report-only allows youtube-nocookie frame-src", async ({ request }) => {
    const raw = require("node:fs").readFileSync("site/_headers", "utf8");
    expect(raw).toMatch(/frame-src[^;]*youtube-nocookie\.com/);
  });
});
