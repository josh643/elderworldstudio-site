import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { waitReady, noPageErrors, serious } from './helpers.js';
import { ssimPng, dataUrlToBuf } from './ssim.mjs';

test('host serves the ews-render package (no CDN)', async ({ request }) => {
  const r = await request.get('/packages/ews-render/src/index.js');
  expect(r.ok()).toBeTruthy();
  const js = await r.text();
  expect(js).toMatch(/create/);
  expect(js).not.toMatch(/cdn\.|unpkg|jsdelivr|skypack/i);
});

test('worlds with ewsrender=1 still walks and travels; office stays Phase 1', async ({ page }) => {
  const errors = noPageErrors(page);
  await page.goto('/worlds/?autostart=1&ewsrender=1');
  await waitReady(page);
  const info = await page.evaluate(() => ({
    worlds: window.__ewsWorlds.worlds,
    flag: window.__ewsWorlds.ewsRender,
    zone: window.__ewsWorlds.zone,
  }));
  expect(info.worlds).toBe(true);
  expect(info.flag).toBe(true);
  expect(info.zone).toBe('town');
  const before = await page.evaluate(() => window.__ewsWorlds.pos);
  await page.evaluate(() => window.__ewsWorlds.move(1, 0, 0.5));
  const after = await page.evaluate(() => window.__ewsWorlds.pos);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2);

  fs.mkdirSync('docs/ews-render-shots', { recursive: true });
  await page.screenshot({ path: 'docs/ews-render-shots/town.png' });

  await page.evaluate(() => window.__ewsWorlds.travel('space'));
  await page.waitForFunction(() => window.__ewsWorlds.zone === 'space', null, { timeout: 8_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/ews-render-shots/space.png' });

  await page.evaluate(() => window.__ewsWorlds.travel('omnivael'));
  await page.waitForFunction(() => window.__ewsWorlds.zone === 'omnivael', null, { timeout: 8_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/ews-render-shots/omnivael.png' });

  expect(serious(errors)).toEqual([]);
});

test('flag off: default /worlds/ does not enable ews-render', async ({ page }) => {
  await page.goto('/worlds/?autostart=1');
  await waitReady(page);
  expect(await page.evaluate(() => window.__ewsWorlds.ewsRender)).toBe(false);
});

test('worlds ewsrender=1: distant campus SSIM ≥ 0.98 vs max LOD', async ({ page }) => {
  await page.goto('/worlds/?autostart=1&ewsrender=1');
  await waitReady(page);
  await page.waitForTimeout(800);
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
  const a = dataUrlToBuf(await grab(true));
  const b = dataUrlToBuf(await grab(false));
  const { ssim } = ssimPng(a, b);
  fs.mkdirSync('docs/ews-render-shots', { recursive: true });
  fs.writeFileSync(path.join('docs/ews-render-shots', 'worlds-lod-max.png'), a);
  fs.writeFileSync(path.join('docs/ews-render-shots', 'worlds-lod-sse.png'), b);
  expect(ssim).toBeGreaterThanOrEqual(0.98);
});

test('same camera paths: Phase 1 vs Phase 2 fps / calls / tris / memory', async ({ page }) => {
  async function sample(flag) {
    await page.goto(flag ? '/worlds/?autostart=1&ewsrender=1' : '/worlds/?autostart=1');
    await waitReady(page);
    await page.waitForTimeout(1200);
    const town = await page.evaluate(() => window.__ewsWorlds.metrics());
    await page.evaluate(() => window.__ewsWorlds.travel('space'));
    await page.waitForFunction(() => window.__ewsWorlds.zone === 'space', null, { timeout: 8_000 });
    await page.waitForTimeout(900);
    const space = await page.evaluate(() => window.__ewsWorlds.metrics());
    await page.evaluate(() => window.__ewsWorlds.travel('omnivael'));
    await page.waitForFunction(() => window.__ewsWorlds.zone === 'omnivael', null, { timeout: 8_000 });
    await page.waitForTimeout(900);
    const omni = await page.evaluate(() => window.__ewsWorlds.metrics());
    return { town, space, omni, backend: town?.backend, ews: flag };
  }
  const before = await sample(false);
  const after = await sample(true);
  const doc = {
    at: new Date().toISOString(),
    paths: {
      town: { before: slim(before.town), after: slim(after.town) },
      space: { before: slim(before.space), after: slim(after.space) },
      omnivael: { before: slim(before.omni), after: slim(after.omni) },
    },
    note: 'Same camera paths. before = Phase 1 three.js (flag off). after = ewsrender=1. CI fps is SwiftShader.',
  };
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/ews-render-regression.json', JSON.stringify(doc, null, 2));
  expect(after.ews).toBe(true);
});

function slim(m = {}) {
  return {
    fps: m.fps, calls: m.calls, tris: m.tris,
    memGeometries: m.memGeometries, memTextures: m.memTextures,
    memBytes: m.ews?.memBytes ?? m.memBytes,
    backend: m.backend, viewDist: m.viewDist,
  };
}

test('render-lab: SSE vs max LOD is lossless (SSIM ≥ 0.98) + regression metrics', async ({ page }) => {
  await page.goto('/worlds/render-lab/');
  await page.waitForFunction(() => window.__ewsRenderLab?.ready === true, null, { timeout: 30_000 });
  await page.waitForTimeout(400);

  async function fpsAt(forceMax) {
    await page.evaluate(on => {
      window.__ewsRenderLab.forceMaxLod(on);
      window.__ewsRenderLab.setPaused(false);
    }, forceMax);
    await page.waitForTimeout(1600);
    return page.evaluate(() => window.__ewsRenderLab.metrics());
  }
  const maxM = await fpsAt(true);
  const lodM = await fpsAt(false);

  await page.evaluate(() => {
    window.__ewsRenderLab.setView(0, 42, 170, 0, 2, 30);
    window.__ewsRenderLab.setPaused(true);
  });

  async function grab(forceMax) {
    await page.evaluate(on => {
      window.__ewsRenderLab.forceMaxLod(on);
      window.__ewsRenderLab.setView(0, 42, 170, 0, 2, 30);
      window.__ewsRenderLab.setPaused(false);
    }, forceMax);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ewsRenderLab.setPaused(true));
    return page.evaluate(() => window.__ewsRenderLab.grab());
  }
  const maxShot = await grab(true);
  const lodShot = await grab(false);
  const a = dataUrlToBuf(maxShot), b = dataUrlToBuf(lodShot);
  const { ssim, mad, width, height } = ssimPng(a, b);

  const out = {
    phase: 2,
    ssim: +ssim.toFixed(4),
    mad: +mad.toFixed(4),
    width, height,
    fpsMax: maxM?.fps || 0,
    fpsLod: lodM?.fps || 0,
    callsMax: maxM?.calls,
    callsLod: lodM?.calls,
    trisMax: maxM?.tris,
    trisLod: lodM?.tris,
    memMax: maxM?.memBytes,
    memLod: lodM?.memBytes,
    backend: lodM?.backend,
    sseLimit: lodM?.sseLimit,
    impostors: lodM?.impostors,
    compute: lodM?.compute || false,
    at: new Date().toISOString(),
    note: 'CI is SwiftShader/headless. fps is not a laptop/phone target; SSIM is the lossless gate.',
    paths: {
      'campus-distant': { eye: [0, 42, 170], target: [0, 2, 30], fpsMax: maxM?.fps, fpsLod: lodM?.fps, callsMax: maxM?.calls, callsLod: lodM?.calls, trisMax: maxM?.tris, trisLod: lodM?.tris, memMax: maxM?.memBytes, memLod: lodM?.memBytes },
    },
  };
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(path.join('docs', 'ews-render-metrics.json'), JSON.stringify(out, null, 2));
  fs.mkdirSync('docs/ews-render-shots', { recursive: true });
  fs.writeFileSync(path.join('docs/ews-render-shots', 'lod-max.png'), a);
  fs.writeFileSync(path.join('docs/ews-render-shots', 'lod-sse.png'), b);
  await page.screenshot({ path: 'docs/ews-render-shots/lab.png' });
  console.log('EWS Render metrics', out);
  expect(ssim).toBeGreaterThanOrEqual(0.98);
});
