// Plants: every plant in the office is a DIFFERENT species (Joshua: no repeats anywhere). Real CC0 models (Poly Haven, same
// family as our furniture GLBs), one variant per species, Draco + WebP 512. Species that ship without a pot are planted in a
// modelled pot with a soil top; every plant sits on the floor. place() returns a group immediately and fills it when the GLB
// arrives; it hands out the next unused species and returns null when they're used up. ctx.plantSpecies records every
// placement and duplicates() must stay empty (sanity check).
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { DRACOLoader } from '../vendor/jsm/loaders/DRACOLoader.js?v=169';
//            file                     name                 total height  pot (null = has its own)
const LIST = [
  ['pachira_aquatica_01',   'money tree',          1.55, 'terracotta'],
  ['potted_plant_01',       'potted plant 01',     1.35, null],
  ['potted_plant_04',       'succulent pot',       0.6,  null],
  ['searsia_lucida',        'searsia shrub',       1.6,  'black'],
  ['potted_plant_02',       'potted plant 02',     0.95, null],
  ['anthurium_botany_01',   'anthurium',           0.85, 'white'],
  ['fir_sapling',           'fir sapling',         1.3,  'sage'],
  ['shrub_02',              'evergreen shrub',     1.15, 'navy'],
  ['calathea_orbifolia_01', 'calathea orbifolia',  0.8,  'basket'],
  ['othonna_cerarioides',   'othonna',             1.2,  'terracotta2'],
  ['pine_sapling_small',    'pine sapling',        1.35, 'concrete2'],
  ['fern_02',               'fern',                0.85, 'white2'],
  ['wild_rooibos_bush',     'rooibos bush',        0.95, 'white', 2.2],
  ['didelta_spinosa',       'didelta',             1.1,  'sage2'],
  ['leipoldtia_schultzei',  'leipoldtia',          0.7,  'basket2'],
  ['periwinkle_plant',      'periwinkle',          0.7,  'navy2'],
  ['cheiridopsis_succulent','cheiridopsis',        0.6,  'terracotta3'],
  ['quiver_tree_01',        'quiver tree',         1.75, 'concrete'],
];
const POTS = { terracotta: [0xb5653e, 'taper'], terracotta2: [0xa65a38, 'bowl'], terracotta3: [0xc07a50, 'rim'], concrete: [0x9a9a96, 'cyl'], concrete2: [0x85837e, 'taper'],
  black: [0x1c1c1e, 'tall'], black2: [0x232326, 'bowl'], white: [0xeeeae2, 'rim'], white2: [0xe4e0d6, 'taper'], sage: [0x8aa088, 'cyl'], sage2: [0x7d9a84, 'rim'],
  navy: [0x283a5c, 'tall'], navy2: [0x34486e, 'bowl'], basket: [0xb89566, 'basket'], basket2: [0xa98858, 'basket'] };
