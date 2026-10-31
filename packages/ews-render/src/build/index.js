import fs from 'node:fs';
import path from 'node:path';
import { defaultCatalogDoc, parseClusterDoc } from '../format/clusters.js';
import { buildLodHierarchy, primitiveMesh } from './hierarchy.js';
import { bakeNormalMap } from './normals.js';
import { bakeOctahedralImpostor } from './impostors.js';
import { extractFirstMesh } from './gltf.js';

export { buildLodHierarchy, primitiveMesh } from './hierarchy.js';
export { buildMeshlets, geometricError } from './meshlets.js';
export { bakeNormalMap, computeVertexNormals } from './normals.js';
export { bakeOctahedralImpostor, shouldUseImpostor } from './impostors.js';
export { extractFirstMesh, parseGLB } from './gltf.js';

/**
 * Offline catalog bake. Reads optional GLBs from `glbDir` (EWS-owned baked props),
 * otherwise uses procedural proxies. Writes lod-clusters.json (+ optional maps).
 */
export function bakeCatalog(opts = {}) {
  const src = opts.doc ? parseClusterDoc(opts.doc) : defaultCatalogDoc();
  const glbDir = opts.glbDir || '';
  const outDir = opts.outDir || '';
  const writeMaps = !!opts.writeMaps;
  const catalog = src.catalog.map(entry => {
    let mesh;
    if (glbDir) {
      const hit = findGlb(glbDir, entry.id);
      if (hit) {
        try { mesh = extractFirstMesh(fs.readFileSync(hit)); } catch { mesh = null; }
      }
    }
    if (!mesh) mesh = primitiveMesh(entry.id);
    const hier = buildLodHierarchy(mesh.positions, mesh.indices, { levels: entry.levels.length || 4 });
    const levels = hier.levels.map((lv, i) => {
      const declared = entry.levels[i];
      const rec = {
        lod: i,
        geomErr: i === 0 ? 0 : +(Math.max(declared?.geomErr || 0, lv.geomErr).toFixed(5)),
        meshlets: lv.meshlets,
        clusters: lv.clusters.map(c => ({
          cx: +c.cx.toFixed(4), cy: +c.cy.toFixed(4), cz: +c.cz.toFixed(4),
          radius: +c.radius.toFixed(4),
          cone: c.cone.map(v => +v.toFixed(4)),
          coneCutoff: +c.coneCutoff.toFixed(4),
          tris: c.tris,
        })),
        vertexCount: lv.vertexCount,
        triangleCount: lv.triangleCount,
      };
      if (writeMaps && outDir && i > 0) {
        const baked = bakeNormalMap(
          { positions: hier.levels[0].positions, indices: hier.levels[0].indices },
          { positions: lv.positions, indices: lv.indices },
          32,
        );
        const rel = `maps/${entry.id}-lod${i}-n.png.raw`;
        fs.mkdirSync(path.join(outDir, 'maps'), { recursive: true });
        fs.writeFileSync(path.join(outDir, rel), Buffer.from(baked.rgba));
        rec.normalMap = { path: rel, width: baked.width, height: baked.height };
      }
      return rec;
    });
    let impostor = null;
    if (writeMaps && outDir) {
      const imp = bakeOctahedralImpostor({
        positions: hier.levels[0].positions,
        indices: hier.levels[0].indices,
        radius: hier.radius,
      }, 4, 16);
      const rel = `impostors/${entry.id}`;
      fs.mkdirSync(path.join(outDir, 'impostors'), { recursive: true });
      fs.writeFileSync(path.join(outDir, rel + '-c.raw'), Buffer.from(imp.color));
      fs.writeFileSync(path.join(outDir, rel + '-d.f32'), Buffer.from(imp.depth.buffer));
      fs.writeFileSync(path.join(outDir, rel + '-n.raw'), Buffer.from(imp.normal));
      impostor = { path: rel, views: imp.views, tile: imp.tile, size: imp.size, radius: +imp.radius.toFixed(4) };
    }
    return { id: entry.id, radius: +hier.radius.toFixed(4) || entry.radius, levels, impostor };
  });
  return {
    v: 1,
    pixelLimit: src.pixelLimit,
    note: src.note,
    backend: src.backend,
    baked: true,
    catalog,
  };
}

function findGlb(dir, id) {
  if (!dir || !fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.glb'));
  const needle = id.replace(/-/g, '');
  return files
    .map(f => path.join(dir, f))
    .find(f => f.toLowerCase().includes(id.toLowerCase()) || f.toLowerCase().replace(/-/g, '').includes(needle))
    || null;
}
