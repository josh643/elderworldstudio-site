import { test } from 'node:test';
import assert from 'node:assert/strict';
import { octEncode, octDecode, impostorBlend } from '../src/math/octahedral.js';
import { bakeOctahedralImpostor, shouldUseImpostor } from '../src/build/impostors.js';
import { icosphere } from '../src/build/hierarchy.js';

test('octahedral encode/decode is stable on unit vectors', () => {
  for (const v of [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0.3, 0.8, -0.5]]) {
    const n = Math.hypot(...v);
    const u = v.map(c => c / n);
    const e = octEncode(...u);
    const d = octDecode(e[0], e[1]);
    const err = Math.hypot(d[0] - u[0], d[1] - u[1], d[2] - u[2]);
    assert.ok(err < 1e-5, String(err));
  }
});

test('impostors are refused until last LOD is pixel-identical', () => {
  assert.equal(shouldUseImpostor(8, 0.2), false);
  assert.equal(shouldUseImpostor(1.2, 2), false);
  assert.equal(shouldUseImpostor(1.2, 0.2), true);
  assert.ok(impostorBlend(1, 0.2, 1, 2) > 0.4);
  assert.equal(impostorBlend(8, 0.2, 1, 2), 0);
});

test('octahedral atlas has color, depth and normals', () => {
  const m = icosphere(1);
  const imp = bakeOctahedralImpostor(m, 4, 8);
  assert.equal(imp.color.length, 32 * 32 * 4);
  assert.equal(imp.depth.length, 32 * 32);
  assert.equal(imp.normal.length, 32 * 32 * 4);
  assert.ok(imp.color.some(v => v > 0));
});
