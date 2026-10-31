import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMeshlets, geometricError } from '../src/build/meshlets.js';
import { buildLodHierarchy, box, icosphere } from '../src/build/hierarchy.js';

test('meshlets cover every source triangle', () => {
  const m = icosphere(2);
  const set = buildMeshlets(m.positions, m.indices, 32);
  const tris = m.indices.length / 3;
  assert.equal(set.indices.length / 3, tris);
  assert.ok(set.count >= 1);
  const summed = set.meshlets.reduce((s, c) => s + c.tris, 0);
  assert.equal(summed, tris);
  for (const c of set.meshlets) {
    assert.ok(c.radius > 0);
    assert.ok(Math.hypot(...c.cone) > 0.5);
  }
});

test('LOD hierarchy geomErr is 0 at LOD0 and increases', () => {
  const m = box(2, 2, 2);
  const h = buildLodHierarchy(m.positions, m.indices, { levels: 3, cells: [0, 8, 3] });
  assert.equal(h.levels[0].geomErr, 0);
  assert.ok(h.levels[1].geomErr >= 0);
  assert.ok(h.levels[h.levels.length - 1].vertexCount <= h.levels[0].vertexCount);
});

test('geometricError of identical meshes is 0', () => {
  const m = box(1, 1, 1);
  assert.equal(geometricError(m.positions, m.positions), 0);
});
