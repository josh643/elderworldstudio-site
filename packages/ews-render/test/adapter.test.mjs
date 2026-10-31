import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, flagEnabled } from '../src/adapter.js';
import { defaultCatalogDoc } from '../src/format/clusters.js';

test('feature flag reads URL and storage only', () => {
  assert.equal(flagEnabled(''), false);
  assert.equal(flagEnabled('?ewsrender=1'), true);
  assert.equal(flagEnabled('?foo=1&render=ews'), true);
  assert.equal(flagEnabled('', { getItem: k => k === 'ews-render' ? '1' : null }), true);
  assert.equal(flagEnabled('', { getItem: () => null }), false);
});

test('create() headless renders a campus and reports metrics', async () => {
  const R = await create({
    clusters: defaultCatalogDoc(),
    instances: [
      { id: 'p1', catalog: 'block', x: 0, y: 0, z: -12 },
      { id: 'p2', catalog: 'tree', x: 4, y: 0, z: -18 },
    ],
  });
  assert.equal(R.backend, 'headless');
  R.forceMaxLod(true);
  const a = R.render({ eye: [0, 8, 20], target: [0, 0, 0] });
  R.forceMaxLod(false);
  const b = R.render({ eye: [0, 8, 20], target: [0, 0, 0] });
  const m = R.metrics();
  assert.ok(a.calls >= 1);
  assert.ok(b.calls >= 1);
  assert.equal(m.sseLimit, 1);
  assert.equal(m.flag, true);
  assert.ok(m.memBytes >= 0);
  R.dispose();
});
