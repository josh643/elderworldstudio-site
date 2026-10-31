#!/usr/bin/env node
// Copy worlds static tree + baked GLBs into dist/worlds (or just assets into site/).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const assetsOnly = process.argv.includes('--assets');
const ROOT = process.cwd();
const bakedSrc = path.join(ROOT, 'incoming/elderverse-baked');
const bakedDst = path.join(ROOT, 'site/office/assets/elderverse');
const dist = path.join(ROOT, 'dist/worlds');

fs.mkdirSync(bakedDst, { recursive: true });
if (fs.existsSync(bakedSrc)) {
  for (const f of fs.readdirSync(bakedSrc)) {
    if (!f.endsWith('.glb')) continue;
    fs.copyFileSync(path.join(bakedSrc, f), path.join(bakedDst, f));
  }
}

spawnSync(process.execPath, [path.join(ROOT, 'tools/worlds-lod-build.mjs')], { stdio: 'inherit' });

if (assetsOnly) {
  console.log('assets ready', bakedDst);
  process.exit(0);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const a = path.join(src, ent.name), b = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
copyDir(path.join(ROOT, 'site'), dist);
copyDir(path.join(ROOT, 'packages'), path.join(dist, 'packages'));
fs.writeFileSync(path.join(dist, 'WORLDS-STATIC.txt'),
  'Elderverse worlds static tree. Serve this folder with worlds-host.mjs (STATIC_ROOT) or any gzip/brotli static host.\n');
console.log('wrote', dist);
