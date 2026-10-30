// node --test tests/ — start-state samples: 5 real, distinct AI designs; no client names; new drafts start with no type (carousel, not a template).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import * as L from '../functions/_lib/sitespec.js';
const src = fs.readFileSync(new URL('../site/build/samples.js', import.meta.url), 'utf8');
test('five valid, mutually distinct sample designs', () => {
  const w = {}; vm.runInNewContext(src, { window: w }); const S = w.EWS_SAMPLES; assert.equal(S.length, 5);
  const sigs = S.map(x => { const v = L.validateSpec(x.spec); assert.ok(v.ok, x.name); return L.signature(x.spec); });
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(L.similarity(sigs[i], sigs[j]) < L.TOO_CLOSE, S[i].name + ' vs ' + S[j].name);
  assert.ok(!/marlon|cap bar/i.test(src));
});
test('blank draft has no business type; quick design is debounced and capped', () => {
  const js = fs.readFileSync(new URL('../site/build/builder.js', import.meta.url), 'utf8');
  assert.ok(js.includes("function blank() { return { type: '',"));
  assert.match(js, /QUICK_MAX = 2, QUICK_MS = 1500/); assert.ok(js.includes('clearTimeout(qTimer)'));
  assert.ok(L.LIMITS.burst <= 12 && L.LIMITS.perDay <= 40);
});
