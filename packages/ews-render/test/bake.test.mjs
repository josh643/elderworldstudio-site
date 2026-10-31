import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bakeNormalMap, computeVertexNormals, decodeNormal } from '../src/build/normals.js';
import { box, icosphere } from '../src/build/hierarchy.js';
import { bakeCatalog } from '../src/build/index.js';

test('vertex normals are unit length', () => {
  const m = box(1, 2, 1);
  const n = computeVertexNormals(m.positions, m.indices);
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    assert.ok(Math.abs(l - 1) < 1e-5);
  }
});

test('high-poly to LOD normal bake writes a unit-ish atlas', () => {
  const hi = icosphere(2);
  const lo = icosphere(1);
  const map = bakeNormalMap(hi, lo, 16);
  assert.equal(map.rgba.length, 16 * 16 * 4);
  let units = 0;
  for (let i = 0; i < map.rgba.length; i += 4) {
    const [x, y, z] = decodeNormal(map.rgba[i], map.rgba[i + 1], map.rgba[i + 2]);
    const l = Math.hypot(x, y, z);
    if (l > 0.7 && l < 1.3) units++;
    assert.equal(map.rgba[i + 3], 255);
  }
  assert.ok(units > 200);
});

test('catalog bake keeps Phase 1 ids and pixelLimit', () => {
  const doc = bakeCatalog();
  assert.equal(doc.v, 1);
  assert.equal(doc.pixelLimit, 1);
  assert.ok(doc.baked);
  const block = doc.catalog.find(c => c.id === 'block');
  assert.ok(block.levels[0].clusters.length >= 1);
  assert.equal(block.levels[0].geomErr, 0);
});
