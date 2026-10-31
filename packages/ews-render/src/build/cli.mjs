#!/usr/bin/env node
// Offline meshlet / normal / impostor bake. No secrets, no CDN, no client names.
import fs from 'node:fs';
import path from 'node:path';
import { bakeCatalog } from './index.js';
import { defaultCatalogDoc } from '../format/clusters.js';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (k) => args.includes(k);

const out = path.resolve(opt('--out', 'site/office/assets/worlds/lod-clusters.json'));
const glbDir = opt('--glb', '');
const writeMaps = flag('--maps');
const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : defaultCatalogDoc();

const doc = bakeCatalog({
  doc: existing,
  glbDir,
  outDir: writeMaps ? path.dirname(out) : '',
  writeMaps,
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('ews-render bake', out, 'catalog', doc.catalog.length, 'maps', writeMaps);
