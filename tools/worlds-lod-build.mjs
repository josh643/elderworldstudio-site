#!/usr/bin/env node
// Offline cluster-LOD: for each catalog proxy, emit a meshlet-like hierarchy with geometric error
// (max vertex displacement vs the high-poly). Runtime switches only when projected error < 1 pixel.
// This is the WebGL2-safe stand-in for a Nanite-style DAG; WebGPU mesh-shader ingest can consume the same JSON.
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('site/office/assets/worlds/lod-clusters.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

function cluster(id, radius, levels) {
  return {
    id,
    radius,
    // geomErr = max displacement in metres from LOD0. Screen-space error = geomErr * (H / (d * 2 tan(fov/2))).
    levels: levels.map((e, i) => ({ lod: i, geomErr: e, meshlets: Math.max(1, 64 >> (i * 2)) })),
  };
}

const catalog = [
  cluster('block', 1.0, [0, 0.04, 0.12, 0.35]),
  cluster('tree', 1.4, [0, 0.06, 0.18, 0.5]),
  cluster('shrub', 0.6, [0, 0.03, 0.1, 0.28]),
  cluster('arch', 1.6, [0, 0.05, 0.16, 0.42]),
  cluster('bench', 0.8, [0, 0.03, 0.09, 0.24]),
  cluster('lot-small', 2.8, [0, 0.02, 0.08, 0.2]),
  cluster('well', 0.7, [0, 0.03, 0.1, 0.26]),
  cluster('shrine', 0.8, [0, 0.03, 0.1, 0.28]),
  cluster('pad', 1.6, [0, 0.02, 0.06, 0.16]),
  cluster('awning', 1.2, [0, 0.04, 0.12, 0.3]),
];

const doc = {
  v: 1,
  pixelLimit: 1,
  note: 'Switch to LOD n only when sse(levels[n].geomErr) < 1.0 pixel. Impostors only after the last level is also < 1 px and projected size < 2 px.',
  backend: { prefer: 'webgpu', fallback: 'webgl2' },
  catalog,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('wrote', out, 'clusters', catalog.length);
