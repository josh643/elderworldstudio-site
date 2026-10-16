// Plants: every plant in the Elderverse office is a DIFFERENT species (Joshua: no repeats anywhere). Stylized-realistic,
// procedural, cheap: each plant is ONE merged mesh with vertex colours on ONE shared Lambert material (so the static
// batcher folds them all into a single draw call), ~150-700 tris each. place() hands out the next unused species and
// returns null when they're used up (callers then place nothing). ctx.plantSpecies records every placement; the sanity
// check fails on any duplicate.
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
let T, MAT;
const rnd = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function tint(g, hex) { g = g.index ? g.toNonIndexed() : g; const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }
// leaf blade: an outline (len x wid, tip shape) bent along its length, then oriented from a base point
function blade(len, wid, { tip = 0.5, bend = 0.25, seg = 5, notch = 0, round = 0 } = {}) {
  const s = new T.Shape(); s.moveTo(0, 0);
  const pts = []; for (let i = 1; i <= seg; i++) { const t = i / seg, w = wid * Math.sin(Math.PI * Math.pow(t, tip)) * (round ? Math.pow(Math.sin(Math.PI * t), 0.3) : 1); pts.push([w / 2, t * len]); }
  pts.forEach(([x, y], i) => { if (notch && i % 2 === 1 && i < seg - 1) s.lineTo(x * 0.45, y); s.lineTo(x, y); });
  for (let i = pts.length - 2; i >= 0; i--) { const [x, y] = pts[i]; s.lineTo(-x, y); if (notch && i % 2 === 1 && i < seg - 1) s.lineTo(-x * 0.45, y); }
  s.lineTo(0, 0); const g = new T.ShapeGeometry(s, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / len; p.setZ(i, -bend * len * y * y); } g.computeVertexNormals(); return g;
}
const place3 = (g, x, y, z, yaw, tilt) => { g.rotateX(-Math.PI / 2 + (Math.PI / 2 - tilt)); g.rotateY(yaw); g.translate(x, y, z); return g; };   // tilt: 0 = flat out, PI/2 = straight up
function stem(h, r, col, x = 0, z = 0, y0 = 0, lean = 0, yaw = 0) { const g = new T.CylinderGeometry(r * 0.7, r, h, 5, 1); g.translate(0, h / 2, 0); g.rotateZ(lean); g.rotateY(yaw); g.translate(x, y0, z); return tint(g, col); }
const POTS = [ // [shape, colour]
  ['taper', '#b5623f'], ['cyl', '#e9e4da'], ['box', '#2b2b30'], ['bowl', '#6f8a8c'], ['taper', '#3a4a5a'], ['cyl', '#c9a24e'], ['box', '#8a6a4a'], ['bowl', '#d8cbb4'],
  ['cyl', '#1f3a32'], ['taper', '#e0d4c0'], ['box', '#b9b4aa'], ['bowl', '#a0593a'], ['cyl', '#5a3a2a'], ['taper', '#7a8a6a'], ['box', '#e8e8e8'], ['bowl', '#3e3e46'], ['cyl', '#9fb4c4'], ['taper', '#c47a5a']];
function pot(i, s = 1) { const [k, c] = POTS[i % POTS.length]; let g;
  if (k === 'box') { g = new T.BoxGeometry(0.4 * s, 0.42 * s, 0.4 * s); g.translate(0, 0.21 * s, 0); }
  else if (k === 'bowl') { g = new T.CylinderGeometry(0.3 * s, 0.18 * s, 0.3 * s, 10); g.translate(0, 0.15 * s, 0); }
  else if (k === 'cyl') { g = new T.CylinderGeometry(0.22 * s, 0.22 * s, 0.46 * s, 10); g.translate(0, 0.23 * s, 0); }
  else { g = new T.CylinderGeometry(0.24 * s, 0.16 * s, 0.44 * s, 10); g.translate(0, 0.22 * s, 0); }
  const top = k === 'bowl' ? 0.3 : k === 'box' ? 0.42 : k === 'cyl' ? 0.46 : 0.44, soil = new T.CylinderGeometry(0.19 * s, 0.19 * s, 0.02, 10); soil.translate(0, (top - 0.03) * s, 0);
  return [[tint(g, c), 0], [tint(soil, '#3a2a1e'), 0], top * s]; }
