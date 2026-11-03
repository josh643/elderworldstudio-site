// node --test tests/ — design distinctness: industry-driven directions, layouts, palettes, and rejection of looks too close to recent ones.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as L from '../functions/_lib/sitespec.js';
const BIZ = [
  { type: 'salon', name: 'Riverside Fades', story: 'Old-school family barbershop since 1998. Hot towel shaves, sharp fades.' },
  { type: 'bakery', name: 'Broad Ave Bread Co', story: 'Small sourdough bakery. Naturally leavened loaves, cardamom buns, local coffee.' },
  { type: 'auto', name: 'Northside Auto Care', story: 'Independent auto repair shop. Honest diagnostics, brakes, oil changes.' },
  { type: 'salon', name: 'Polished Nail Lounge', story: 'Nail salon: gel manicures, pedicures, nail art and lash lifts in a calm, pretty space.' },
  { type: 'retail', name: 'Hillcrest Hardware', story: 'Family hardware store since 1972. Tools, paint mixing, plumbing parts, key cutting, lumber.' }];
const raw = () => L.validateSpec({ palette: { bg: '#ffffff', surface: '#f4f4f4', ink: '#222222', accent: '#8a5a2b', accent2: '#3a2418' }, fonts: { head: 'lora', body: 'lora' }, hero: 'center', headline: 'Hi', sections: [{ kind: 'services', title: 'Stuff', items: [{ name: 'A', text: 'B' }] }, { kind: 'about', title: 'About' }] }).spec;
test('industry picks a fitting first direction', () => {
  const m = b => L.direction(L.parseInput(b)).mood;
  assert.equal(m(BIZ[2]), 'garage steel'); assert.equal(m(BIZ[3]), 'glam blush'); assert.equal(m(BIZ[4]), 'workshop yellow');
  assert.ok(['earthy craft', 'warm heritage', 'soft pastel'].includes(m(BIZ[1])));
});
test('same model output still becomes 5 clearly different sites (no pair too close)', () => {
  const recent = [], sigs = [];
  for (const b of BIZ) { const d = L.pickDistinct(raw(), L.parseInput(b), recent); const s = L.signature(d.spec); sigs.push(s); recent.unshift(s); }
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) assert.ok(L.similarity(sigs[i], sigs[j]) < L.TOO_CLOSE, `${BIZ[i].name} vs ${BIZ[j].name}: ${JSON.stringify([sigs[i], sigs[j]])}`);
  assert.ok(new Set(sigs.map(s => s.layout)).size === 3, 'all three layouts used');
});
test('palette follows the direction when the model ignores it', () => {
  const s = L.applyDirection(raw(), L.direction(L.parseInput(BIZ[2]))); assert.ok(L.isDark(s.palette.bg)); assert.equal(s.palette.accent, '#ff5a1f');
});
test('rejects a look too close to a recent one and tries the next direction', () => {
  const inp = L.parseInput(BIZ[2]), first = L.applyDirection(raw(), L.direction(inp));
  const d = L.pickDistinct(raw(), inp, [L.signature(first)]);
  assert.ok(d.tries > 1); assert.ok(L.similarity(L.signature(d.spec), L.signature(first)) < L.TOO_CLOSE);
});
test('regenerate seeds rotate the direction', () => {
  const a = L.direction(L.parseInput({ ...BIZ[3], seed: 0 })).mood, b = L.direction(L.parseInput({ ...BIZ[3], seed: 1 })).mood; assert.notEqual(a, b);
});
test('layout survives validation (edit keeps it)', () => { assert.equal(L.validateSpec({ ...raw(), layout: 'editorial' }).spec.layout, 'editorial'); });
test('direction never crashes on any hash (negative shift regression)', () => {
  for (let i = 0; i < 300; i++) { const d = L.direction(L.parseInput({ type: ['auto', 'bakery', 'salon', 'retail', 'other'][i % 5], name: 'Shop ' + i, seed: i })); assert.ok(Array.isArray(d.order) && d.order.length); }
});
