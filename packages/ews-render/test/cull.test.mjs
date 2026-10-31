import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cullClusters, packClusterRecords } from '../src/gpu/cull.js';
import { buildHiZ } from '../src/gpu/hiz.js';
import { lookAtVP } from '../src/math/frustum.js';
import { createStreamer } from '../src/gpu/bindless.js';
import { flattenGpuClusters, defaultCatalogDoc } from '../src/format/clusters.js';
import { CULL_WGSL, VIS_WGSL } from '../src/shaders/gpu.js';

test('frustum cull drops clusters behind the camera', () => {
  const clusters = [
    { cx: 0, cy: 0, cz: -20, radius: 1, cone: [0, 1, 0], coneCutoff: 1, ownError: 0, parentError: 0.2, lod: 0, world: [0, 0, -20], tris: 64 },
    { cx: 0, cy: 0, cz: 20, radius: 1, cone: [0, 1, 0], coneCutoff: 1, ownError: 0, parentError: 0.2, lod: 0, world: [0, 0, 20], tris: 64 },
  ];
  const eye = [0, 0, 0];
  const vp = lookAtVP(eye, [0, 0, -1], [0, 1, 0], 62, 16 / 9, 0.1, 100);
  const r = cullClusters(clusters, { eye, vp, fov: 62, height: 720 });
  assert.ok(r.culledFrustum >= 1);
  assert.ok(r.drew >= 1);
});

test('forceMax keeps only LOD0', () => {
  const doc = defaultCatalogDoc();
  const rec = flattenGpuClusters(doc, [{ id: 'a', catalog: 'block', x: 0, y: 0, z: -8 }]);
  const eye = [0, 2, 0];
  const r = cullClusters(rec, { eye, fov: 62, height: 720, forceMax: true });
  assert.ok(r.visible.every(v => v.lod === 0));
});

test('Hi-Z downsample is a min pyramid', () => {
  const depth = new Float32Array([0.2, 0.8, 0.5, 0.1]);
  const z = buildHiZ(depth, 2, 2);
  assert.ok(Math.abs(z.levels[z.levels.length - 1][0] - 0.1) < 1e-6);
});

test('bindless streamer evicts to stay in budget', () => {
  const s = createStreamer({ budget: 100, slots: 4 });
  s.request('a', 60, 4, 1);
  s.request('b', 60, 4, 0);
  assert.ok(s.used() <= 100);
  assert.ok(s.desiredMips(300, 8) >= s.desiredMips(8, 8));
});

test('cluster records pack 16 floats each', () => {
  const rec = packClusterRecords([
    { cx: 1, cy: 2, cz: 3, radius: 4, cone: [0, 1, 0], coneCutoff: 0.2, ownError: 0, parentError: 1, lod: 0, world: [1, 2, 3], tris: 12 },
  ]);
  assert.equal(rec.length, 16);
  assert.equal(rec[0], 1);
  assert.equal(rec[3], 4);
});

test('WGSL shaders expose the compute and vis-buffer entry points', () => {
  assert.match(CULL_WGSL, /@compute/);
  assert.match(CULL_WGSL, /atomicAdd/);
  assert.match(VIS_WGSL, /@fragment fn fs/);
  assert.match(VIS_WGSL, /u32/);
});