// species builders: (r, s, y0) -> geometries; y0 = soil height
const L = (col, ...a) => tint(place3(blade(...a.slice(0, 3)), ...a.slice(3)), col);
const SPECIES = {
  'fiddle-leaf fig': (r, s, y) => { const o = [stem(1.3 * s, 0.03 * s, '#5a4632', 0, 0, y)]; for (let i = 0; i < 14; i++) { const h = y + (0.7 + i * 0.05) * s, a = i * 2.4; o.push(L('#3d6b35', 0.34 * s, 0.26 * s, { round: 1, tip: 0.8, bend: 0.2 }, Math.cos(a) * 0.05, h, Math.sin(a) * 0.05, a, 0.5 + r() * 0.4)); } return o; },
  'monstera': (r, s, y) => { const o = []; for (let i = 0; i < 8; i++) { const a = i * 0.8 + r(), l = (0.5 + r() * 0.3) * s; o.push(stem(l, 0.012 * s, '#4f7a3a', 0, 0, y, 0.5 + r() * 0.4, a)); o.push(L('#2f6a35', 0.42 * s, 0.4 * s, { notch: 1, seg: 7, round: 1, tip: 0.7, bend: 0.3 }, Math.cos(-a + Math.PI / 2) * l * 0.5, y + l * 0.85, Math.sin(-a + Math.PI / 2) * l * 0.5, -a + Math.PI, 0.35)); } return o; },
  'snake plant': (r, s, y) => { const o = []; for (let i = 0; i < 11; i++) { const a = i * 2.1; o.push(L(i % 3 ? '#3f6a3a' : '#6f8a3a', (0.65 + r() * 0.35) * s, 0.09 * s, { tip: 0.45, bend: 0.04 }, Math.cos(a) * 0.07 * s, y, Math.sin(a) * 0.07 * s, a, 1.45 + r() * 0.1)); } return o; },
  'bird of paradise': (r, s, y) => { const o = []; for (let i = 0; i < 7; i++) { const a = i * 0.9, h = (0.8 + r() * 0.4) * s; o.push(stem(h, 0.012 * s, '#557a42', 0, 0, y, 0.15 + r() * 0.15, a)); o.push(L('#3a6e48', 0.55 * s, 0.2 * s, { tip: 0.7, bend: 0.1 }, Math.cos(-a + Math.PI / 2) * h * 0.2, y + h, Math.sin(-a + Math.PI / 2) * h * 0.2, -a, 1.25)); }
    o.push(tint(place3(blade(0.2 * s, 0.06 * s, { tip: 0.4 }), 0.05, y + 0.9 * s, 0, 0.3, 0.25), '#f08a2a')); return o; },
  'olive tree': (r, s, y) => { const o = [stem(1.0 * s, 0.035 * s, '#6e5e4e', 0, 0, y, 0.08)]; for (let i = 0; i < 5; i++) { const g = new T.IcosahedronGeometry((0.2 + r() * 0.08) * s, 0); g.scale(1, 0.7, 1); g.translate(Math.cos(i * 1.3) * 0.17 * s, y + (1.0 + (i % 3) * 0.14) * s, Math.sin(i * 1.3) * 0.17 * s); o.push(tint(g, i % 2 ? '#8a9a7a' : '#7a8c6a')); } return o; },
  'areca palm': (r, s, y) => { const o = []; for (let i = 0; i < 6; i++) { const a = i * 1.05; o.push(stem(0.9 * s, 0.012 * s, '#8a9a4a', 0, 0, y, 0.35, a)); for (let k = 0; k < 7; k++) { const t = 0.35 + k * 0.09, rr = 0.9 * s * Math.sin(0.35) * t, h = y + 0.9 * s * Math.cos(0.35) * t; for (const sd of [-1, 1]) o.push(L('#5a8a3a', 0.28 * s, 0.04 * s, { tip: 0.5, bend: 0.3 }, Math.cos(-a + Math.PI / 2) * rr, h, Math.sin(-a + Math.PI / 2) * rr, -a + sd * 1.1, 0.4)); } } return o; },
  'ZZ plant': (r, s, y) => { const o = []; for (let i = 0; i < 7; i++) { const a = i * 0.9, h = (0.5 + r() * 0.25) * s; o.push(stem(h, 0.012 * s, '#3a5a2a', 0, 0, y, 0.25, a)); for (let k = 1; k < 6; k++) { const t = k / 6, px = Math.cos(-a + Math.PI / 2) * Math.sin(0.25) * h * t, pz = Math.sin(-a + Math.PI / 2) * Math.sin(0.25) * h * t; for (const sd of [-1, 1]) o.push(L('#1f4a26', 0.08 * s, 0.045 * s, { round: 1, tip: 0.8 }, px, y + h * t, pz, -a + sd * 1.3, 0.6)); } } return o; },
  'rubber plant': (r, s, y) => { const o = [stem(1.1 * s, 0.025 * s, '#4a3a2a', 0, 0, y)]; for (let i = 0; i < 10; i++) { const a = i * 2.3; o.push(L('#1e2e22', 0.28 * s, 0.13 * s, { round: 1, tip: 0.6, bend: 0.1 }, 0, y + (0.35 + i * 0.075) * s, 0, a, 0.7)); } return o; },
  'pothos': (r, s, y) => { const o = []; for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 0.2 * s; for (let k = 0; k < 4; k++) o.push(L(k % 2 ? '#6a9a3a' : '#4f8a34', 0.1 * s, 0.08 * s, { round: 1, tip: 0.7, bend: 0.3 }, Math.cos(a) * (d + 0.02 * k), y - 0.08 * k * s, Math.sin(a) * (d + 0.02 * k), -a - Math.PI / 2, 0.3)); } return o; },
  'peace lily': (r, s, y) => { const o = []; for (let i = 0; i < 10; i++) { const a = i * 0.63; o.push(L('#2a5a2e', 0.32 * s, 0.11 * s, { tip: 0.6, bend: 0.35 }, 0, y, 0, a, 1.0)); } for (let i = 0; i < 3; i++) { const a = i * 2.1; o.push(stem(0.45 * s, 0.006 * s, '#5a8a3a', 0, 0, y, 0.1, a)); o.push(L('#f4f2ea', 0.12 * s, 0.07 * s, { round: 1, tip: 0.5, bend: -0.2 }, Math.cos(-a + Math.PI / 2) * 0.04, y + 0.45 * s, Math.sin(-a + Math.PI / 2) * 0.04, a, 1.3)); } return o; },
  'calathea': (r, s, y) => { const o = []; for (let i = 0; i < 9; i++) { const a = i * 0.7, h = (0.3 + r() * 0.15) * s; o.push(stem(h, 0.006 * s, '#6a3a4a', 0, 0, y, 0.3, a)); o.push(L(i % 2 ? '#3f6a4a' : '#5a7a4a', 0.26 * s, 0.16 * s, { round: 1, tip: 0.7, bend: 0.1 }, Math.cos(-a + Math.PI / 2) * h * 0.3, y + h, Math.sin(-a + Math.PI / 2) * h * 0.3, -a, 0.8)); } return o; },
  'columnar cactus': (r, s, y) => { const o = []; const c = new T.CylinderGeometry(0.09 * s, 0.11 * s, 0.9 * s, 8); c.translate(0, y + 0.45 * s, 0); o.push(tint(c, '#4a7a4a')); const a1 = new T.CylinderGeometry(0.055 * s, 0.06 * s, 0.35 * s, 7); a1.translate(0.14 * s, y + 0.6 * s, 0); o.push(tint(a1, '#4f804e')); const t = new T.SphereGeometry(0.09 * s, 8, 4, 0, 6.3, 0, 1.6); t.translate(0, y + 0.9 * s, 0); o.push(tint(t, '#4a7a4a')); return o; },
  'aloe': (r, s, y) => { const o = []; for (let i = 0; i < 14; i++) { const a = i * 2.4; o.push(L('#7a9a7a', (0.22 + (i % 4) * 0.03) * s, 0.06 * s, { tip: 0.4, bend: 0.25 }, 0, y, 0, a, 0.9 + (i % 3) * 0.2)); } return o; },
  'boston fern': (r, s, y) => { const o = []; for (let i = 0; i < 16; i++) { const a = i * 0.4; o.push(L(i % 2 ? '#5a8a3a' : '#4a7a32', 0.42 * s, 0.1 * s, { tip: 0.5, bend: 0.6, seg: 6 }, 0, y, 0, a, 0.9)); } return o; },
  'dracaena': (r, s, y) => { const o = []; for (const [hx, hh] of [[0, 1.2], [0.08, 0.9]]) { o.push(stem(hh * s, 0.025 * s, '#7a6a52', hx * s, 0, y)); for (let i = 0; i < 12; i++) { const a = i * 0.53; o.push(L(i % 2 ? '#4a7a3a' : '#7a8a3a', 0.3 * s, 0.035 * s, { tip: 0.4, bend: 0.35 }, hx * s, y + hh * s, 0, a, 0.9)); } } return o; },
  'jade plant': (r, s, y) => { const o = [stem(0.3 * s, 0.03 * s, '#6a5a3a', 0, 0, y)]; for (let i = 0; i < 4; i++) { o.push(stem(0.22 * s, 0.015 * s, '#6a5a3a', 0, 0, y + 0.25 * s, 0.6, i * 1.57)); for (let k = 0; k < 6; k++) { const g = new T.SphereGeometry(0.04 * s, 5, 3); g.scale(1, 0.45, 0.8); const a = i * 1.57; g.translate(Math.cos(-a + Math.PI / 2) * 0.13 * s + (k % 3 - 1) * 0.03 * s, y + (0.38 + (k >> 1) * 0.03) * s, Math.sin(-a + Math.PI / 2) * 0.13 * s + (k % 2) * 0.03 * s); o.push(tint(g, '#5a8a4a')); } } return o; },
  'kentia palm': (r, s, y) => { const o = []; for (let i = 0; i < 5; i++) { const a = i * 1.26; o.push(stem(1.2 * s, 0.01 * s, '#5a6a3a', 0, 0, y, 0.25, a)); for (let k = 0; k < 9; k++) { const t = 0.45 + k * 0.06, rr = 1.2 * s * Math.sin(0.25) * t, h = y + 1.2 * s * Math.cos(0.25) * t - k * 0.01; for (const sd of [-1, 1]) o.push(L('#2f5a2a', 0.3 * s, 0.03 * s, { tip: 0.5, bend: 0.6 }, Math.cos(-a + Math.PI / 2) * rr, h, Math.sin(-a + Math.PI / 2) * rr, -a + sd * 1.2, 0.2)); } } return o; },
  'philodendron birkin': (r, s, y) => { const o = []; for (let i = 0; i < 10; i++) { const a = i * 1.9; o.push(L(i % 3 ? '#2e5a34' : '#c8d8b0', 0.24 * s, 0.13 * s, { round: 1, tip: 0.6, bend: 0.2 }, 0, y + 0.05 * (i % 4) * s, 0, a, 0.9)); } return o; },
};
export const SPECIES_NAMES = Object.keys(SPECIES);
export function place(ctx, x, z, s = 1, parent) {
  T = ctx.THREE; MAT ||= new T.MeshLambertMaterial({ vertexColors: true });
  const used = (ctx.plantSpecies ||= []), name = SPECIES_NAMES.find(n => !used.some(u => u.species === n)); if (!name) return null;
  const i = SPECIES_NAMES.indexOf(name), r = rnd(1000 + i * 77), [[pg], [sg], top] = pot(i, s);
  const parts = [pg, sg, ...SPECIES[name](r, s, top - 0.02 * s)];
  const g = mergeGeometries(parts.map(p => { p = p.index ? p.toNonIndexed() : p; if (!p.attributes.normal) p.computeVertexNormals(); return p; }), false);
  const m = new T.Mesh(g, MAT); m.position.set(x, 0, z); m.rotation.y = (i * 1.3) % 6.28; m.name = 'plant:' + name; m.userData.species = name; (parent || ctx.scene).add(m);
  used.push({ species: name, x: +x.toFixed(2), z: +z.toFixed(2), tris: g.attributes.position.count / 3 });
  return m;
}
export function duplicates(ctx) { const seen = new Set(), d = []; for (const u of ctx.plantSpecies || []) { if (seen.has(u.species)) d.push(u); seen.add(u.species); } return d; }
