import { parseClusterDoc, defaultCatalogDoc, flattenGpuClusters, findCluster } from './format/clusters.js';
import { pickLodLevel, screenSpaceError, PIXEL_LIMIT } from './math/sse.js';
import { rebase, shouldRebase } from './math/origin.js';
import { cullClusters, pickInstanceLod } from './gpu/cull.js';
import { createStreamer } from './gpu/bindless.js';
import { morphClipRing, sampleHeight } from './scene/terrain.js';
import { cubeSphereGeometry, toThreeGeometry } from './scene/planet.js';
import { ATMOSPHERE_VERT, ATMOSPHERE_FRAG, scatterSky, fogWallForbidden } from './scene/atmosphere.js';
import { shouldUseImpostor } from './build/impostors.js';
import { QUALITY, IMPOSTOR_PX } from './constants.js';
import { createWebGL2 } from './backends/webgl2.js';
import { lookAtVP } from './math/frustum.js';

export async function pickBackend(opts = {}) {
  const canvas = opts.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  const wantGPU = opts.forceWebGL2 ? false : opts.prefer !== 'webgl2';
  if (wantGPU && typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const { createWebGPU } = await import('./backends/webgpu.js');
      return await createWebGPU(canvas, opts);
    } catch (e) {
      if (opts.fallback === 'none') throw e;
    }
  }
  if (canvas && typeof document !== 'undefined') {
    try { return await createWebGL2(canvas, opts); } catch (e) {
      if (opts.fallback === 'none') throw e;
    }
  }
  return createHeadless(opts);
}

function createHeadless() {
  let last = { calls: 0, tris: 0, backend: 'headless', bytes: 0 };
  return {
    name: 'headless',
    canvas: null,
    setSize() {},
    render(view) {
      const r = cullClusters(view.clusters || [], {
        eye: view.eye || [0, 2, 10],
        vp: view.vp,
        fov: view.fov || 62,
        height: view.height || 720,
        forceMax: view.forceMax,
      });
      last = { calls: r.calls, tris: r.tris, backend: 'headless', bytes: (view.clusters || []).length * 64, drew: r.drew, impostors: r.impostors };
      return last;
    },
    info: () => last,
    dispose() {},
  };
}

/**
 * Drop-in factory: `const R = await create({ canvas, fallback: 'webgl2' })`.
 * Adapter mode (opts.adapter) does not steal the THREE canvas; it exposes
 * GPU/CPU LOD, terrain morph, cube-sphere, atmosphere, streaming, and metrics.
 */
