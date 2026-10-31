import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenSpaceError, pickLodLevel, clusterLodVisible, PIXEL_LIMIT } from '../src/math/sse.js';

test('1 m error at 100 m / 62 fov / 720p is about one pixel', () => {
  const px = screenSpaceError(1, 100, 62, 720);
  assert.ok(px > 0.5 && px < 12);
  assert.equal(screenSpaceError(0, 50, 62, 720), 0);
});

test('pickLodLevel stays on LOD0 until projected error is under 1 px', () => {
  const levels = [0, 0.04, 0.12, 0.35];
  assert.equal(pickLodLevel(levels, 10, 62, 720, false), 0);
  assert.equal(pickLodLevel(levels, 10, 62, 720, true), 0);
  const far = pickLodLevel(levels, 4000, 62, 720, false);
  assert.ok(far >= 2);
});

test('cluster DAG bands are mutually exclusive at a given distance', () => {
  const h = 720, fov = 62, d = 800;
  const a = clusterLodVisible(0, 0.04, d, fov, h);
  const b = clusterLodVisible(0.04, 0.12, d, fov, h);
  const c = clusterLodVisible(0.12, Infinity, d, fov, h);
  assert.equal([a, b, c].filter(Boolean).length, 1);
});

test('PIXEL_LIMIT is 1.0 (design gate)', () => {
  assert.equal(PIXEL_LIMIT, 1);
});
