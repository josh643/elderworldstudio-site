const { test, expect } = require("@playwright/test");
const { blockAds } = require("./helpers");

test.describe("pos phone JS and public link check", () => {
  test("/pos/ phone has no first-party page errors and no web-share allow token", async ({ page }) => {
    await blockAds(page);
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
    await page.setViewportSize({ width: 390, height: 844 });
    const resp = await page.goto("/pos/", { waitUntil: "domcontentloaded" });
    expect(resp && resp.status()).toBe(200);
    await page.waitForTimeout(500);
    const iframeAllow = await page.locator("iframe").first().getAttribute("allow");
    expect(iframeAllow || "").not.toMatch(/web-share/);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
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
        if (href.includes("{") || href.includes("}")) {
          throw new Error(`${seed} leftover placeholder href ${href}`);
        }
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
