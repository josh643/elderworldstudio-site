import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubeSphereGeometry, polarStretch } from '../src/scene/planet.js';
import { icosphere } from '../src/build/hierarchy.js';
import { rebase, shouldRebase } from '../src/math/origin.js';

test('cube-sphere vertices lie on the sphere', () => {
  const g = cubeSphereGeometry(10, 8);
  assert.equal(g.faces, 6);
  let max = 0;
  for (let i = 0; i < g.positions.length; i += 3) {
    max = Math.max(max, Math.abs(Math.hypot(g.positions[i], g.positions[i + 1], g.positions[i + 2]) - 10));
  }
  assert.ok(max < 1e-5);
  assert.equal(g.indices.length % 3, 0);
});

test('cube-sphere is closer to a true sphere than a coarse UV-style fan', () => {
  const cube = cubeSphereGeometry(5, 4);
  const uv = icosphere(0);
  for (let i = 0; i < uv.positions.length; i++) uv.positions[i] *= 5;
  const s = polarStretch(uv.positions, cube.positions, 5);
  assert.ok(s.cube <= s.uv + 1e-6);
});

test('floating origin rebases past 2.2 km and preserves relative layout', () => {
  const cam = [3000, 4, 0];
  const a = [3010, 0, 5], b = [2980, 0, -8];
  assert.equal(shouldRebase(cam), true);
  const r = rebase(cam, [a, b], [0, 0, 0]);
  assert.equal(r.rebased, true);
  assert.ok(Math.abs(a[0] - cam[0] - 10) < 1e-6);
  assert.ok(Math.hypot(cam[0], cam[2]) < 1);
});
