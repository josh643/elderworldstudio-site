import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { waitReady } from './helpers.js';
import { ssimPng, dataUrlToBuf } from './ssim.mjs';

function sse(geomErr, distance, fov, height) {
  const d = Math.max(0.05, distance);
  return (geomErr * height) / (d * 2 * Math.tan((fov * Math.PI / 180) / 2));
}

test('SSE math: 1 m error at 100 m / 62 fov / 720p is about one pixel', () => {
  const px = sse(1, 100, 62, 720);
  expect(px).toBeGreaterThan(0.5);
  expect(px).toBeLessThan(12);
  expect(sse(0, 50, 62, 720)).toBe(0);
});

test('distant view: SSE LOD vs max LOD is perceptually lossless (SSIM ≥ 0.98)', async ({ page }) => {
  await page.goto('/worlds/?autostart=1');
  await waitReady(page);
  await page.waitForTimeout(800);

  async function fpsAt(forceMax) {
    await page.evaluate(on => {
      window.__ewsWorlds.forceMaxLod(on);
      window.__ewsWorlds.setPaused(false);
    }, forceMax);
    await page.waitForTimeout(1800);
    return page.evaluate(() => window.__ewsWorlds.metrics());
  }
  const maxM = await fpsAt(true);
  const lodM = await fpsAt(false);

  await page.evaluate(() => {
    window.__ewsWorlds.setView(0, 42, 170, 0, 2, 30);
    window.__ewsWorlds.setPaused(true);
  });

  async function grab(forceMax) {
    await page.evaluate(on => {
      window.__ewsWorlds.forceMaxLod(on);
      window.__ewsWorlds.setView(0, 42, 170, 0, 2, 30);
    }, forceMax);
    await page.waitForTimeout(250);
    return page.evaluate(() => document.querySelector('.office-root > canvas').toDataURL('image/png'));
  }

  const maxShot = await grab(true);
  const lodShot = await grab(false);
  const a = dataUrlToBuf(maxShot), b = dataUrlToBuf(lodShot);
  const { ssim, mad, width, height } = ssimPng(a, b);

  const out = {
    ssim: +ssim.toFixed(4),
    mad: +mad.toFixed(4),
    width, height,
    fpsMax: maxM?.fps || 0,
    fpsLod: lodM?.fps || 0,
    callsMax: maxM?.calls,
    callsLod: lodM?.calls,
    trisMax: maxM?.tris,
    trisLod: lodM?.tris,
    viewDist: lodM?.viewDist,
    sseLimit: lodM?.sseLimit,
    backend: lodM?.backend,
    logDepth: lodM?.logDepth,
    quality: lodM?.quality,
    at: new Date().toISOString(),
    note: 'CI is SwiftShader/headless. fps is not a laptop/phone target; SSIM is the lossless gate.',
  };
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(path.join('docs', 'worlds-lod-metrics.json'), JSON.stringify(out, null, 2));
  fs.mkdirSync('docs/worlds-shots', { recursive: true });
  fs.writeFileSync(path.join('docs/worlds-shots', 'lod-max.png'), a);
  fs.writeFileSync(path.join('docs/worlds-shots', 'lod-sse.png'), b);
  console.log('LOD metrics', out);

  expect(ssim).toBeGreaterThanOrEqual(0.98);
});
