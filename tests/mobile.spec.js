const { test, expect } = require("@playwright/test");
const { PAGES, PHONE_VIEWPORTS, NAV_LINK_COUNT, SMS_CONSENT, blockAds, layoutAudit } = require("./helpers");

test.describe("mobile layout", () => {
  for (const vp of PHONE_VIEWPORTS) {
    for (const pageInfo of PAGES) {
      test(`${pageInfo.name} @ ${vp.name} has viewport meta and no horizontal overflow`, async ({ page }) => {
        await blockAds(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const resp = await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
        expect(resp && resp.ok(), `${pageInfo.path} should load`).toBeTruthy();
        await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});

        const audit = await layoutAudit(page);
        expect(audit.vpContent, `${pageInfo.path} missing viewport meta`).toMatch(/width\s*=\s*device-width/i);
        expect(audit.docW, `${pageInfo.path} scrollWidth ${audit.docW} > ${audit.vw}`).toBeLessThanOrEqual(audit.vw + 1);
        expect(audit.overflowing, `${pageInfo.path} overflowing: ${JSON.stringify(audit.overflowing)}`).toEqual([]);
      });
    }
  }

  test("phone nav is a working hamburger on every page", async ({ page }) => {
    await blockAds(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const pageInfo of PAGES) {
      await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });
      const toggle = page.locator(".nav-toggle");
      const nav = page.locator("#site-nav");
      await expect(toggle, `${pageInfo.path} hamburger`).toBeVisible();
      await expect(nav).toBeHidden();
      const brandBox = await page.locator(".brand").boundingBox();
      const toggleBox = await toggle.boundingBox();
      expect(Math.abs(brandBox.y - toggleBox.y), `${pageInfo.path} hamburger wrapped under the brand`).toBeLessThan(12);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(nav).toBeVisible();
      await expect(nav.locator("a")).toHaveCount(NAV_LINK_COUNT);
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
    }
  });

  test("services SMS opt-in wording is unchanged and the form fits a phone", async ({ page }) => {
    await blockAds(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/", { waitUntil: "domcontentloaded" });

    const sms = page.locator(".sms-opt span");
    await expect(sms).toBeVisible();
    const text = (await sms.innerText()).replace(/\s+/g, " ").trim();
    expect(text.startsWith(SMS_CONSENT)).toBeTruthy();
    expect(text).toContain("SMS Terms");
    expect(text).toContain("Privacy Policy");

    const box = page.locator('input[name="sms_optin"]');
    const size = await box.boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(24);
    expect(size.height).toBeGreaterThanOrEqual(24);

    for (const name of ["name", "email", "phone", "business", "description", "budget"]) {
      const field = page.locator(`.lead-form [name="${name}"]`);
      const r = await field.boundingBox();
      expect(r, `${name} missing`).toBeTruthy();
      expect(r.x + r.width, `${name} overflows`).toBeLessThanOrEqual(360 + 1);
    }
  });
});
