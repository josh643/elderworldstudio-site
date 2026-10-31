// Phase 1 distance: perceptually lossless on three.js (WebGL2 + log depth).
// Switch mesh LOD only when screen-space geometric error is under ~1 pixel.
// Terrain is a CPU CDLOD/clipmap with geomorphing. Floating origin rebases space
// when the ship leaves the safe float range. Atmosphere is scattering, not a fog wall.
// Cluster metrics come from tools/worlds-lod-build.mjs. Phase 2 (packages/ews-render)
// will move selection onto the GPU — see docs/ews-render-design.md.

const PIXEL_LIM = 1.0;
const PREF = {
  auto: { aniso: 8, far: 2400, clips: 6 },
  low: { aniso: 4, far: 900, clips: 5 },
  medium: { aniso: 8, far: 1800, clips: 6 },
  high: { aniso: 16, far: 3200, clips: 7 },
  ultra: { aniso: 16, far: 5000, clips: 8 },
};

function sse(geomErr, distance, fov, height) {
  const d = Math.max(0.05, distance);
  return (geomErr * height) / (d * 2 * Math.tan((fov * Math.PI / 180) / 2));
}

function sampleH(field, x, z, cover) {
  if (!field || !field.h) return 0;
  const n = field.n, half = cover / 2;
  const u = (x / cover + 0.5) * (n - 1), v = (z / cover + 0.5) * (n - 1);
  const x0 = Math.max(0, Math.min(n - 2, Math.floor(u))), z0 = Math.max(0, Math.min(n - 2, Math.floor(v)));
  const tx = u - x0, tz = v - z0;
  const h00 = field.h[z0 * n + x0] || 0, h10 = field.h[z0 * n + x0 + 1] || 0;
  const h01 = field.h[(z0 + 1) * n + x0] || 0, h11 = field.h[(z0 + 1) * n + x0 + 1] || 0;
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export default {
  setup(ctx) {
    if (!ctx.worlds) return;
    this.ctx = ctx; this.T = ctx.THREE; this.webgpu = !!navigator.gpu;
    this.mode = ctx.qualityMode || 'auto';
    this.viewDist = PREF[this.mode]?.far || PREF.auto.far;
    this.forceMax = false;
    this.clusters = null;
    this.origin = new this.T.Vector3();
    this.height = { n: 48, h: new Array(48 * 48).fill(0) };
    this.cover = 320;
    this.stats = {
      fps: 0, calls: 0, tris: 0, viewDist: this.viewDist, lodSwitches: 0,
      backend: this.webgpu ? 'webgpu-ready' : 'webgl2', sseLim: PIXEL_LIM,
      logDepth: !!ctx.renderer.capabilities.logarithmicDepthBuffer,
      floatingOrigin: [0, 0, 0],
    };
    this._fa = 0; this._fn = 0;
    this.applyAniso();
    ctx.cam.far = Math.max(ctx.cam.far, this.viewDist);
    ctx.cam.updateProjectionMatrix();
    this.group = new this.T.Group(); this.group.name = 'worlds-lod'; this.group.userData.keep = 1; this.group.userData.noFarCull = 1;
    ctx.scene.add(this.group);
    this.clips = [];
    this.buildClipmap();
    fetch('/office/assets/worlds/lod-clusters.json').then(r => r.ok ? r.json() : null).then(j => { this.clusters = j; }).catch(() => {});
    ctx.provide('worldsLod', this);
    const api = window.__ewsWorlds || (window.__ewsWorlds = {});
    api.metrics = () => this.snapshot();
    api.setQuality = m => this.setMode(m);
    api.forceMaxLod = on => { this.forceMax = !!on; };
    api.lodInfo = () => ({ pixelLimit: PIXEL_LIM, backend: this.stats.backend, viewDist: this.viewDist, webgpu: this.webgpu, forceMax: !!this.forceMax, logDepth: this.stats.logDepth });
  },
  applyAniso() {
    const an = Math.min(PREF[this.mode]?.aniso || 8, this.ctx.renderer.capabilities.getMaxAnisotropy());
    this.ctx.scene.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
          const t = m?.[k]; if (!t) continue;
          t.anisotropy = an; t.generateMipmaps = true; t.minFilter = this.T.LinearMipmapLinearFilter; t.needsUpdate = true;
        }
      }
    });
  },
  setMode(m) {
    this.mode = PREF[m] ? m : 'auto';
    this.viewDist = PREF[this.mode].far;
    this.ctx.qualityMode = this.mode;
    this.buildClipmap();
    this.applyAniso();
    this.ctx.cam.far = Math.max(this.viewDist, this.ctx.use('worldsTravel')?.zone === 'space' ? 5000 : this.viewDist);
    this.ctx.cam.updateProjectionMatrix();
  },
  buildClipmap() {
    const T = this.T, rings = PREF[this.mode]?.clips || 6;
    for (const c of this.clips) { c.geometry.dispose(); c.removeFromParent(); }
    this.clips = [];
    for (let i = 0; i < rings; i++) {
      const size = 32 * Math.pow(2, i), seg = Math.max(12, 64 - i * 6);
      const g = new T.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
      g.userData.geomErr = (size / seg) * 0.35;
      g.userData.base = g.attributes.position.array.slice();
      const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x5a7a48, transparent: true, opacity: 0.0 }));
      m.userData.clip = i; m.userData.noCollide = 1; m.userData.keep = 1; m.renderOrder = -2;
      this.group.add(m); this.clips.push(m);
    }
  },
  applyTerrain(state) {
    const t = state?.terrain?.town; if (!t || !t.h) return;
    this.height = t;
    this.morphTerrain();
  },
  morphTerrain() {
    if (!this.clips.length) return;
    const cam = this.ctx.cam, h = this.ctx.renderer.domElement.height || innerHeight;
    const px = cam.position.x, pz = cam.position.z;
    const field = this.height, cover = this.cover;
    let maxSse = 0;
    for (const mesh of this.clips) {
      const i = mesh.userData.clip;
      const step = 16 * Math.pow(2, i);
      const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
      mesh.position.set(cx, -0.04, cz);
      const g = mesh.geometry, pos = g.attributes.position, base = g.userData.base;
      const parentStep = step * 2;
      const d = Math.max(8, cam.position.distanceTo(mesh.position));
      const pxErr = this.forceMax ? 99 : sse(g.userData.geomErr, d, cam.fov, h);
      maxSse = Math.max(maxSse, pxErr);
      const morph = this.forceMax ? 0 : Math.min(1, Math.max(0, (pxErr - 0.35) / 0.65));
      for (let v = 0; v < pos.count; v++) {
        const lx = base[v * 3], lz = base[v * 3 + 2];
        const wx = lx + cx, wz = lz + cz;
        const yFine = sampleH(field, wx, wz, cover);
        const yCoarse = sampleH(field, Math.round(wx / parentStep) * parentStep, Math.round(wz / parentStep) * parentStep, cover);
        pos.setY(v, yFine * (1 - morph) + yCoarse * morph);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      const sculpted = field.h.some(v => Math.abs(v) > 0.02);
      mesh.material.opacity = sculpted && pxErr < PIXEL_LIM * 8 ? 1 : 0;
      mesh.material.transparent = mesh.material.opacity < 1;
      mesh.visible = sculpted;
    }
    this.stats.terrainSse = +maxSse.toFixed(3);
  },
  pickLod(obj) {
    if (this.forceMax) return 0;
    const cam = this.ctx.cam, h = this.ctx.renderer.domElement.height || innerHeight;
    const wp = obj.getWorldPosition(new this.T.Vector3());
    const d = cam.position.distanceTo(wp);
    const id = obj.userData.catalog;
    const cluster = this.clusters?.catalog?.find(c => c.id === id);
    const levels = cluster ? cluster.levels.map(l => l.geomErr) : (obj.userData.lodErr || [0, 0.08, 0.22, 0.55]);
    let chosen = 0;
    for (let i = 1; i < levels.length; i++) {
      if (sse(levels[i], d, cam.fov, h) < PIXEL_LIM) chosen = i;
    }
    obj.userData.sse = sse(levels[chosen], d, cam.fov, h);
    const box = obj.userData.bbox || (obj.userData.bbox = new this.T.Box3().setFromObject(obj));
    const radius = box.getSize(new this.T.Vector3()).length() * 0.5 || 1;
    obj.userData.projPx = (radius * h) / (d * 2 * Math.tan((cam.fov * Math.PI / 180) / 2));
    return chosen;
  },
  rebaseSpace() {
    const travel = this.ctx.use('worldsTravel');
    if (travel?.zone !== 'space' || !travel.space?.ship) return;
    const ship = travel.space.ship;
    if (ship.position.length() < 2200) return;
    const o = ship.position.clone(); o.y = 0;
    travel.space.elder.position.sub(o);
    travel.space.omni.position.sub(o);
    ship.position.sub(o);
    this.origin.add(o);
    this.stats.floatingOrigin = this.origin.toArray().map(v => +v.toFixed(1));
  },
  snapshot() {
    const r = this.ctx.renderer, info = r.info;
    return {
      fps: this.stats.fps,
      calls: info.render.calls,
      tris: info.render.triangles,
      viewDist: this.viewDist,
      pixelRatio: r.getPixelRatio(),
      memGeometries: info.memory.geometries,
      memTextures: info.memory.textures,
      backend: this.stats.backend,
      sseLimit: PIXEL_LIM,
      terrainSse: this.stats.terrainSse || 0,
      lodSwitches: this.stats.lodSwitches,
      forceMax: !!this.forceMax,
      quality: this.mode,
      logDepth: this.stats.logDepth,
      floatingOrigin: this.stats.floatingOrigin,
    };
  },
  onFrame(dt) {
    if (!this.ctx?.worlds) return;
    this._fa += dt; this._fn++;
    if (this._fa >= 0.5) { this.stats.fps = this._fn / this._fa; this._fa = this._fn = 0; }
    if (this.mode === 'auto' && this.stats.fps && this.stats.fps < 38) this.viewDist = Math.max(600, this.viewDist * 0.98);
    if (this.mode === 'auto' && this.stats.fps > 55) this.viewDist = Math.min(PREF.ultra.far, this.viewDist * 1.005);
    const travel = this.ctx.use('worldsTravel');
    this.ctx.cam.far = travel?.zone === 'space' ? 5000 : Math.max(this.viewDist, 800);
    this.ctx.cam.updateProjectionMatrix();
    const editor = this.ctx.use('worldsEditor');
    if (editor?.nodes) for (const n of editor.nodes.values()) {
      const lod = this.pickLod(n);
      if (n.userData.lastLod !== lod) { n.userData.lastLod = lod; this.stats.lodSwitches++; }
      n.visible = true;
      if (n.material && n.material.opacity !== 1) { n.material.transparent = false; n.material.opacity = 1; }
    }
    this.morphTerrain();
    this.rebaseSpace();
    this.stats.calls = this.ctx.renderer.info.render.calls;
    this.stats.tris = this.ctx.renderer.info.render.triangles;
    this.stats.viewDist = this.viewDist;
  },
};

export { sse, PIXEL_LIM, sampleH };
