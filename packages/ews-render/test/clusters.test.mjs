import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseClusterDoc, defaultCatalogDoc, findCluster, flattenGpuClusters } from '../src/format/clusters.js';

test('ships the same lod-clusters.json schema as /worlds/', () => {
  const raw = JSON.parse(fs.readFileSync('site/office/assets/worlds/lod-clusters.json', 'utf8'));
  const doc = parseClusterDoc(raw);
  assert.equal(doc.v, 1);
  assert.equal(doc.pixelLimit, 1);
  assert.equal(doc.backend.prefer, 'webgpu');
  assert.equal(doc.backend.fallback, 'webgl2');
  assert.ok(findCluster(doc, 'block'));
  assert.ok(findCluster(doc, 'tree'));
  assert.equal(findCluster(doc, 'block').levels[0].geomErr, 0);
});

test('default catalog covers the editor set', () => {
  const doc = defaultCatalogDoc();
  for (const id of ['block', 'tree', 'shrub', 'arch', 'bench', 'lot-small', 'well', 'shrine', 'pad', 'awning']) {
    assert.ok(findCluster(doc, id), id);
  }
});

test('flattenGpuClusters emits instance × meshlet records', () => {
  const doc = defaultCatalogDoc();
  const rec = flattenGpuClusters(doc, [{ id: 'a', catalog: 'block', x: 1, y: 0, z: 2 }]);
  assert.ok(rec.length >= 4);
  assert.equal(rec[0].ownError, 0);
  assert.ok(rec.some(r => r.lod === 3));
});

test('rejects a broken catalog', () => {
  assert.throws(() => parseClusterDoc({ v: 1, catalog: [{ id: 'x', levels: [] }] }));
  assert.throws(() => parseClusterDoc({ v: 9, catalog: [] }));
});
