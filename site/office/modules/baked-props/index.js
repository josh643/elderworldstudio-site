// Places EWS-owned baked GLB props (incoming/elderverse-baked) into the live office/town.
// Lazy-loaded, tier-gated, fail-soft. Colliders use the same extraCols rects as engine.js.
// Interior pieces wait for lobbyAt; campus/town pieces wait for ctx.shell (built after modules).
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { DRACOLoader } from '../../vendor/jsm/loaders/DRACOLoader.js?v=169';

const BASE = '/office/assets/elderverse/';
const FILE = id => BASE + id + '_baked.glb';

// Visitor-facing first: lobby + plaza + District 1. Upper-floor / CFO pieces stay in the pack for later rooms.
const INTERIOR = [
  { id: '0-20261016-1900-ev001-r01-lobby-receptiondesk', at: 'desk', s: 1, col: [1.4, 0.8] },
  { id: '0-20261016-1900-ev004-r01-lobby-bench', at: 'benchL', s: 1, col: [1.1, 0.4] },
  { id: '0-20261016-1900-ev004-r01-lobby-bench', at: 'benchR', s: 1, col: [1.1, 0.4] },
  { id: '0-20261016-1900-ev010-r02-collab-meetingtable', at: 'hubTable', s: 1, col: [1.2, 0.8] },
  { id: '0-20261016-1900-ev014-r02-collab-loungesofa', at: 'hubSofa', s: 1, col: [1.2, 0.5] },
  { id: '0-20261016-1900-ev015-r02-collab-arearug', at: 'hubRug', s: 1 },
];
const EXTERIOR = [
  { id: '0-20261016-1900-ev062-r11-exterior-townarchway', at: 'arch', s: 1, col: [2.2, 0.6] },
  { id: '0-20261016-1900-ev061-r11-exterior-pathtile', at: 'path', s: 1, inst: true },
  { id: '0-20261016-1900-ev058-r11-exterior-tree', at: 'trees', s: 1, inst: true, col: [0.8, 0.8] },
  { id: '0-20261016-1900-ev059-r11-exterior-shrub', at: 'shrubs', s: 1, inst: true },
  { id: '0-20261016-1900-ev069-r12-town-streettile', at: 'street', s: 1, inst: true },
  { id: '0-20261016-1900-ev063-r12-town-lotsmall', at: 'lotS', s: 1, col: [3, 3] },
  { id: '0-20261016-1900-ev064-r12-town-lotmedium', at: 'lotM', s: 1, col: [4, 4] },
  { id: '0-20261016-1900-ev068-r12-town-awning', at: 'awning', s: 1 },
];

export default {
  async setup(ctx) {
    this.ctx = ctx; this.placed = false; this.cache = new Map();
    if ((ctx.tier ?? 2) === 0) return;   // cheap devices keep procedural boxes
    this.loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/'));
    this._interior = this.placeInterior();
  },
  async load(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const p = this.loader.loadAsync(FILE(id)).catch(() => null);
    this.cache.set(id, p);
    return p;
  },
  async placeOne(spec, x, y, z, ry = 0) {
    const g = await this.load(spec.id); if (!g) return null;
    const o = g.scene.clone(true);
    o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(spec.s || 1);
    o.userData.keep = 1; o.userData.baked = spec.id;
    o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.frustumCulled = true; } });
    this.ctx.scene.add(o);
    if (spec.col) {
      const [hx, hz] = spec.col;
      const r = [x - hx, z - hz, x + hx, z + hz]; r.src = 'baked:' + spec.id;
      (this.ctx.extraCols ||= []).push(r);
    }
    return o;
  },
  async placeInterior() {
    const ctx = this.ctx, L = ctx.lobbyAt || { x: 0, z: 0 };
    const spots = {
      desk: [L.x, 0, L.z - 2, Math.PI],
      benchL: [L.x - 6.2, 0, L.z + 6.2, 0.2],
      benchR: [L.x + 6.2, 0, L.z + 6.2, -0.2],
      hubTable: [L.x - 6.4, 0, L.z + 2.2, 0],
      hubSofa: [L.x - 6.4, 0, L.z + 0.4, 0],
      hubRug: [L.x - 6.4, 0.01, L.z + 2.2, 0],
    };
    for (const spec of INTERIOR) {
      const a = spots[spec.at]; if (!a) continue;
      await this.placeOne(spec, a[0], a[1], a[2], a[3]);
    }
    ctx.rebuildColliders?.();
  },
  async placeExterior() {
    const ctx = this.ctx, sh = ctx.shell; if (!sh) return;
    const X0 = sh.EN?.x || 0, Z0 = sh.fZ;
    const AVE = Z0 + 62;
    await this.placeOne(EXTERIOR[0], X0, 0, AVE - 4, 0);   // town archway on the avenue
    const path = await this.load('0-20261016-1900-ev061-r11-exterior-pathtile');
    const tree = await this.load('0-20261016-1900-ev058-r11-exterior-tree');
    const shrub = await this.load('0-20261016-1900-ev059-r11-exterior-shrub');
    const street = await this.load('0-20261016-1900-ev069-r12-town-streettile');
    const stamp = (gltf, x, y, z, ry = 0, s = 1) => {
      if (!gltf) return;
      const o = gltf.scene.clone(true); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s);
      o.userData.keep = 1; o.userData.noCollide = 1; o.traverse(m => { if (m.isMesh) m.frustumCulled = true; });
      ctx.scene.add(o);
    };
    if ((ctx.tier ?? 2) > 0) {
      for (let z = Z0 + 12; z < AVE - 6; z += 3.2) stamp(path, X0, 0.01, z, 0, 1);
      for (const [x, z] of [[X0 - 11, Z0 + 10], [X0 + 11, Z0 + 10], [X0 - 16, Z0 + 22], [X0 + 14, Z0 + 28], [X0 - 20, AVE - 8], [X0 + 18, AVE - 10]]) stamp(tree, x, 0, z, x * 0.1, 0.85);
      for (const [x, z] of [[X0 - 8, Z0 + 14], [X0 + 8.5, Z0 + 15], [X0 - 14, Z0 + 40]]) stamp(shrub, x, 0, z, 0, 1);
      for (let x = -40; x <= 40; x += 6) stamp(street, X0 + x, 0.02, AVE, 0, 1);
    }
    await this.placeOne(EXTERIOR[5], X0 - 13, 0, AVE + 18, 0);   // L05-ish small lot
    await this.placeOne(EXTERIOR[6], X0 + 13, 0, AVE + 18, 0);   // L06-ish medium lot
    await this.placeOne(EXTERIOR[7], X0 - 13, 2.4, AVE + 10, 0);
    ctx.rebuildColliders?.();
  },
  onFrame() {
    if (this.placed || (this.ctx.tier ?? 2) === 0) return;
    if (!this.ctx.shell) return;
    this.placed = true;
    this.placeExterior();
  },
};
