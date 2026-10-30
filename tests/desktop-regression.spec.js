const { test, expect } = require("@playwright/test");
const { PAGES, blockAds } = require("./helpers");

test.describe("desktop regression", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} keeps the pre-mobile desktop header`, async ({ page }) => {
      await blockAds(page);
      const resp = await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      expect(resp && resp.ok()).toBeTruthy();
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});

      const metrics = await page.evaluate(() => {
        const header = document.querySelector(".site-header");
        const nav = document.getElementById("site-nav");
        const toggle = document.querySelector(".nav-toggle");
        const brand = document.querySelector(".brand");
        const toggleCs = toggle ? getComputedStyle(toggle) : null;
        return {
          headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
          navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
          navDisplay: nav ? getComputedStyle(nav).display : "",
          navVisible: !!(nav && nav.getClientRects().length),
          toggleDisplay: toggleCs ? toggleCs.display : "missing",
          brandW: brand ? Math.round(brand.getBoundingClientRect().width) : 0,
          linkCount: nav ? nav.querySelectorAll("a").length : 0,
        };
      });

      expect(metrics.toggleDisplay, "hamburger must stay hidden on desktop").toBe("none");
      expect(metrics.navDisplay).toBe("flex");
      expect(metrics.navVisible).toBeTruthy();
      expect(metrics.linkCount).toBe(8);
      expect(metrics.headerH, "header height drifted from the 65px desktop layout").toBeGreaterThanOrEqual(60);
      expect(metrics.headerH).toBeLessThanOrEqual(72);
      expect(metrics.navH, "nav should stay a single row").toBeGreaterThanOrEqual(30);
      expect(metrics.navH).toBeLessThanOrEqual(48);
      expect(metrics.brandW).toBeGreaterThan(200);
    });
  }

  test("home desktop screenshot matches the pre-change layout", async ({ page }) => {
    await blockAds(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await expect(page).toHaveScreenshot("desktop-home.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});
