import { test, expect, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { waitReady, noPageErrors, serious, worldsChrome, assertPlayableChrome } from './helpers.js';
import { ssimPng, dataUrlToBuf, cropCenterPng } from './ssim.mjs';

const pixel = devices['Pixel 7'] || devices['Pixel 5'] || {
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

const portrait = { ...pixel, viewport: pixel.viewport };
const landscape = { ...pixel, viewport: { width: pixel.viewport.height, height: pixel.viewport.width } };

async function enterWorld(page) {
  const start = page.locator('.ew-screen[data-screen=start]');
  if (await start.isVisible().catch(() => false)) {
    await expect(page.locator('[data-act=enter]')).toBeVisible();
    await page.locator('[data-act=enter]').click();
  }
  await expect(start).toBeHidden({ timeout: 8_000 });
}

async function compareSceneWithoutHud(page, shotName) {
  await page.evaluate(() => window.__ewsWorlds.setPaused(true));
  await page.waitForTimeout(200);
  fs.mkdirSync('docs/worlds-shots', { recursive: true });
  const withHud = await page.screenshot({ type: 'png', path: path.join('docs/worlds-shots', shotName + '.png') });
  await page.evaluate(() => { const ui = document.querySelector('.ew-ui'); if (ui) ui.style.visibility = 'hidden'; });
  const noHud = await page.screenshot({ type: 'png', path: path.join('docs/worlds-shots', shotName + '-scene.png') });
  await page.evaluate(() => { const ui = document.querySelector('.ew-ui'); if (ui) ui.style.visibility = ''; });
  const { ssim } = ssimPng(cropCenterPng(withHud, 0.5), cropCenterPng(noHud, 0.5));
  const canvas = dataUrlToBuf(await page.evaluate(() => document.querySelector('.office-root > canvas').toDataURL('image/png')));
  fs.writeFileSync(path.join('docs/worlds-shots', shotName + '-canvas.png'), canvas);
  const again = dataUrlToBuf(await page.evaluate(() => document.querySelector('.office-root > canvas').toDataURL('image/png')));
  const { ssim: canvasSsim } = ssimPng(canvas, again);
  return { ssim, canvasSsim };
}

function runOrientation(name, device) {
  test.describe(`Android Chrome ${name}`, () => {
    test.use({
      viewport: device.viewport,
      isMobile: true,
      hasTouch: true,
      userAgent: device.userAgent,
    });

    test(`autostart: no leftover overlay, HUD in view, scene compare (${name})`, async ({ page }) => {
      const errors = noPageErrors(page);
      await page.goto('/worlds/?autostart=1');
      await waitReady(page);
      await page.waitForTimeout(500);
      const chrome = await worldsChrome(page);
      expect(chrome.screens.every(s => !s.visible)).toBeTruthy();
      assertPlayableChrome(chrome, { maxMap: 160 });
      expect(chrome.hudBtns.length).toBeGreaterThanOrEqual(2);
      const { ssim, canvasSsim } = await compareSceneWithoutHud(page, `mobile-${name}`);
      expect(ssim, 'center of the page must be the 3D scene, not a HUD/minimap overlay').toBeGreaterThanOrEqual(0.92);
      expect(canvasSsim).toBeGreaterThanOrEqual(0.98);
      expect(serious(errors)).toEqual([]);
    });

    test(`start screen dismisses and does not stay up (${name})`, async ({ page }) => {
      await page.goto('/worlds/');
      await waitReady(page);
      const before = await worldsChrome(page);
      expect(before.screens.some(s => s.name === 'start' && s.visible)).toBeTruthy();
      if (before.map && !before.map.hidden) {
        expect(before.map.w).toBeLessThanOrEqual(160);
        expect(before.map.h).toBeLessThanOrEqual(160);
      }
      await expect(page.locator('[data-act=enter]')).toBeVisible();
      await enterWorld(page);
      const after = await worldsChrome(page);
      assertPlayableChrome(after, { maxMap: 160 });
    });
  });
}

runOrientation('portrait', portrait);
runOrientation('landscape', landscape);

test.describe('desktop HUD regression', () => {
  test('minimap stays a corner widget after load', async ({ page }) => {
    await page.goto('/worlds/?autostart=1');
    await waitReady(page);
    const chrome = await worldsChrome(page);
    assertPlayableChrome(chrome, { maxMap: 160 });
    expect(chrome.map.w).toBeGreaterThan(40);
    expect(chrome.map.w).toBeLessThanOrEqual(140);
    expect(chrome.map.h).toBeLessThanOrEqual(140);
  });
});