let loader; const cache = {};
const load = (T, f) => cache[f] ||= (loader ||= new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/'))).loadAsync(`/office/assets/plants/${f}.glb?v=1`).then(g => g.scene);
function pot(T, style, h, r) {   // lathe pot + soil disc; returns { group, top }
  const [col, shape] = POTS[style], g = new T.Group(), k = r;
  const prof = { taper: [[0.72, 0], [1, h]], cyl: [[1, 0], [1, h]], tall: [[0.8, 0], [0.92, h * 0.7], [1, h]], bowl: [[0.55, 0], [0.95, h * 0.55], [1, h]], rim: [[0.75, 0], [0.9, h * 0.82], [1.06, h * 0.84], [1.06, h]], basket: [[0.8, 0], [1, h]] }[shape];
  const pts = [new T.Vector2(0.001, 0)]; for (const [rr, y] of prof) pts.push(new T.Vector2(rr * k, y)); const tr = prof[prof.length - 1][0] * k;
  pts.push(new T.Vector2(tr - 0.025, h), new T.Vector2(tr - 0.03, h * 0.8));
  const m = new T.MeshStandardMaterial({ color: col, roughness: shape === 'basket' ? 0.95 : style.startsWith('white') || style.startsWith('navy') || style.startsWith('sage') ? 0.35 : 0.85 });
  if (shape === 'basket') { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#' + col.toString(16).padStart(6, '0'); x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(60,40,20,.45)'; x.lineWidth = 3; for (let i = 0; i < 128; i += 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); } for (let i = 0; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); } m.map = new T.CanvasTexture(c); m.map.wrapS = m.map.wrapT = T.RepeatWrapping; m.map.repeat.set(6, 2); m.map.colorSpace = T.SRGBColorSpace; }
  const body = new T.Mesh(new T.LatheGeometry(pts, 24), m); g.add(body);
  const soil = new T.Mesh(new T.CircleGeometry(tr - 0.03, 20).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 })); soil.position.y = h * 0.93; g.add(soil);
  return { group: g, top: h * 0.93 };
}
export const SPECIES_NAMES = LIST.map(l => l[1]);
let pending = 0, rebuildT = 0;
export function place(ctx, x, z, s = 1, parent) {
  const T = ctx.THREE, used = (ctx.plantSpecies ||= []), i = LIST.findIndex(l => !used.some(u => u.species === l[1])); if (i < 0) return null;
  const [file, name, H0, style, lift = 1] = LIST[i], H = H0 * Math.min(1.15, Math.max(0.8, s)), g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = (i * 1.3) % 6.28; g.name = 'plant:' + name; g.userData.species = name; g.userData.keep = 1; g.userData.noFarCull = 1;
  (parent || ctx.scene).add(g); const rec = { species: name, file, x: +x.toFixed(2), z: +z.toFixed(2), loaded: false }; used.push(rec);
  pending++;
  load(T, file).then(src => {
    const m = src.clone(true); const bb = new T.Box3().setFromObject(m), sz = bb.getSize(new T.Vector3());
    let ph, r, top = 0;
    if (style) { r = Math.min(0.3, Math.max(0.15, H * 0.16)); ph = Math.min(0.55, Math.max(0.24, H * 0.3)); const p = pot(T, style, ph, r); g.add(p.group); top = p.top; }
    const want = H - top, sc = want / sz.y; m.scale.setScalar(sc); bb.setFromObject(m); m.position.set(-(bb.min.x + bb.max.x) / 2, top - bb.min.y - (style ? 0.02 : 0), -(bb.min.z + bb.max.z) / 2);
    m.traverse(o => { if (o.isMesh) { o.userData.noCollide = 1; if (o.material) { if (lift !== 1) { o.material = o.material.clone(); o.material.color.multiplyScalar(lift); o.material.normalScale?.set(0.4, 0.4); } o.material.side = T.DoubleSide; if (o.material.transparent && o.material.alphaTest === 0) { o.material.alphaTest = 0.5; o.material.transparent = false; } } } });
    g.add(m); g.updateMatrixWorld(true);
    const fb = new T.Box3().setFromObject(g), cw = style ? r * 1.1 : Math.min(0.35, (fb.max.x - fb.min.x) / 3), wp = g.getWorldPosition(new T.Vector3());
    (ctx.extraCols ||= []).push([wp.x - cw, wp.z - cw, wp.x + cw, wp.z + cw]);
    rec.loaded = true; rec.h = +(fb.max.y - fb.min.y).toFixed(2); rec.minY = +fb.min.y.toFixed(3);
  }).catch(e => { rec.error = String(e).slice(0, 80); }).finally(() => { if (--pending === 0) { clearTimeout(rebuildT); rebuildT = setTimeout(() => ctx.rebuildColliders?.(), 200); } });
  return g;
}
export function duplicates(ctx) { const seen = new Set(), d = []; for (const u of ctx.plantSpecies || []) { if (seen.has(u.species)) d.push(u); seen.add(u.species); } return d; }
