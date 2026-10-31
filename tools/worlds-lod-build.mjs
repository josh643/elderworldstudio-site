#!/usr/bin/env node
// Offline cluster-LOD: meshlet hierarchy + geomErr (+ optional baked normals / impostors).
// Schema stays the Phase 1 lod-clusters.json so /worlds/ and ews-render share one file.
import fs from 'node:fs';
import path from 'node:path';
import { bakeCatalog } from '../packages/ews-render/src/build/index.js';
import { defaultCatalogDoc } from '../packages/ews-render/src/format/clusters.js';

const out = path.resolve('site/office/assets/worlds/lod-clusters.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
const maps = process.argv.includes('--maps');
const glbDir = process.argv.includes('--glb')
  ? process.argv[process.argv.indexOf('--glb') + 1]
  : path.resolve('incoming/elderverse-baked');

const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : defaultCatalogDoc();
const doc = bakeCatalog({
  doc: existing,
  glbDir: fs.existsSync(glbDir) ? glbDir : '',
  outDir: maps ? path.dirname(out) : '',
  writeMaps: maps,
});
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('wrote', out, 'clusters', doc.catalog.length, 'baked', !!doc.baked);
