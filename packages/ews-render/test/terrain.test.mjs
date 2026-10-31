import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleHeight, morphFactor, morphClipRing, makePlane } from '../src/scene/terrain.js';

test('heightfield bilinear sample', () => {
  const h = { n: 3, h: [0, 0, 0, 0, 4, 0, 0, 0, 0] };
  assert.ok(sampleHeight(h, 0, 0, 2) > 3);
  assert.equal(sampleHeight(h, -1, -1, 2), 0);
});

test('geomorph is 0 when forceMax and rises with SSE', () => {
  assert.equal(morphFactor(1, 5, 62, 720, true), 0);
  assert.ok(morphFactor(2, 20, 62, 720, false) > 0);
});

test('clipmap ring writes Y from the heightfield', () => {
  const plane = makePlane(8, 4);
  const field = { n: 8, h: new Array(64).fill(1.5) };
  const r = morphClipRing({
    positions: plane.positions, cx: 0, cz: 0, step: 4,
    field, cam: [0, 10, 20], fov: 62, height: 720, geomErr: plane.geomErr,
  });
  let maxY = 0;
  for (let i = 1; i < r.positions.length; i += 3) maxY = Math.max(maxY, r.positions[i]);
  assert.ok(maxY > 1);
});