export async function create(opts = {}) {
  const backend = await pickBackend(opts);
  const quality = QUALITY[opts.quality || 'auto'] || QUALITY.auto;
  const streamer = createStreamer({ budget: quality.streamBudget });
  let clustersDoc = opts.clusters || defaultCatalogDoc();
  if (opts.clusters && !opts.clusters.catalog) clustersDoc = parseClusterDoc(opts.clusters);
  let instances = opts.instances || [];
  let heightfield = opts.heightfield || { n: 48, h: new Array(48 * 48).fill(0) };
  let origin = [0, 0, 0];
  let forceMax = false;
  let mode = opts.quality || 'auto';
  const info = {
    render: { calls: 0, triangles: 0 },
    memory: { geometries: 0, textures: 0, bytes: 0 },
  };
  let fps = 0, fa = 0, fn = 0;
  let lastCull = null;

  const api = {
    backend: backend.name,
    domElement: backend.canvas,
    info,
    streamer,
    PIXEL_LIMIT,
    clusters: clustersDoc,
    get forceMax() { return forceMax; },
    setClusters(doc) { clustersDoc = parseClusterDoc(doc); },
    setInstances(list) { instances = list; },
    setHeightfield(h) { heightfield = h; },
    forceMaxLod(on) { forceMax = !!on; },
    setQuality(m) { mode = QUALITY[m] ? m : 'auto'; },
    setSize(w, h, dpr) {
      const pr = dpr || 1;
      backend.setSize(Math.max(1, (w * pr) | 0), Math.max(1, (h * pr) | 0));
    },
    pickLod(obj, cam, height) {
      const levels = obj.levels || findCluster(clustersDoc, obj.catalog)?.levels || [0, 0.08, 0.22, 0.55];
      const eye = cam.position ? [cam.position.x, cam.position.y, cam.position.z] : cam;
      const pos = obj.position || obj;
      const d = Math.hypot(eye[0] - (pos.x ?? pos[0]), eye[1] - (pos.y ?? pos[1] ?? 0), eye[2] - (pos.z ?? pos[2]));
      const fov = cam.fov || 62;
      return pickLodLevel(levels, d, fov, height || 720, forceMax);
    },
    cull(view) {
      const gpu = flattenGpuClusters(clustersDoc, instances);
      lastCull = cullClusters(gpu, { ...view, forceMax });
      return lastCull;
    },
    morphTerrain(ringOpts) {
      return morphClipRing({ ...ringOpts, field: heightfield, forceMax });
    },
    sampleHeight(x, z, cover) { return sampleHeight(heightfield, x, z, cover); },
    rebase(cam, objects) { return rebase(cam, objects, origin); },
    shouldRebase,
    cubeSphere: cubeSphereGeometry,
    toThreeGeometry,
    atmosphere: { ATMOSPHERE_VERT, ATMOSPHERE_FRAG, scatterSky, fogWallForbidden },
    shouldUseImpostor,
    lookAtVP,
    render(view = {}) {
      const gpu = flattenGpuClusters(clustersDoc, instances);
      const v = {
        ...view,
        clusters: view.clusters || gpu,
        heightfield: view.heightfield || heightfield,
        forceMax: view.forceMax ?? forceMax,
        eye: view.eye || [0, 8, 40],
        target: view.target || [0, 0, 0],
        fov: view.fov || 62,
        far: view.far || QUALITY[mode].far,
        terrain: view.terrain !== false,
      };
      const r = backend.render(v);
      const out = r && typeof r.then === 'function' ? null : r;
      applyInfo(out || backend.info());
      return out || backend.info();
    },
    async renderAsync(view) {
      const r = api.render(view);
      return r && typeof r.then === 'function' ? r.then(x => (applyInfo(x), x)) : r;
    },
    tick(dt) {
      fa += dt; fn++;
      if (fa >= 0.5) { fps = fn / fa; fa = fn = 0; }
    },
    metrics() {
      const i = backend.info();
      return {
        fps,
        calls: i.calls ?? info.render.calls,
        tris: i.tris ?? info.render.triangles,
        memBytes: i.bytes ?? info.memory.bytes,
        memGeometries: info.memory.geometries,
        memTextures: info.memory.textures,
        backend: backend.name,
        compute: !!i.compute,
        present: i.present,
        sseLimit: PIXEL_LIMIT,
        impostorPx: IMPOSTOR_PX,
        forceMax,
        quality: mode,
        floatingOrigin: origin.slice(),
        visWrites: i.visWrites || 0,
        culledFrustum: i.culledFrustum || 0,
        culledLod: i.culledLod || 0,
        impostors: i.impostors || 0,
        streamUsed: streamer.used(),
        streamSlots: streamer.residency().length,
        flag: true,
      };
    },
    dispose() { backend.dispose(); },
  };

  function applyInfo(i) {
    if (!i) return;
    info.render.calls = i.calls || 0;
    info.render.triangles = i.tris || 0;
    info.memory.bytes = i.bytes || 0;
    info.memory.geometries = instances.length + 8;
    info.memory.textures = streamer.residency().length + 2;
  }

  if (opts.clustersUrl && typeof fetch === 'function') {
    fetch(opts.clustersUrl).then(r => r.ok ? r.json() : null).then(j => { if (j) api.setClusters(j); }).catch(() => {});
  }
  return api;
}

export function flagEnabled(search = '', storage = null) {
  if (/[?&]ewsrender=1/.test(search) || /[?&]render=ews/.test(search)) return true;
  try { return (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.getItem('ews-render') === '1'; }
  catch { return false; }
}
