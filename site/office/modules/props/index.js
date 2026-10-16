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
    const run = async () => {
      const rack = await load('server_rack_42u').catch(() => null);
      if (rack) for (const b of ctx.use('racks') || []) { const r = rack.clone(); r.position.set(b.position.x, 0, b.position.z); scene.add(r); b.visible = false; }
      for (const [n, x, z, ry] of cfg.place || PLACE) { const m = await load(n).catch(() => null); if (!m) continue; const o = m.clone(); o.position.set(x, n === 'desk_lamp_arm_01' ? 1.16 : 0, z); o.rotation.y = ry; scene.add(o); }
    };
    setTimeout(run, 1500);   // after first frames: never delays the office opening
  },
};
