// Realistic props (Draco meshes + KTX2 textures, CC0 / own work). Loaded after the scene is interactive and never on
// tier 0 (weak phones keep the simple boxes). Swaps datacenter rack boxes for the baked 42U rack model and furnishes
// the lobby. Add a prop = drop a GLB in assets/ and an entry in PLACE below (or in modules.json config.place).
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { DRACOLoader } from '../../vendor/jsm/loaders/DRACOLoader.js?v=169';
import { KTX2Loader } from '../../vendor/jsm/loaders/KTX2Loader.js?v=169';
const PLACE = [
  ['Sofa_01', -5.5, 6.5, Math.PI / 2], ['modern_arm_chair_01', -5.2, 3.6, Math.PI / 2 + 0.3], ['modern_arm_chair_01', 5.2, 3.6, -Math.PI / 2 - 0.3],
  ['potted_plant_02', -7, 8.8, 0], ['potted_plant_02', 7, 8.8, 0], ['potted_plant_02', -2.6, -1.4, 0], ['potted_plant_02', 2.6, -1.4, 0],
  ['drawer_cabinet', 2.4, -2.6, Math.PI], ['desk_lamp_arm_01', 1.4, -0.95, Math.PI],
];
export default {
  setup(ctx, cfg) {
    if (ctx.tier === 0) return;
    const { THREE, renderer: R, scene } = ctx;
    const draco = new DRACOLoader().setDecoderPath('/office/vendor/draco/');
    const ktx2 = new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(R);
    const L = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2), cache = {};
    const load = n => cache[n] ||= L.loadAsync(`/office/modules/props/assets/${n}.glb?v=1`).then(g => g.scene);
    // settle: drop a prop onto whatever surface is under it (floor, desk top), using its real bounding box
    const rc = new THREE.Raycaster(); rc.camera = ctx.camera; const bb = new THREE.Box3(), c = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    const settle = o => { o.updateMatrixWorld(true); bb.setFromObject(o); bb.getCenter(c); rc.set(new THREE.Vector3(c.x, 2.5, c.z), down); rc.far = 3;
      const hit = (() => { const ms = []; scene.traverse(m => { if (m.isMesh && !m.isSkinnedMesh) ms.push(m); }); return rc.intersectObjects(ms, false); })().find(h => { let p = h.object; while (p) { if (p === o) return false; p = p.parent; } return h.object.visible && !h.object.isSprite && !h.object.isSkinnedMesh && h.point.y < 1.6; });
      const top = hit ? hit.point.y : 0; o.position.y += top - bb.min.y; };
    /* GLB props (sofa, arm chairs, cabinet, plants, racks) arrive after the collider sweep and have alpha materials, so give
       each one an invisible proxy box (cheap AABB) and re-run the sweep. Lamps on desks are skipped (desk already collides). */
    const proxy = o => { if (/lamp/.test(o.userData.prop)) return; bb.setFromObject(o); const s = bb.getSize(new THREE.Vector3()), q = bb.getCenter(new THREE.Vector3());
      const px = new THREE.Mesh(new THREE.BoxGeometry(s.x, Math.min(s.y, 1.6), s.z), new THREE.MeshBasicMaterial()); px.visible = false; px.position.set(q.x, Math.min(s.y, 1.6) / 2 + 0.16, q.z); px.name = 'collider:' + o.userData.prop; px.userData.keep = 1; scene.add(px); };
    const run = async () => {
      const rack = await load('server_rack_42u').catch(() => null);
      if (rack) for (const b of ctx.use('racks') || []) { const r = rack.clone(); r.position.set(b.position.x, 0, b.position.z); r.userData.prop = 'server_rack_42u'; b.visible = false; b.parent?.remove(b); scene.add(r); settle(r); proxy(r); }
      for (const [n, x, z, ry] of cfg.place || PLACE) { const m = await load(n).catch(() => null); if (!m) continue; const o = m.clone(); o.position.set(x, 0, z); o.rotation.y = ry; o.userData.prop = n; scene.add(o); settle(o); proxy(o); }
      ctx.rebuildColliders?.();
    };
    setTimeout(run, 1500);   // after first frames: never delays the office opening
  },
};
