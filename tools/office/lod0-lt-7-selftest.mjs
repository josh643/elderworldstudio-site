// node tools/office/lod0-lt-7-selftest.mjs : guards the avatar LOD cutoffs and visibility work.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../site/office/modules/base-avatar/index.js', import.meta.url), 'utf8');
const limits = source.match(/const LOD0_END = (\d+), LOD1_END = (\d+), LOD2_END = (\d+);/);
assert.ok(limits, 'base-avatar must declare explicit LOD boundaries');
const lod0End = Number(limits[1]), lod1End = Number(limits[2]), lod2End = Number(limits[3]);
assert.deepEqual([lod0End, lod1End, lod2End], [7, 15, 34], 'LOD limits must stay within the cheap-device budget');
assert.match(source, /const near = d < LOD0_END \* L;/, 'LOD0 must stop at the 7 m scaled boundary');
assert.match(source, /visible = d < LOD1_END \* Math\.max\(0\.8, L\) && frustum\.intersectsSphere\(sph\)/,
  'rig visibility must use the LOD1 cutoff');
assert.match(source, /update = d < Math\.min\(LOD1_END \* Math\.max\(0\.8, L\), 16 \* L\) && frustum\.intersectsSphere\(sph\)/,
  'normal skeleton updates must not exceed either the visible rig range or the prior update range');
assert.match(source, /av\.visible = visible;/, 'render visibility must reuse the rig visibility decision');
assert.match(source, /u\.far = !visible && d < LOD2_END \* L/, 'the far pawn must stop at the LOD2 cutoff');

const lodAt = distance => distance < lod0End ? 0 : distance < lod1End ? 1 : distance < lod2End ? 2 : 3;
assert.deepEqual([lodAt(6.99), lodAt(7), lodAt(14.99), lodAt(15), lodAt(33.99), lodAt(34)], [0, 1, 1, 2, 2, 3],
  'each LOD boundary must switch at its documented distance');
const updateRange = (scale, distance) => distance < Math.min(lod1End * Math.max(0.8, scale), 16 * scale);
for (const scale of [0.5, 0.8, 1, 1.5]) {
  const oldRange = 16 * scale;
  assert.ok(!updateRange(scale, oldRange), `normal update range grew at scale ${scale}`);
}
console.log('lod0 < 7 m selftest OK (7 / 15 / 34 m cutoffs; update range does not grow)');
