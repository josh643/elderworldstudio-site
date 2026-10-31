import { test, expect } from '@playwright/test';
import { noPageErrors, serious } from './helpers.js';

test('office still loads without worlds HUD', async ({ page }) => {
  const errors = noPageErrors(page);
  await page.goto('/office/');
  await page.waitForFunction(() => window.__ewsOffice && !document.querySelector('.office-load'), null, { timeout: 60_000 });
  const worldsOn = await page.evaluate(() => document.documentElement.classList.contains('worlds-on'));
  expect(worldsOn).toBe(false);
  expect(await page.locator('.ew-ui').count()).toBe(0);
  const pos = await page.evaluate(() => window.__ewsOffice.pos());
  expect(pos).toHaveLength(3);
  expect(serious(errors)).toEqual([]);
});
