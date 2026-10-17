// Office chairs + seat reservations (2026-10-16, Joshua: "never a seated pose without a chair; one agent per chair").
// Every desk chair in the office is one instance of two InstancedMeshes (base = star + casters + lift, upper = seat,
// back, arms) so 50 chairs cost 2 draw calls and can still roll out, swivel and tuck in per agent.
// Seat frame: root = where the agent's group stands when seated (feet), rot = the way the sitter faces (towards the
// monitor). Chair centre sits `off` metres BEHIND the root: 0.087 tucked under the seated pelvis, 0.337 at the end of
// Sitting_Enter / start of Sitting_Exit, 0.48 pulled out so a standing agent fits between chair and desk.
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
export const OFF = { tucked: 0.087, sat: 0.337, out: 0.48 };
let S = null;
function geos(T, lo) {
  const parts = { base: [], upper: [] }, col = (g, c) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count, a = new Float32Array(n * 3), C = new T.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
  const add = (which, g, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); parts[which].push(col(g, c)); };
  const rr = (w, h, r) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const ext = (w, h, r, d, bev) => { const g = new T.ExtrudeGeometry(rr(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: lo ? 1 : 2, curveSegments: lo ? 3 : 6 }); g.translate(0, 0, -d / 2); return g; };
  const METAL = 0x34373d, BLACK = 0x15161a, FAB = 0x2b3140, MESH = 0x23262e, CHROME = 0x9aa0a8, n = lo ? 8 : 14;
  // base: five-star with tapered arms, twin-wheel casters, hub and gas-lift cover
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, c = Math.cos(a), s = Math.sin(a);
    add('base', new T.BoxGeometry(0.045, 0.03, 0.27), METAL, s * 0.155, 0.085, c * 0.155, 0.12, a, 0);
    add('base', new T.BoxGeometry(0.03, 0.04, 0.03), BLACK, s * 0.29, 0.06, c * 0.29, 0, a, 0);
    for (const o of [-0.012, 0.012]) add('base', new T.CylinderGeometry(0.025, 0.025, 0.014, n), BLACK, s * 0.29 + Math.cos(a) * o, 0.026, c * 0.29 - Math.sin(a) * o, 0, a, Math.PI / 2); }
  add('base', new T.CylinderGeometry(0.05, 0.055, 0.06, n), METAL, 0, 0.1, 0);
  add('base', new T.CylinderGeometry(0.034, 0.034, 0.16, n), BLACK, 0, 0.2, 0);
  // upper (swivels): chrome lift, tilt mechanism, cushioned seat, lumbar spine, mesh back with headroom frame, arms
  add('upper', new T.CylinderGeometry(0.022, 0.022, 0.16, n), CHROME, 0, 0.33, 0);
  add('upper', new T.BoxGeometry(0.24, 0.045, 0.22), METAL, 0, 0.415, 0);
  add('upper', ext(0.5, 0.47, 0.08, 0.05, 0.022), FAB, 0, 0.465, 0, -Math.PI / 2);     // seat top at ~0.51
  add('upper', new T.BoxGeometry(0.07, 0.36, 0.03), METAL, 0, 0.6, -0.25, -0.12);
  add('upper', ext(0.46, 0.5, 0.09, 0.035, 0.018), MESH, 0, 0.86, -0.29, -0.12);
  add('upper', ext(0.44, 0.08, 0.03, 0.03, 0.012), FAB, 0, 0.7, -0.27, -0.12);         // lumbar pad
  for (const sx of [-1, 1]) { add('upper', new T.BoxGeometry(0.03, 0.17, 0.05), METAL, sx * 0.27, 0.57, -0.03);
    add('upper', new T.BoxGeometry(0.03, 0.03, 0.2), METAL, sx * 0.27, 0.49, -0.07);
    add('upper', ext(0.06, 0.24, 0.025, 0.02, 0.01), BLACK, sx * 0.27, 0.665, -0.02, -Math.PI / 2); }
  return { base: mergeGeometries(parts.base, false), upper: mergeGeometries(parts.upper, false) };
}
export function chairs(ctx) {
  if (S) return S; const T = ctx.THREE, CAP = 192, lo = (ctx.tier ?? 2) === 0, g = geos(T, lo);
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25 });
  const base = new T.InstancedMesh(g.base, mat, CAP), upper = new T.InstancedMesh(g.upper, mat, CAP);
  for (const m of [base, upper]) { m.count = 0; m.frustumCulled = false; m.userData.keep = 1; m.userData.label = 'office chairs'; m.name = 'chairs:' + (m === base ? 'base' : 'upper'); ctx.scene.add(m); }
  const seats = [], byRoot = new Map(), M4 = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), P = new T.Vector3(), ONE = new T.Vector3(1, 1, 1);
  const write = st => { const fx = Math.sin(st.rot), fz = Math.cos(st.rot), c = st.c; P.set(st.root.x - fx * c.off, 0, st.root.z - fz * c.off);
    M4.compose(P, Q.setFromAxisAngle(Y, st.rot + c.base), ONE); base.setMatrixAt(st.i, M4); M4.compose(P, Q.setFromAxisAngle(Y, st.rot + c.sw), ONE); upper.setMatrixAt(st.i, M4); base.instanceMatrix.needsUpdate = upper.instanceMatrix.needsUpdate = true; };
  S = {
    seats, base, upper,
    /* add a seat; root = THREE.Vector3 the sitter's group stands on (shared with u.home), rot = facing, aisle = walk-up distance */
    add(root, rot = Math.PI, { owner = null, kind = 'desk', aisle = 1.0, label = '' } = {}) {
      if (seats.length >= CAP) return null; const st = { i: seats.length, root, rot, owner, kind, aisle, label, holder: null, c: { off: OFF.tucked, sw: 0, base: ((seats.length * 37) % 11 - 5) * 0.05, tOff: OFF.tucked, tSw: 0, drive: false } };
      st.aislePt = new T.Vector3(root.x - Math.sin(rot) * aisle, 0, root.z - Math.cos(rot) * aisle);
      seats.push(st); byRoot.set(root, st); base.count = upper.count = seats.length; write(st); return st; },
    at: root => byRoot.get(root) || null,
    /* exclusive lock: an owned seat only for its owner; any seat holds exactly one agent */
    reserve(st, av) { if (!st) return false; const id = av.userData.a?.id; if (st.owner && st.owner !== id) return false; if (st.holder && st.holder !== av) return false;
      for (const o of seats) if (o !== st && o.holder === av) o.holder = null; st.holder = av; return true; },
    release(st, av) { if (st && st.holder === av) st.holder = null; },
    held: av => seats.find(s => s.holder === av) || null,
    update(dt) { for (const st of seats) { const c = st.c; if (!st.holder) { c.tOff = OFF.tucked; c.tSw = 0; c.drive = false; }
        if (c.drive) { write(st); continue; }   /* the sitter drives the chair directly during tuck/untuck */
        const dO = c.tOff - c.off, dS = c.tSw - c.sw; if (Math.abs(dO) < 1e-4 && Math.abs(dS) < 1e-4) continue;
        c.off += Math.sign(dO) * Math.min(Math.abs(dO), dt * 0.9); c.sw += Math.sign(dS) * Math.min(Math.abs(dS), dt * 2.6); write(st); } },
    audit() { const seen = new Map(), dup = []; for (const st of seats) if (st.holder) { const n = st.holder.userData.a?.name; if (seen.has(st.holder)) dup.push({ agent: n, seats: [seen.get(st.holder), st.i] }); seen.set(st.holder, st.i); }
      return { seats: seats.length, held: seen.size, duplicateHolders: dup }; },
  };
  return S;
}
