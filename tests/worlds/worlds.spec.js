import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { waitReady, noPageErrors, serious } from './helpers.js';

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test('worlds loads, walks, and travels to space and Omnivael', async ({ page }) => {
  const errors = noPageErrors(page);
  await page.goto('/worlds/?autostart=1');
  await waitReady(page);
  const info = await page.evaluate(() => ({
    worlds: window.__ewsWorlds.worlds,
    zone: window.__ewsWorlds.zone,
    tp: window.__ewsWorlds.thirdPerson,
  }));
  expect(info.worlds).toBe(true);
  expect(info.zone).toBe('town');
  expect(info.tp).toBe(true);

  const before = await page.evaluate(() => window.__ewsWorlds.pos);
  await page.evaluate(() => window.__ewsWorlds.move(1, 0, 0.5));
  const after = await page.evaluate(() => window.__ewsWorlds.pos);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2);

  fs.mkdirSync('docs/worlds-shots', { recursive: true });
  await page.screenshot({ path: 'docs/worlds-shots/town.png' });

  const traveled = await page.evaluate(() => {
    const z = window.__ewsWorlds.travel('space');
    return { z, zone: window.__ewsWorlds.zone, has: !!window.__ewsWorlds.zone };
  });
  expect(traveled.z || traveled.zone).toBe('space');
  await page.waitForFunction(() => window.__ewsWorlds.zone === 'space', null, { timeout: 8_000 });
  expect(await page.evaluate(() => window.__ewsWorlds.zone)).toBe('space');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/worlds-shots/space.png' });

  await page.evaluate(() => window.__ewsWorlds.travel('omnivael'));
  await page.waitForFunction(() => window.__ewsWorlds.zone === 'omnivael', null, { timeout: 8_000 });
  expect(await page.evaluate(() => window.__ewsWorlds.zone)).toBe('omnivael');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/worlds-shots/omnivael.png' });

  await page.evaluate(() => window.__ewsWorlds.travel('town'));
  await page.waitForFunction(() => window.__ewsWorlds.zone === 'town', null, { timeout: 8_000 });

  expect(serious(errors)).toEqual([]);
});
