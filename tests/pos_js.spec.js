const { test, expect } = require("@playwright/test");
const { blockAds } = require("./helpers");
const { classifyBrowserMessage, isJsException, hrefLooksLikeTemplateLeftover } = require("./console_classify.js");

test.describe("pos phone JS and public link check", () => {
  test("/pos/ phone has no JS pageerror; report-only CSP is classified separately", async ({ page }) => {
    await blockAds(page);
    const buckets = { pageerror: [], "console-error": [], "report-only-warning": [], "console-warning": [], other: [] };
    page.on("pageerror", (e) => {
      const kind = classifyBrowserMessage({ source: "pageerror", text: String(e.message || e) });
      buckets[kind].push(String(e.message || e));
    });
    page.on("console", (msg) => {
      const kind = classifyBrowserMessage({ source: "console", type: msg.type(), text: msg.text() });
      if (!buckets[kind]) buckets.other.push(msg.text());
      else buckets[kind].push(msg.text());
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const resp = await page.goto("/pos/", { waitUntil: "domcontentloaded" });
    expect(resp && resp.status()).toBe(200);
    await page.waitForTimeout(500);
    expect(buckets.pageerror, buckets.pageerror.join("\n")).toEqual([]);
    expect(buckets.pageerror.every((t) => isJsException("pageerror"))).toBeTruthy();
    // Local static server does not send Cloudflare _headers; any report-only
    // notices belong to the checker (WARN), not this page's JS exceptions.
    expect(buckets["report-only-warning"].every((t) => !isJsException(classifyBrowserMessage({ source: "console", type: "error", text: t })))).toBeTruthy();
    await expect(page.locator("h1")).toContainText("Elder POS");
  });

  test("same-origin hrefs from home, /pos/, and /merch/ return 2xx", async ({ page, request }) => {
    await blockAds(page);
    const seeds = ["/", "/pos/", "/merch/"];
    const seen = new Set();
    for (const seed of seeds) {
      const resp = await page.goto(seed, { waitUntil: "domcontentloaded" });
      expect(resp && resp.ok(), seed).toBeTruthy();
      const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((a) => a.getAttribute("href") || ""));
      for (const href of hrefs) {
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:") || href.startsWith("#")) continue;
        expect(hrefLooksLikeTemplateLeftover(href), `${seed} leftover placeholder href ${href}`).toBeFalsy();
        let url;
        try {
          url = new URL(href, `http://127.0.0.1:8765${seed}`);
        } catch {
          continue;
        }
        if (url.origin !== "http://127.0.0.1:8765") continue;
        const key = url.pathname;
        if (seen.has(key)) continue;
        seen.add(key);
        const r = await request.get(key);
        expect(r.ok(), `${seed} -> ${href} => ${key} status ${r.status()}`).toBeTruthy();
      }
    }
    expect(seen.size, "same-origin links crawled").toBeGreaterThan(20);
    const merchPrivacy = await request.get("/privacy-policy/");
    expect(merchPrivacy.ok()).toBeTruthy();
  });
});
