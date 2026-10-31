import { SCHEMA_VERSION, PIXEL_LIMIT, CATALOG_DEFAULT, MESHLET_TRIS } from '../constants.js';

/** Validate / normalize the Phase 1 `lod-clusters.json` schema (v1). Phase 2 adds optional DAG fields. */
export function parseClusterDoc(json) {
  if (!json || typeof json !== 'object') throw new Error('cluster doc: not an object');
  const v = json.v ?? json.version ?? 1;
  if (v !== SCHEMA_VERSION) throw new Error('cluster doc: unsupported version ' + v);
  if (!Array.isArray(json.catalog)) throw new Error('cluster doc: catalog[] required');
  const catalog = json.catalog.map(normalizeEntry);
  return {
    v: SCHEMA_VERSION,
    pixelLimit: Number(json.pixelLimit) || PIXEL_LIMIT,
    note: json.note || '',
    backend: json.backend || { prefer: 'webgpu', fallback: 'webgl2' },
    catalog,
  };
}

function normalizeEntry(e) {
  if (!e || !e.id) throw new Error('cluster entry missing id');
  const levels = (e.levels || []).map((lv, i) => {
    if (typeof lv === 'number') return { lod: i, geomErr: lv, meshlets: Math.max(1, 64 >> (i * 2)) };
    return {
      lod: lv.lod ?? i,
      geomErr: Number(lv.geomErr) || 0,
      meshlets: Number(lv.meshlets) || Math.max(1, 64 >> (i * 2)),
      clusters: Array.isArray(lv.clusters) ? lv.clusters : undefined,
      normalMap: lv.normalMap || undefined,
      impostor: lv.impostor || undefined,
    };
  });
  if (!levels.length) throw new Error('cluster ' + e.id + ': levels required');
  return {
    id: String(e.id),
    radius: Number(e.radius) || 1,
    levels,
    impostor: e.impostor || null,
  };
}

export function defaultCatalogDoc() {
  return parseClusterDoc({
    v: 1,
    pixelLimit: PIXEL_LIMIT,
    note: 'Switch to LOD n only when sse(levels[n].geomErr) < 1.0 pixel. Impostors only after the last level is also < 1 px and projected size < 2 px.',
    backend: { prefer: 'webgpu', fallback: 'webgl2' },
    catalog: CATALOG_DEFAULT.map(([id, radius, errs]) => ({
      id,
      radius,
      levels: errs.map((geomErr, i) => ({
        lod: i,
        geomErr,
        meshlets: Math.max(1, MESHLET_TRIS >> (i * 2)),
      })),
    })),
  });
}

export function findCluster(doc, id) {
  return doc.catalog.find(c => c.id === id) || null;
}

export function flattenGpuClusters(doc, instances) {
  // Pack instance × level × meshlet into the SoA the compute cull consumes.
  const out = [];
  for (const inst of instances) {
    const cat = findCluster(doc, inst.catalog);
    if (!cat) continue;
    for (const lv of cat.levels) {
      const n = lv.meshlets || 1;
      const parentErr = lv.lod + 1 < cat.levels.length ? cat.levels[lv.lod + 1].geomErr : Infinity;
      for (let m = 0; m < n; m++) {
        const src = lv.clusters?.[m];
        out.push({
          instance: inst.id,
          catalog: cat.id,
          lod: lv.lod,
          meshlet: m,
          cx: (src?.cx ?? inst.x) + (src?.ox || 0),
          cy: (src?.cy ?? inst.y) + (src?.oy || 0),
          cz: (src?.cz ?? inst.z) + (src?.oz || 0),
          radius: src?.radius ?? cat.radius / Math.sqrt(n),
          cone: src?.cone || [0, 1, 0],
          coneCutoff: src?.coneCutoff ?? 1,
          ownError: lv.geomErr,
          parentError: parentErr,
          world: [inst.x, inst.y, inst.z],
          ry: inst.ry || 0,
          drawRadius: cat.radius,
          tris: src?.tris || Math.max(4, Math.round(MESHLET_TRIS / Math.max(1, lv.lod + 1))),
        });
      }
    }
  }
  return out;
}
