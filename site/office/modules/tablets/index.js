// Tablets (Joshua 2026-10-16): a real low-poly tablet (rounded body, bevel, glass front + bezel, camera dots, optional
// rugged case for security) carried by every campus agent away from the desk (IK grip in the left hand, follows the
// walk cycle), docked on the desk when they sit, and docked at fixed campus spots (reception check-in, hub board,
// merch counter, each floor's entrance, Floor 3 plan table). All tablets are 5 instanced draw calls with one shared
// body material; screens are ONE canvas atlas: only the 8 nearest tablets get a live screen, the rest a plain
// emissive tint. Screens and the tap panel use the desk-screen source of truth (monitors' liveBar: same feed item,
// same eased bar, same activity line). Field figures (world-live) can register with ctx.tablets.field(F, kind).
import { FLOORS } from '../../core/floors.js?v=1';
const SLOTS = 8, SW = 256, SH = 176, AW = 1024, AH = 360, MAXT = 112;
const NO_TAB = new Set(['receptionist', 'subceo']);
const HOLD = new Set(['walk', 'stand', 'talk', 'greet', 'nod']);
const TILT = 1.25;   // docked tablets lean back on their folio stand (rad from upright)
const scrub = s => String(s || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/(?:~|\.{0,2})?\/[\w.@-]+(?:\/[\w.@-]+)+/g, '[path]').replace(/\b(?:sk|pk|rk|ghp|gho|xox[abp]|AKIA)[-_A-Za-z0-9]{8,}\b/g, '[key]').replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[id]');
export default {
  setup(ctx) {
    const { THREE: T } = ctx, V3 = () => new T.Vector3(), self = this; this.ctx = ctx;
    /* ---------- geometry (vertex colours, shared material) ---------- */
    const rr = (w, h, r, hole) => { const s = hole ? new T.Path() : new T.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    const paint = (g, fn) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const col = fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
      g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; };
    const merge = gs => { let n = 0; for (const g of gs) n += g.attributes.position.count; const out = new T.BufferGeometry(); for (const k of ['position', 'normal', 'color']) { const a = new Float32Array(n * 3); let o = 0; for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new T.BufferAttribute(a, 3)); } out.computeBoundingSphere(); return out; };
    const TW = 0.24, TH = 0.168, TD = 0.006, BV = 0.0012, FZ = TD / 2 + BV;
    const GLASS = [0.035, 0.04, 0.05], BODY = [0.66, 0.68, 0.72];
    const body = paint(new T.ExtrudeGeometry(rr(TW, TH, 0.013), { depth: TD, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 1, curveSegments: 3 }).translate(0, 0, -TD / 2),
      (x, y, z, nx, ny, nz) => (nz > 0.6 && z > TD / 2 - 1e-4) ? GLASS : BODY);
    const camB = paint(new T.CylinderGeometry(0.0042, 0.0042, 0.0014, 8).rotateX(Math.PI / 2).translate(TW / 2 - 0.022, TH / 2 - 0.02, -FZ - 0.0006), () => [0.05, 0.05, 0.06]);
    const camF = paint(new T.CircleGeometry(0.0019, 6).translate(0, TH / 2 - 0.0075, FZ + 0.0002), () => [0.16, 0.18, 0.22]);
    const tabletGeo = merge([body, camB, camF]);
    const CW = TW + 0.022, CH = TH + 0.022;
    const ring = new T.Shape(); ring.copy(rr(CW, CH, 0.02)); ring.holes.push(rr(TW - 0.012, TH - 0.012, 0.008, true));
    const caseGeo = merge([paint(new T.ExtrudeGeometry(ring, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 3 }).translate(0, 0, -0.0055),
      (x, y) => (Math.abs(x) > CW / 2 - 0.03 && Math.abs(y) > CH / 2 - 0.03) ? [0.85, 0.42, 0.12] : [0.13, 0.14, 0.13]),
      paint(new T.ExtrudeGeometry(rr(CW, CH, 0.02), { depth: 0.002, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -FZ - 0.0022), () => [0.13, 0.14, 0.13])]);
    const cT = Math.cos(TILT), sT = Math.sin(TILT), FOL = [0.2, 0.21, 0.23];
    const kick = (() => { const hy = 0.03, hz = -FZ - 0.003, B0 = new T.Vector3(0, -TH / 2 - 0.006, 0.004), up = new T.Vector3(0, cT, sT), len = (hy - B0.y) * cT + (hz - B0.z) * sT;
      const gk = new T.BoxGeometry(0.1, len, 0.005), q0 = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), up); gk.applyQuaternion(q0); gk.translate(0, hy - up.y * len / 2, hz - up.z * len / 2); return gk; })();
    const folioGeo = merge([paint(new T.BoxGeometry(TW - 0.01, TH - 0.01, 0.003).translate(0, 0, -FZ - 0.0016), () => FOL), paint(new T.BoxGeometry(TW - 0.02, 0.01, 0.012).translate(0, -TH / 2 - 0.004, 0.0), () => FOL), paint(kick, () => FOL)]);
    const mountGeo = merge([paint(new T.BoxGeometry(TW + 0.03, TH + 0.03, 0.012).translate(0, 0, -FZ - 0.0065), () => [0.15, 0.16, 0.18]), paint(new T.BoxGeometry(TW - 0.02, 0.012, 0.014).translate(0, -TH / 2 - 0.012, -0.002), () => [0.15, 0.16, 0.18])]);
    const pedGeo = merge([paint(new T.CylinderGeometry(0.2, 0.22, 0.025, 12).translate(0, 0.0125, 0), () => [0.15, 0.16, 0.18]), paint(new T.CylinderGeometry(0.028, 0.028, 1.06, 8).translate(0, 0.53, -0.012), () => [0.55, 0.57, 0.6])]);
    this.tris = { tablet: tabletGeo.attributes.position.count / 3, case: caseGeo.attributes.position.count / 3 };
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
    const mk = (g, n, m = mat) => { const o = new T.InstancedMesh(g, m, n); o.count = 0; o.frustumCulled = false; Object.assign(o.userData, { keep: 1, noCollide: 1, noFarCull: 1, label: 'tablet' }); o.instanceMatrix.setUsage(T.DynamicDrawUsage); ctx.scene.add(o); return o; };
    const mBody = mk(tabletGeo, MAXT), mCase = mk(caseGeo, 24), mEasel = mk(folioGeo, 96), mMount = mk(mountGeo, 12), mPed = mk(pedGeo, 12);
    /* ---------- screen atlas ---------- */
    const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const g = cv.getContext('2d');
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const TINT = ['#2c4a78', '#1f6a6a', '#8a5a1c', '#0b0d12']; TINT.forEach((c, k) => { g.fillStyle = c; g.fillRect(k * 64, 352, 64, 8); });
    const sGeo = new T.PlaneGeometry(TW - 0.016, TH - 0.016).translate(0, 0, FZ + 0.0004), aUV = new T.InstancedBufferAttribute(new Float32Array(MAXT * 4), 4); sGeo.setAttribute('aUV', aUV);
    const sMat = new T.MeshBasicMaterial({ map: tex, toneMapped: false });
    sMat.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec4 aUV;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = uv * aUV.zw + aUV.xy;\n#endif'); };
    sMat.customProgramCacheKey = () => 'ews-tablet-screen';
    const mScr = mk(sGeo, MAXT, sMat);
    /* ---------- records ---------- */
    const recs = []; this.recs = recs; const byInst = [];
    const fixed = (kind, pos, ry, tilt, stand, extra = {}) => { const q = new T.Quaternion().setFromEuler(new T.Euler(-tilt, ry, 0, 'YXZ'));
      const r = { kind, role: kind, mode: 'fixed', stand, m: new T.Matrix4().compose(new T.Vector3(...pos), q, new T.Vector3(1, 1, 1)), sm: new T.Matrix4().compose(new T.Vector3(pos[0], 0, pos[2]), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(1, 1, 1)), ...extra };
      recs.push(r); return r; };
    const easelOn = (x, y, z, ry, kind, extra) => fixed(kind, [x, y + 0.028, z], ry, TILT, 'easel', extra);
    const pedestal = (x, z, ry, kind, extra) => { const r = fixed(kind, [x, 1.1, z], ry, 0.62, 'ped', extra); (ctx.extraCols ||= []).push([x - 0.24, z - 0.24, x + 0.24, z + 0.24]); return r; };
    /* fixed campus spots (positions from lobby / receptionist / arch-studio / floors geometry) */
    { const a = 0.45, r = 2.72; easelOn(r * Math.sin(a), 1.08, -3.6 + r * Math.cos(a), a, 'checkin', { title: 'Visitor check-in' }); }
    easelOn(-6.05, 0.468, 2.47, Math.atan2(-2.6 + 6.05, 6.8 - 2.47), 'board', { title: 'Team board' });
    easelOn(5.62, 1.047, 4.45, 0, 'merch', { title: 'Merch Store' });
    const core = ctx.core; this.floorDone = new Set();
    const addFloor = n => { if (!core || this.floorDone.has(n)) return; this.floorDone.add(n); const ox = n === 'G' ? 0 : (+n - 1) * 400, x = core.x + ox + 1.95, z = core.fz + 1.05;
      pedestal(x, z, Math.atan2(core.x + ox - x, core.fz + 3.2 - z), 'floor', { floor: n, title: 'Floor ' + n });
    };
    for (const f of FLOORS) addFloor(f.n);
    if (ctx.archStudio) { const S = ctx.archStudio, ptx = S.x - 2.0, ptz = S.z + 2.3; easelOn(ptx + 0.95, 0.947, ptz - 0.36, Math.PI, 'plan', { title: 'Town plan' }); }
    /* agents: one tablet each (held when away from the desk, docked on the desk when seated) */
    const A = ctx.use('avatar'), seen = new Set();
    const roleOf = av => { const u = av.userData, id = u.a?.id || ''; return /^patrol-sec|^sec-/.test(id) ? 'sec' : (u.team === 'architecture' || /^(lead-arch|arch-)/.test(id)) ? 'arch' : 'campus'; };
    const scanAvatars = () => { for (const av of A?.all || []) { if (seen.has(av)) continue; seen.add(av); const u = av.userData, id = u.a?.id; if (!id || NO_TAB.has(id)) continue; if (!u.team && !/^patrol-/.test(id)) continue;
      const r = { kind: 'agent', av, role: roleOf(av), mode: 'hidden', m: new T.Matrix4(), sm: new T.Matrix4(), w: 0, t0: performance.now() }; recs.push(r);
      const hit = av.children.find(o => o.userData?.onPick); if (hit) { const orig = hit.userData.onPick; hit.userData.onPick = () => { if (r.mode === 'held') self.open(r); else orig(); }; } } };
    scanAvatars(); this.scanT = 0; this.scanAvatars = scanAvatars;
    /* field figures (instanced, world-live): ctx.tablets.field(F, 'arch'|'sec') every frame they are drawn */
    const field = new Map();
    ctx.tablets = { field: (F, kind) => { let r = field.get(F); if (!r) { r = { kind: 'field', F, role: kind === 'sec' ? 'sec' : 'arch', mode: 'hidden', m: new T.Matrix4(), t0: performance.now() }; field.set(F, r); recs.push(r); } r.seen = performance.now(); },
      open: r => self.open(r), openKind: k => { const r = recs.find(x => x.kind === k) || (k === 'holo' && recs.find(x => x.kind === 'plan')); if (r) self.open(r); return !!r; }, recs };
    this.fixed = fixed;
    /* ---------- pose helpers ---------- */
    const a = V3(), b = V3(), q = new T.Quaternion(), wq = new T.Quaternion(), pq = new T.Quaternion();
    const aimW = (bone, child, dir, w) => { if (!bone || !child) return; bone.getWorldPosition(a); child.getWorldPosition(b); const cur = b.sub(a).normalize(); q.setFromUnitVectors(cur, dir.clone().normalize()); if (w < 1) q.slerp(new T.Quaternion(), 1 - w);
      bone.getWorldQuaternion(wq); wq.premultiply(q); bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(wq)); bone.updateMatrixWorld(true); };
    const P = V3(), E = V3(), L = V3(), Hn = V3();
    const ik = (B, s, tgt, pole, fdir, w) => { const up = B['upperarm_' + s], lo = B['lowerarm_' + s], ha = B['hand_' + s], mi = B['middle_01_' + s]; if (!up || !lo || !ha) return;
      up.getWorldPosition(P); lo.getWorldPosition(L); ha.getWorldPosition(Hn); const L1 = P.distanceTo(L), L2 = L.distanceTo(Hn), D = tgt.clone().sub(P), d = Math.min(Math.max(D.length(), 0.05), (L1 + L2) * 0.995), dir = D.normalize();
      const aa = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - aa * aa)), pp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
      E.copy(P).addScaledVector(dir, aa).addScaledVector(pp, h); aimW(up, lo, E.clone().sub(P), w); lo.getWorldPosition(L); aimW(lo, ha, tgt.clone().sub(L), w); if (mi) aimW(ha, mi, fdir, w); };
    this.hold = (r, t, dt) => { const av = r.av, u = av.userData, B = u.bones || {}, ul = B.upperarm_l, ur = B.upperarm_r; if (!ul || !ur) return false;
      av.updateMatrixWorld(true); const pl = ul.getWorldPosition(V3()), pr = ur.getWorldPosition(V3()), k = Math.min(1.3, Math.max(0.75, pl.distanceTo(pr) / 0.3)), ry = av.rotation.y;
      const up = new T.Vector3(0, 1, 0), fwd = new T.Vector3(Math.sin(ry), 0, Math.cos(ry)), left = new T.Vector3(Math.cos(ry), 0, -Math.sin(ry));
      const walking = u.prevK === 'walk' || u.prevK === 'carry', bob = 0;
      const C = pl.clone().add(pr).multiplyScalar(0.5).addScaledVector(up, -0.36 * k + bob).addScaledVector(fwd, 0.3 * k).addScaledVector(left, 0.025 * k);
      const X = left.clone().negate(), Y = up.clone().multiplyScalar(0.55).addScaledVector(fwd, 0.835).normalize(), Z = new T.Vector3().crossVectors(X, Y);
      r.w = Math.min(1, r.w + dt * 4); const w = r.w;
      const wl = C.clone().addScaledVector(left, 0.088 * k).addScaledVector(Z, -0.028).addScaledVector(Y, -0.025);
      ik(B, 'l', wl, up.clone().negate().addScaledVector(left, 0.8).addScaledVector(fwd, -0.3), left.clone().multiplyScalar(-0.55).addScaledVector(Y, 0.75).addScaledVector(Z, -0.2), w);
      if (u.prevK === 'carry') { const wr = C.clone().addScaledVector(left, -0.088 * k).addScaledVector(Z, -0.028).addScaledVector(Y, -0.025);
        ik(B, 'r', wr, up.clone().negate().addScaledVector(left, -0.8).addScaledVector(fwd, -0.3), left.clone().multiplyScalar(0.55).addScaledVector(Y, 0.75).addScaledVector(Z, -0.2), w); }
      else if (!walking || r.role === 'sec') { const tap = Math.max(0, Math.sin(t * 2.6 + (r.ph ||= Math.random() * 6))) ** 3 * 0.025;
        const wr = C.clone().addScaledVector(left, -0.05 * k).addScaledVector(Z, 0.07 + tap).addScaledVector(Y, -0.035);
        ik(B, 'r', wr, up.clone().negate().addScaledVector(left, -0.8).addScaledVector(fwd, -0.35), Z.clone().multiplyScalar(-0.75).addScaledVector(Y, 0.55), w * 0.9); }
      const hl = B.hand_l.getWorldPosition(V3()); C.add(hl.sub(wl).multiplyScalar(w));   /* the tablet follows the real hand: never floats */
      r.m.makeBasis(X, Y, Z).setPosition(C); if (u.folder) u.folder.visible = false; return true; };
    this.fieldPose = r => { const F = r.F, walk = F.mode === 'walk', al = F.al ?? (walk ? -1.05 : -1.2), c = Math.cos(F.yaw), s = Math.sin(F.yaw);
      const lx = -0.27 + 0.1, ly = 1.44 - 0.56 * Math.cos(al) + 0.02, lz = -0.56 * Math.sin(al) - 0.02;   // hand of arm 0 (local), tablet centre toward the body
      const wx = F.x + lx * c + lz * s, wz = F.z - lx * s + lz * c, X = new T.Vector3(-c, 0, s), fwd = new T.Vector3(s, 0, c), Y = new T.Vector3(0, 0.55, 0).addScaledVector(fwd, 0.835).normalize(), Z = new T.Vector3().crossVectors(X, Y);
      r.m.makeBasis(X, Y, Z).setPosition(wx, (F.y || 0) + ly, wz); };
    /* ---------- feed (one source of truth: the same state + monitors' liveBar) ---------- */
    this.st = { work: [], last: {} }; this.hist = new Map(); this.prev = new Map();
    this.onState = st => { this.st = st; const now = new Map((st.work || []).map(w => [w.agent, w]));
      const push = (id, text) => { const h = this.hist.get(id) || []; if (h[0]?.text !== text) h.unshift({ text, at: Date.now() }); this.hist.set(id, h.slice(0, 3)); };
      for (const [id, l] of Object.entries(st.last || {})) if (!this.hist.has(id)) push(id, 'Done: ' + l);
      for (const [id, w] of this.prev) if (!now.has(id)) push(id, 'Done: ' + w.task);
      for (const [id, w] of now) { const p = this.prev.get(id); if (!p || p.task !== w.task || p.stage !== w.stage) push(id, (STG[w.stage] || w.stage) + ': ' + w.task); }
      this.prev = now; };
    const STG = { waiting: 'Queued', plan: 'Planning', build: 'Building', 'self-check': 'Self-check', QA: 'In QA', review: 'Waiting for review', ready: 'Ready to ship', released: 'Released' }; this.STG = STG;
    /* ---------- drawing ---------- */
    const fmt = ms => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
    const wrap = (txt, x, y, maxW, lh, maxL) => { let ln = '', L = 0; for (const wd of String(txt).split(/\s+/)) { if (g.measureText(ln + wd).width > maxW && ln) { g.fillText(ln.trim(), x, y); y += lh; ln = ''; if (++L >= maxL) return y; } ln += wd + ' '; } if (ln.trim()) { g.fillText(ln.trim(), x, y); y += lh; } return y; };
    const chip = (txt, x, y, col) => { g.font = '700 11px Inter, sans-serif'; const w = g.measureText(txt).width + 12; g.fillStyle = col + '33'; g.beginPath(); g.roundRect?.(x, y, w, 17, 8); if (!g.roundRect) g.rect(x, y, w, 17); g.fill(); g.fillStyle = col; g.fillText(txt, x + 6, y + 12.5); return w; };
    const bar = (v, col, y = 160) => { g.fillStyle = '#26324a'; g.fillRect(10, y, SW - 20, 6); g.fillStyle = col; g.fillRect(10, y, (SW - 20) * Math.max(0.03, Math.min(1, v)), 6); };
    this.itemOf = r => { const id = r.av?.userData.a?.id || r.F?.id || ''; return (this.st.work || []).find(w => w.agent === id || w.agent === id.replace(/^patrol-/, '')) || null; };
    const SECN = { 'sec-lead': 'Hœnir', 'sec-vuln': 'Geri', 'sec-harden': 'Sigyn', 'sec-pentest': 'Skírnir', 'sec-watch': 'Freki' };
    this.secOf = r => { const L = this.st.sec; if (!Array.isArray(L) || !L.length) return null; const id = String(r.av?.userData.a?.id || r.F?.id || '').replace(/^patrol-/, ''), nm = r.av?.userData.a?.name || r.F?.name || '';
      return L.find(z => z.agent === id || id.endsWith(z.agent) || z.name === nm || SECN[z.agent] === nm) || null; };
    this.lotNear = (x, z) => { const T2 = ctx.town; if (!T2?.lots?.length) return null; let best = null, bd = 1e9; for (const l of T2.lots) { if (!l) continue; const d = Math.hypot(l.cx - x, l.cz - z); if (d < bd) { bd = d; best = l; } } return bd < 60 ? best : null; };
    const LB = () => ctx.use('liveBar');
    const head = (title, sub, col) => { g.fillStyle = col; g.fillRect(0, 0, SW, 22); g.fillStyle = '#ffffff'; g.font = '700 12px Inter, sans-serif'; g.fillText(String(title).slice(0, 26), 8, 15); if (sub) { g.font = '500 10px Inter, sans-serif'; g.fillStyle = '#e6ecf5'; const w = g.measureText(sub).width; g.fillText(sub, SW - 8 - w, 15); } };
    this.draw = (r, slot) => { const x0 = (slot % 4) * SW, y0 = Math.floor(slot / 4) * SH; g.save(); g.beginPath(); g.rect(x0, y0, SW, SH); g.clip(); g.translate(x0, y0);
      g.fillStyle = '#0d1220'; g.fillRect(0, 0, SW, SH); try { (DRAW[r.kind] || DRAW.agent)(r); } catch (e) {} g.restore(); };
    const pub = ctx.publicMode;
    const DRAW = {
      agent: r => { const u = r.av?.userData || {}, a = u.a || {}, F = r.F, name = a.name || F?.name || 'Agent', s = this.itemOf(r), lb = LB();
        const col = r.role === 'sec' ? '#7a2e22' : r.role === 'arch' ? '#1f5f5f' : '#24406e', roleT = r.role === 'sec' ? 'PATROL' : r.role === 'arch' ? 'SURVEY' : (u.team || '').toUpperCase();
        head(pub ? (a.role || 'Studio agent') : name, roleT, col);
        if (pub) { for (let i = 0; i < 6; i++) { g.fillStyle = ['#3a5a8c', '#6a8f5a', '#8c6a3a'][i % 3]; g.fillRect(12, 34 + i * 18, 60 + ((i * 53) % 140), 7); } return; }
        if (r.role === 'sec') { const pos = r.av ? r.av.position : F, lot = pos && this.lotNear(pos.x, pos.z), t = performance.now() / 1000;   /* scan view */
          g.strokeStyle = '#ff9a5a55'; g.lineWidth = 1; for (const rad of [16, 32, 48]) { g.beginPath(); g.arc(62, 92, rad, 0, Math.PI * 2); g.stroke(); }
          g.strokeStyle = '#ffb27a'; g.lineWidth = 2; g.beginPath(); g.moveTo(62, 92); g.lineTo(62 + Math.cos(t * 1.6) * 48, 92 + Math.sin(t * 1.6) * 48); g.stroke();
          const z = this.secOf(r), SC = { critical: '#ff4d4d', high: '#ff7a3a', medium: '#ffc24a', low: '#7fd38a' };
          if (z) { const al = z.state === 'alert', dc = SC[z.sev] || (al ? '#ff4d4d' : '#7fd38a');
            chip(al ? 'ALERT' : z.state === 'checking' ? 'CHECKING' : 'PATROL', 124, 30, al ? '#ff4d4d' : z.state === 'checking' ? '#ffc24a' : '#7fd38a');
            g.fillStyle = '#fff'; g.font = '700 12px Inter, sans-serif'; wrap(z.check || 'Routine sweep', 124, 64, 124, 14, 2);
            g.fillStyle = dc; g.beginPath(); g.arc(129, 101, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#dfe6f2'; g.font = '600 11px Inter, sans-serif'; wrap(z.finding || 'No open findings', 138, 105, 112, 13, 3);
            if (z.target) { g.fillStyle = '#9fb0cc'; g.font = '500 10px Inter, sans-serif'; g.fillText('Target: ' + z.target, 124, 148); }
            g.fillStyle = '#9fb0cc'; g.font = '500 10px Inter, sans-serif'; g.fillText(((lot ? 'Near lot L' + String(lot.n).padStart(2, '0') : 'Campus') + ' · ' + fmt(performance.now() - r.t0) + ' on patrol').slice(0, 44), 10, 168);
            if (al) { g.strokeStyle = '#ff3b3b'; g.lineWidth = 4; g.strokeRect(2, 2, SW - 4, SH - 4); } }
          else { chip(s ? (STG[s.stage] || s.stage) : 'NO OPEN FINDINGS', 124, 36, s ? '#ffc24a' : '#7fd38a'); g.fillStyle = '#dfe6f2'; g.font = '600 12px Inter, sans-serif'; wrap(s ? scrub(s.task) : (lot ? 'Near lot L' + String(lot.n).padStart(2, '0') : 'Campus sweep'), 124, 74, 124, 15, 3); }
          return; }
        if (r.role === 'arch') { const L0 = ctx.town?.lots?.[8], W0 = 92, sc = L0 ? Math.min(W0 / L0.w, 62 / L0.d) : 1, lw = L0 ? L0.w * sc : 80, ld = L0 ? L0.d * sc : 50;   /* survey / plan view */
          g.strokeStyle = '#7fe0d0'; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(14, 36, lw, ld); g.setLineDash([]); g.fillStyle = '#7fe0d022'; g.fillRect(14 + lw * 0.2, 36 + ld * 0.25, lw * 0.5, ld * 0.45);
          g.fillStyle = '#bfeee6'; g.font = '600 10px Inter, sans-serif'; if (L0) { g.fillText(L0.w.toFixed(0) + ' m', 14 + lw / 2 - 10, 36 + ld + 12); g.save(); g.translate(14 + lw + 10, 36 + ld / 2 + 10); g.rotate(-Math.PI / 2); g.fillText(L0.d.toFixed(0) + ' m', 0, 0); g.restore(); g.fillText('Lot L' + String(L0.n).padStart(2, '0'), 16, 32); } }
        const tx = r.role === 'arch' ? 130 : 10, tw = r.role === 'arch' ? 118 : SW - 20;
        if (!s) { g.fillStyle = '#9fb0cc'; g.font = '700 22px Inter, sans-serif'; g.fillText('Idle', tx, 64); const l = this.st.last?.[a.id]; if (l) { g.font = '11px Inter, sans-serif'; g.fillStyle = '#7f8ea8'; wrap('Last: ' + scrub(l), tx, 90, tw, 14, 3); } return; }
        g.fillStyle = '#fff'; g.font = '700 13px Inter, sans-serif'; const y = wrap(scrub(s.task), tx, 42, tw, 16, 3);
        const P = lb ? lb.live(s.agent, s) : (s.progress || 0), col2 = s.blocked ? '#ff8a8a' : '#d9b45a'; chip((STG[s.stage] || s.stage) + (s.blocked ? ' · blocked' : '') + ' · ' + Math.round(P * 100) + '%', tx, Math.max(y + 2, 98), col2);
        g.font = '500 10px Inter, sans-serif'; g.fillStyle = '#9fb0cc'; g.fillText((lb ? lb.activity(s) : s.stage).slice(0, 44), 10, 150); bar(P, col2); },
      field: r => DRAW.agent(r),
      checkin: () => { head('Visitor check-in', 'Fólkvangr', '#5a3f1c'); g.font = '600 11px Inter, sans-serif'; g.fillStyle = '#e8dcc4'; FLOORS.forEach((f, i) => g.fillText(f.n + '  ' + f.name, 10, 42 + i * 15));
        const w = this.st.work || []; g.fillStyle = '#d9b45a'; g.font = '700 12px Inter, sans-serif'; g.fillText(w.length + ' working now', 10, 126); g.font = '500 10px Inter, sans-serif'; g.fillStyle = '#9fb0cc'; g.fillText(pub ? 'Tap for the directory' : w.slice(0, 4).map(x => x.name).join(' · ').slice(0, 44), 10, 142); g.fillText('Tap to open', 10, 162); },
      board: () => { head('Team board', 'all teams', '#24406e'); const B = this.board(); [['Now', '#ff7a5a', B.now], ['Next', '#d9b45a', B.next], ['Done', '#5fd38a', B.done]].forEach(([n, c, l], i) => { const x = 8 + i * 82; g.fillStyle = c; g.font = '700 12px Inter, sans-serif'; g.fillText(n + ' ' + l.length, x, 40); g.fillStyle = '#c9d3e6'; g.font = '500 9px Inter, sans-serif'; l.slice(0, 5).forEach((t, k) => g.fillText(String(pub ? '•••' : t).slice(0, 15), x, 58 + k * 16)); }); },
      merch: () => { head('Merch Store', 'browse', '#5a3f1c'); const M = (ctx.site?.merch || []).slice(0, 6); g.font = '600 11px Inter, sans-serif'; M.forEach((m, i) => { g.fillStyle = '#efe6d2'; g.fillText(String(m.title).slice(0, 30), 10, 44 + i * 19); g.fillStyle = '#d9b45a'; g.fillText(m.price || '', 214, 44 + i * 19); }); g.fillStyle = '#9fb0cc'; g.font = '500 10px Inter, sans-serif'; g.fillText('Tap to browse', 10, 164); },
      floor: r => { const F = FLOORS.find(f => f.n === r.floor) || FLOORS[0]; head('Floor ' + F.n + ' · ' + F.name, '', '#2a3550'); const T2 = this.floorTeams(F.n); g.font = '600 11px Inter, sans-serif';
        T2.slice(0, 6).forEach((t, i) => { g.fillStyle = '#e6ecf5'; g.fillText(t.name, 10, 44 + i * 17); g.fillStyle = t.working ? '#d9b45a' : '#7f8ea8'; g.fillText(t.working ? t.working + ' working' : 'quiet', 170, 44 + i * 17); });
        if (!T2.length) { g.fillStyle = '#9fb0cc'; g.fillText(F.sub || '', 10, 50); } g.fillStyle = '#9fb0cc'; g.font = '500 10px Inter, sans-serif'; g.fillText('Tap for live status', 10, 164); },
      holo: () => { const tm = ctx.use('townModel'), I = tm?.info(); head('Holo table', I ? I.mode.toUpperCase() : '', '#1f5f5f'); if (!I) return; g.font = '600 11px Inter, sans-serif'; g.fillStyle = '#9ff2ff'; g.fillText('Physical: current approved', 10, 42); g.fillStyle = I.hasProposed ? '#ffd27a' : '#9fb0cc'; g.fillText(I.hasProposed ? 'Hologram: PROPOSED · awaiting Joshua' : 'No proposed draft right now', 10, 60);
        if (I.hasProposed) { g.fillStyle = '#dfe6f2'; g.fillText(('Vé ' + (I.qa || '?') + ' · ' + I.lots + ' lots · phase ' + I.phase).slice(0, 40), 10, 78); } ['current', 'proposed', 'overlay'].forEach((m, i) => chip(m[0].toUpperCase() + m.slice(1), 10 + i * 80, 100, m === I.mode ? '#3fe6ff' : '#55607a')); const L = I.hist || []; g.fillStyle = '#9fb0cc'; g.font = '500 10px Inter, sans-serif'; g.fillText(L.length ? 'Revision v' + L.length + ' of ' + L.length : '', 10, 140); g.fillText('Tap the table or this tablet', 10, 160); },
      plan: () => { head('Town plan', 'lot map', '#1f5f5f'); const lots = (ctx.town?.lots || []).filter(Boolean); if (!lots.length) return; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const l of lots) { x0 = Math.min(x0, l.cx - l.w / 2); x1 = Math.max(x1, l.cx + l.w / 2); z0 = Math.min(z0, l.cz - l.d / 2); z1 = Math.max(z1, l.cz + l.d / 2); }
        const s = Math.min((SW - 20) / (x1 - x0), (SH - 40) / (z1 - z0)), jobs = this.jobs(); for (const l of lots) { const on = jobs.has(l.n); g.fillStyle = on ? '#7fe0d0' : '#2b4a4a'; g.fillRect(10 + (l.cx - l.w / 2 - x0) * s, 28 + (l.cz - l.d / 2 - z0) * s, Math.max(1, l.w * s - 1), Math.max(1, l.d * s - 1)); }
        g.fillStyle = '#bfeee6'; g.font = '600 10px Inter, sans-serif'; g.fillText(lots.length + ' lots · ' + jobs.size + ' active', 10, 170); },
    };
    this.DRAW = DRAW;
    this.board = () => { const W = this.st.work || [], L = this.st.last || {}; return { now: W.filter(w => !['waiting', 'ready', 'released'].includes(w.stage)).map(w => scrub(w.task)), next: W.filter(w => w.stage === 'waiting').map(w => scrub(w.task)), done: Object.values(L).map(scrub) }; };
    this.tFloor = {}; fetch('/office/modules.json').then(r => r.json()).then(j => { this.tFloor = (j.modules || []).find(x => x.id === 'team-halls')?.config?.floors || {}; }).catch(() => {});
    this.floorOf = t => String(this.tFloor[t.key] || t.floor || 'G');
    this.floorTeams = n => (ctx.roster?.teams || []).filter(t => this.floorOf(t) === String(n)).map(t => ({ key: t.key, name: t.name, members: t.members || [], working: (this.st.work || []).filter(w => (t.members || []).some(m => m.id === w.agent)).length }));
    this.jobs = () => { const s = new Set(); try { for (const e of window.__ewsOffice?.world?.().ents || []) { const m = /(\d+)/.exec(String(e.lot ?? e.id)); if (m && e.target < 1) s.add(+m[1]); } } catch (e) {} return s; };
    /* ---------- click: raycast our instances with the last pointer position ---------- */
    const el = ctx.renderer.domElement, ray = new T.Raycaster(), ndc = new T.Vector2(); let lastP = null;
    el.addEventListener('pointerdown', e => { lastP = e; }, true); el.addEventListener('pointerup', e => { lastP = e; }, true);
    const pick = () => { const rc = el.getBoundingClientRect(); if (document.pointerLockElement || !lastP) ndc.set(0, 0); else ndc.set(((lastP.clientX - rc.left) / rc.width) * 2 - 1, -((lastP.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, ctx.cam); for (const m of [mScr, mBody]) m.boundingSphere = null; const h = ray.intersectObjects([mScr, mBody], false)[0]; const r = h && byInst[h.instanceId]; if (r) self.open(r); };
    ctx.onClick(mScr, pick); ctx.onClick(mBody, pick);
    Object.assign(this, { mBody, mCase, mEasel, mMount, mPed, mScr, aUV, tex, g, byInst, addFloor, field, fmt, scrub });
    /* ---------- in-world tablet panel (DOM, large + readable, touch + kiosk) ---------- */
    this.mkPanel();
    this.hook = () => { if (!window.__ewsOffice || this.hooked) return; this.hooked = true; window.__ewsOffice.tablets = (() => ({ n: recs.length, held: recs.filter(r => r.mode === 'held').length, desk: recs.filter(r => r.mode === 'desk').length, fixed: recs.filter(r => r.mode === 'fixed').length, field: field.size, slots: recs.filter(r => r.slot != null).map(r => r.kind + ':' + (r.av?.userData.a?.id || r.F?.id || r.floor || r.title)), tris: this.tris, open: !!this.openR }));
    const find = k => recs.find(r => r.kind === k || r.av?.userData.a?.id === k || r.floor === k);
    Object.assign(window.__ewsOffice, { tabletAt: k => { const r = find(k); if (!r) return null; const p = new T.Vector3().setFromMatrixPosition(r.m); const n = new T.Vector3(0, 0, 1).transformDirection(r.m); return { p: p.toArray().map(v => +v.toFixed(3)), n: n.toArray().map(v => +v.toFixed(3)), mode: r.mode, slot: r.slot ?? null, role: r.role }; },
      openTablet: k => { const r = find(k); if (r) self.open(r); return !!r; }, closeTablet: () => self.close(), heldList: () => recs.filter(r => r.mode === 'held').map(r => r.av?.userData.a?.id || r.F?.id) }); };
  },

  layoutStatus() { const n = Date.now(); if (!this._lsT || n - this._lsT > 15000) { this._lsT = n; fetch('/api/office/layout-status', { cache: 'no-store' }).then(r => r.json()).then(j => { this._ls = j; this.lastH = null; }).catch(() => {}); } return this._ls; },
  mkPanel() {
    const ctx = this.ctx, css = document.createElement('style');
    css.textContent = `.ews-tab-bd{position:fixed;inset:0;z-index:70;background:rgba(4,6,12,.55);display:flex;align-items:center;justify-content:center;touch-action:none}
.ews-tab{position:relative;width:min(900px,94vw);max-height:90vh;aspect-ratio:1.45;border-radius:34px;padding:22px;box-sizing:border-box;background:linear-gradient(145deg,#b9bec6,#6d727a);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 2px #d9dde3}
.ews-tab.sec{background:linear-gradient(145deg,#2c302b,#1a1c1a);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 6px #d9772b}
.ews-tab.sec.alert .scr{box-shadow:inset 0 0 0 4px #ff3b3b}
.ews-tab .seg{display:flex;gap:8px;margin:10px 0}.ews-tab .seg button{flex:1;font:600 18px Inter,sans-serif;padding:10px;border-radius:10px;border:1px solid #3a4660;background:#18203a;color:#cfe;cursor:pointer}.ews-tab .seg button.on{background:#1f5f5f;border-color:#3fe6ff;color:#fff}
.ews-tab .warn{background:#5a3a1233;border:1px solid #c9883a;color:#ffd27a;border-radius:8px;padding:8px 10px;margin:6px 0;font-weight:600}.ews-tab .ph{display:block;margin:10px 0}.ews-tab .ph input{width:40%;vertical-align:middle}
.ews-tab .glass{height:100%;border-radius:16px;background:#05070b;padding:14px;box-sizing:border-box}
.ews-tab .scr{height:100%;border-radius:8px;background:#0f1420;color:#e6ecf5;font:18px/1.35 Inter,system-ui,sans-serif;padding:22px 26px;box-sizing:border-box;overflow:auto}
.ews-tab .cam{position:absolute;top:11px;left:50%;width:7px;height:7px;margin-left:-3px;border-radius:50%;background:#1b2028}
.ews-tab h2{margin:0 0 2px;font-size:30px;color:#fff}.ews-tab .role{color:#9fb0cc;font-size:17px;margin-bottom:14px}.ews-tab .task{font-size:23px;font-weight:700;margin:6px 0 10px}
.ews-tab .chip{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:15px}.ews-tab .bar{height:12px;border-radius:6px;background:#26324a;margin:14px 0 6px;overflow:hidden}.ews-tab .bar i{display:block;height:100%;border-radius:6px;transition:width .4s}
.ews-tab .live{color:#9fb0cc;font-size:16px}.ews-tab h3{font-size:17px;color:#9fb0cc;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.06em}.ews-tab ul{margin:0;padding-left:20px}.ews-tab li{margin:3px 0}
.ews-tab .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ews-tab .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.ews-tab .grid div{background:#18203a;border-radius:10px;padding:8px}.ews-tab .grid img{width:100%;border-radius:6px;aspect-ratio:1;object-fit:cover}
.ews-tab button.x{position:absolute;top:-14px;right:-14px;width:52px;height:52px;border-radius:50%;border:0;background:#0f1420;color:#fff;font-size:28px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5)}
.ews-tab .go{margin-top:16px;display:inline-block;padding:12px 20px;border-radius:12px;border:0;background:#d9b45a;color:#1a1408;font:700 18px Inter,sans-serif;cursor:pointer}
@media (max-width:640px){.ews-tab{aspect-ratio:auto;height:86vh;padding:14px;border-radius:24px}.ews-tab .scr{font-size:16px;padding:16px}.ews-tab h2{font-size:24px}.ews-tab .cols{grid-template-columns:1fr}}`;
    document.head.append(css);
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.openR) this.close(); });
  },
  open(r) {
    const ctx = this.ctx; this.close(); try { document.exitPointerLock?.(); } catch (e) {}
    const bd = document.createElement('div'); bd.className = 'ews-tab-bd office-chat'; bd.setAttribute('role', 'dialog'); bd.setAttribute('aria-modal', 'true');
    bd.innerHTML = `<div class="ews-tab ${r.role === 'sec' ? 'sec' : ''}"><div class="cam"></div><button class="x" type="button" aria-label="Close">×</button><div class="glass"><div class="scr"></div></div></div>`;
    bd.addEventListener('pointerdown', e => { if (!e.target.closest('.ews-tab')) { e.preventDefault(); this.close(); } }); bd.querySelector('.x').onclick = () => this.close(); this.lastH = null; this.dragging = false;
    ['pointerdown', 'pointerup', 'wheel', 'touchstart'].forEach(k => bd.addEventListener(k, e => e.stopPropagation()));
    (ctx.root || document.body).append(bd); this.openR = r; this.bd = bd; this.fill(); this.fillT = setInterval(() => this.fill(), 400); ctx.activity?.();
    bd.querySelector('.x').focus();
  },
  close() { if (!this.bd) return; clearInterval(this.fillT); this.bd.remove(); this.bd = null; this.openR = null; },
  fill() {
    const r = this.openR, ctx = this.ctx, esc = ctx.esc || (s => String(s)), scr = this.bd?.querySelector('.scr'); if (!r || !scr) return; const pub = ctx.publicMode, lb = ctx.use('liveBar'), STG = this.STG, sc = this.scrub;
    let h = '';
    if (r.kind === 'agent' || r.kind === 'field') { const u = r.av?.userData || {}, a = u.a || {}, id = a.id || r.F?.id || '', s = this.itemOf(r), team = (ctx.roster?.teams || []).find(t => t.key === u.team);
      const name = a.name || r.F?.name || 'Agent', role = a.role || (r.role === 'sec' ? 'Security patrol' : r.role === 'arch' ? 'Architect' : 'Agent');
      h += `<h2>${esc(name)}</h2><div class="role">${esc(role)}${team ? ' · ' + esc(team.name) : ''}${r.role === 'sec' ? ' · on patrol' : ''}</div>`;
      if (pub) h += `<div class="task">${s ? 'Working on a studio task' : 'Available'}</div>`;
      else if (r.role === 'sec' && this.secOf(r)) { const z = this.secOf(r), al = z.state === 'alert', col = al ? '#ff6b6b' : z.state === 'checking' ? '#ffc24a' : '#7fd38a', dc = { critical: '#ff4d4d', high: '#ff7a3a', medium: '#ffc24a', low: '#7fd38a' }[z.sev] || col;
        h += `<div class="task">${esc(z.check || 'Routine sweep')}</div><span class="chip" style="background:${col}33;color:${col}">${al ? 'ALERT' : z.state === 'checking' ? 'Checking' : 'On patrol'}</span>${z.sev ? ` <span class="chip" style="background:${dc}33;color:${dc}">${esc(z.sev.toUpperCase())}</span>` : ''}`;
        h += `<div class="live"><span style="color:${dc}">●</span> ${esc(z.finding || 'No open findings')}${z.target ? ' · ' + esc(z.target) : ''}</div>${z.at ? `<div class="live">Updated ${esc(this.fmt(Date.now() - Date.parse(z.at)))} ago</div>` : ''}`;
        if (this.bd) this.bd.querySelector('.ews-tab')?.classList.toggle('alert', al); }
      else if (s) { const P = lb ? lb.live(s.agent, s) : s.progress || 0, col = s.blocked ? '#ff8a8a' : '#d9b45a';
        h += `<div class="task">${esc(sc(s.task))}</div><span class="chip" style="background:${col}33;color:${col}">${esc((STG[s.stage] || s.stage) + (s.blocked ? ' · blocked' : ''))} · ${Math.round(P * 100)}%</span>`;
        if (s.finding) h += ` <span class="chip" style="background:#ff7a3a33;color:#ff9a5a">${esc(String(s.finding.sev).toUpperCase())}${s.finding.target ? ' · ' + esc(sc(s.finding.target)) : ''}</span>`;
        h += `<div class="bar"><i style="width:${(Math.max(0.03, Math.min(1, P)) * 100).toFixed(1)}%;background:${col}"></i></div><div class="live">${esc(lb ? lb.activity(s) : s.stage)}</div>`; }
      else { const pos = r.av ? r.av.position : r.F, lot = r.role === 'sec' && pos && this.lotNear(pos.x, pos.z);
        h += `<div class="task">${r.role === 'sec' ? 'On patrol · no open findings' : 'Idle'}</div><div class="live">${r.role === 'sec' ? esc((lot ? 'Near lot L' + String(lot.n).padStart(2, '0') : 'Campus') + ' · ' + this.fmt(performance.now() - r.t0) + ' on patrol') : (this.st.last?.[id] ? 'Last: ' + esc(sc(this.st.last[id])) : '')}</div>`; }
      if (!pub) { const H = this.hist.get(id) || []; h += `<h3>Last actions</h3>${H.length ? '<ul>' + H.slice(0, 3).map(x => `<li>${esc(sc(x.text))}</li>`).join('') + '</ul>' : '<div class="live">Nothing yet this session</div>'}`; }
      if (team && ctx.spotOf?.('team-' + team.key)) h += `<button class="go" data-go="team-${esc(team.key)}">Team board: ${esc(team.name)}</button>`;
      else if (r.role === 'arch' && (ctx.curFloor || 'G') === '3') h += `<div class="live" style="margin-top:14px">Team board: the studio whiteboard on this floor</div>`; }
    else if (r.kind === 'checkin') { const W = this.st.work || [];
      h += `<h2>Welcome to Fólkvangr</h2><div class="role">Visitor check-in · directory · Freyja at the desk can help</div><h3>Floors</h3><ul>${FLOORS.map(f => `<li><b>${esc(f.n)}</b> ${esc(f.name)} <span class="live">· ${esc(f.sub || '')}</span></li>`).join('')}</ul>`;
      h += `<h3>Teams · who's working</h3><ul>${(ctx.roster?.teams || []).map(t => { const ws = W.filter(w => (t.members || []).some(m => m.id === w.agent)); return `<li><b>${esc(t.name)}</b> (Floor ${esc(this.floorOf(t))}) · ${ws.length ? (pub ? ws.length + ' working' : ws.map(w => esc((t.members.find(m => m.id === w.agent) || {}).name || 'agent')).join(', ')) : 'quiet'}</li>`; }).join('')}</ul>`; }
    else if (r.kind === 'board') { const B = this.board(); h += `<h2>Team board</h2><div class="role">Now · Next · Done, live from the studio feed</div><div class="cols">${[['Now', '#ff7a5a', B.now], ['Next', '#d9b45a', B.next], ['Done', '#5fd38a', B.done]].map(([n, c, l]) => `<div><h3 style="color:${c}">${n} (${l.length})</h3><ul>${pub ? '' : l.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`; }
    else if (r.kind === 'merch') { const M = ctx.site?.merch || []; h += `<h2>Merch Store</h2><div class="role">Browse the range · Hermod runs the store · no checkout here</div><div class="grid">${M.map(m => `<div>${m.img ? `<img src="${esc(m.img)}" alt="" loading="lazy">` : ''}<b>${esc(m.title)}</b><div class="live">${esc(m.price || '')}${m.tag ? ' · ' + esc(m.tag) : ''}</div></div>`).join('')}</div>`; }
    else if (r.kind === 'floor') { const F = FLOORS.find(f => f.n === r.floor) || FLOORS[0], TT = this.floorTeams(F.n);
      h += `<h2>Floor ${esc(F.n)} · ${esc(F.name)}</h2><div class="role">${esc(F.sub || '')}</div><h3>Teams on this floor</h3>${TT.length ? '<ul>' + TT.map(t => { const ws = (this.st.work || []).filter(w => t.members.some(m => m.id === w.agent)); return `<li><b>${esc(t.name)}</b> · ${ws.length ? ws.map(w => pub ? '' : `${esc(w.name)}: ${esc(STG[w.stage] || w.stage)} ${Math.round((lb ? lb.live(w.agent, w) : w.progress || 0) * 100)}%`).filter(Boolean).join(' · ') || ws.length + ' working' : 'quiet right now'}</li>`; }).join('') + '</ul>' : '<div class="live">No teams on this floor yet</div>'}`; }
    else if ((r.kind === 'holo' || r.kind === 'plan') && ctx.use('townModel')) { const tm = ctx.use('townModel'), I = tm.info(), sel = tm.sel(), PH = ['District 1 (Main Street, square, Arcade)', '+ Growth ring 1', '+ Growth ring 2'];
      h += `<h2>Campus Town · holo table</h2><div class="role">Physical model = the current approved layout (${esc(I.approved)}) · hologram = the architects' proposal</div>`;
      h += `<div class="seg">${['current', 'proposed', 'overlay'].map(m => `<button type="button" data-mode="${m}" class="${I.mode === m ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`;
      h += I.hasProposed ? `<div class="warn">${I.solid ? 'APPROVED: now the current layout' : 'PROPOSED · awaiting Joshua approval'} · ${esc(I.proposed)} · Vé ${esc(I.qa || '?')} · ${I.lots} lots</div>` : '<div class="live">No proposed draft right now: the table shows the current layout.</div>';
      { const LS = this.layoutStatus(), L = LS && LS.layout, fmt = t => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '?';   // 2026-10-17 approval status panel
        h += '<h3>Layout approval</h3>' + (!L ? '<div class="live">loading…</div>' : L.approved ? `<div class="live"><b>APPROVED</b> ${esc(L.version || '')} · by ${esc(L.by || '?')} · ${fmt(L.at)}<br>Why: ${esc(L.why || 'n/a')}<br>Revocable by Joshua/Anna until ${fmt(L.revokeBy)}</div>` : `<div class="warn">Construction on hold · ${L.revoked ? 'approval of ' + esc(L.revoked) + ' revoked by ' + esc(L.by || '?') + ' ' + fmt(L.at) : 'no approved layout yet'}</div>`); }
      h += `<label class="ph">Phase <input type="range" min="1" max="3" step="1" value="${I.phase}"> <b>${I.phase}</b> · ${esc(PH.slice(0, I.phase).join(' '))}</label>`;
      h += `<h3>Lot info</h3>${sel ? `<div class="task">${esc(sel.id)} · ${esc(String(sel.tier))} · ${Math.round(sel.w)} × ${Math.round(sel.d)} m</div><div class="live">${esc(sel.layer)} layer${sel.block ? ' · block ' + esc(sel.block) : ''} · use: ${esc(sel.use || 'n/a')}</div>${(sel.src || []).length ? `<div class="live">Size source: ${sel.src.map(x => esc(x)).join('; ')}</div>` : ''}` : '<div class="live">Tap a lot on the table to see its tier, size, use and size source.</div>'}`;
      const HL = I.hist || []; h += `<h3>Revision history</h3>${HL.length ? '<ul>' + HL.map((x, i) => `<li><b>v${i + 1}</b> ${esc(x.id)} · ${x.qa ? 'Vé ' + esc(x.qa) : 'no QA'} · ${x.lots} lots${x.id === I.proposed ? ' · <b>on the table</b>' : ''}</li>`).reverse().join('') + '</ul>' : '<div class="live">No revisions yet</div>'}`; }
    else if (r.kind === 'plan') { const lots = (ctx.town?.lots || []).filter(Boolean), jobs = this.jobs(); h += `<h2>Town plan</h2><div class="role">${lots.length} numbered lots · ${jobs.size} with active architecture or build jobs</div><canvas width="820" height="420" style="width:100%;border-radius:8px;background:#0b1a1a"></canvas>`; }
    if (this.dragging || h === this.lastH) return; this.lastH = h;
    scr.innerHTML = h; { const tm = ctx.use('townModel'); scr.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { tm?.set(b.dataset.mode); this.fill(); }); const rg = scr.querySelector('input[type=range]'); if (rg) { rg.onpointerdown = () => { this.dragging = true; }; rg.oninput = () => tm?.phase(rg.value); rg.onchange = rg.onpointerup = () => { this.dragging = false; tm?.phase(rg.value); this.fill(); }; } }
    const go = scr.querySelector('[data-go]'); if (go) go.onclick = () => { const k = go.dataset.go; this.close(); if ((ctx.curFloor || 'G') !== 'G') ctx.use('floorPanel')?.(); else ctx.goTo(k); };
    const cvp = scr.querySelector('canvas'); if (cvp) { const g = cvp.getContext('2d'), lots = (ctx.town?.lots || []).filter(Boolean), jobs = this.jobs(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const l of lots) { x0 = Math.min(x0, l.cx - l.w / 2); x1 = Math.max(x1, l.cx + l.w / 2); z0 = Math.min(z0, l.cz - l.d / 2); z1 = Math.max(z1, l.cz + l.d / 2); }
      const s = Math.min(800 / (x1 - x0), 400 / (z1 - z0)); g.font = '600 11px Inter, sans-serif'; for (const l of lots) { const x = 10 + (l.cx - l.w / 2 - x0) * s, y = 10 + (l.cz - l.d / 2 - z0) * s, on = jobs.has(l.n); g.fillStyle = on ? '#7fe0d0' : '#20403f'; g.fillRect(x, y, l.w * s - 2, l.d * s - 2); if (l.w * s > 26) { g.fillStyle = on ? '#08201f' : '#7fa8a4'; g.fillText('L' + String(l.n).padStart(2, '0'), x + 3, y + 13); } } }
  },

  onFrame(dt, t) {
    const ctx = this.ctx; if (!this.mBody) return; const T = ctx.THREE, cam = ctx.cam.position, recs = this.recs, now = performance.now();
    if (!this.hooked) this.hook(); if (now - (this.scanAt || 0) > 2000) { this.scanAt = now; this.scanAvatars();
      const tm = ctx.use('townModel'); if (tm?.tablet && !this.holoRec) { const p = tm.tablet; this.holoRec = this.fixed('holo', [p.x, p.y, p.z], Math.PI, 0.95, 'arm', { title: 'Holo table' }); } }
    let gone = false;
    for (const r of recs) {
      if (r.kind === 'agent') { const av = r.av, u = av.userData, k = u.prevK, d = av.position.distanceTo(cam), seated = !!u.seat && k !== 'walk' && k !== 'stand';
        const inHand = !seated && (HOLD.has(k) || k === 'carry');   /* 'carry' = walking with work: the tablet replaces the old folder, two-handed */
        if (inHand && av.parent && av.visible && d < 15 && this.hold(r, t, dt)) r.mode = 'held';
        else if (inHand) { r.mode = 'hidden'; r.w = 0; }                      /* still in their hand, just not drawn (agent culled or far) */
        else { r.w = 0; if (u.home && u.monitor) { r.mode = 'desk'; if (!r.dm) { r.stand = 'easel'; r.dm = new T.Matrix4().compose(new T.Vector3(u.home.x + 0.5, 0.76 + 0.028, u.home.z - 0.6), new T.Quaternion().setFromEuler(new T.Euler(-TILT, -0.18, 0, 'YXZ')), new T.Vector3(1, 1, 1)); } r.m.copy(r.dm); }
          else r.mode = 'hidden'; } }
      else if (r.kind === 'field') { if (!r.F.on || now - (r.seen || 0) > 1000 || r.F.rigged) { r.mode = 'hidden'; if (now - (r.seen || 0) > 5000) { r.dead = true; gone = true; } continue; } this.fieldPose(r); r.mode = 'held'; }
    }
    if (gone) { for (const r of recs.filter(x => x.dead)) { recs.splice(recs.indexOf(r), 1); this.field.delete(r.F); } }
    /* instances + LOD slots */
    const pos = new T.Vector3(), cand = []; let nb = 0, nc = 0, ne = 0, np = 0; this.byInst.length = 0;
    const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(ctx.cam.projectionMatrix, ctx.cam.matrixWorldInverse));
    for (const r of recs) { r.slot = null; if (r.mode === 'hidden') continue; pos.setFromMatrixPosition(r.m); const d = pos.distanceTo(cam); r.d = d; if (d > 45) continue;
      this.mBody.setMatrixAt(nb, r.m); this.mScr.setMatrixAt(nb, r.m); this.byInst[nb] = r; r.i = nb; nb++;
      if (r.role === 'sec' && nc < 24) this.mCase.setMatrixAt(nc++, r.m);
      if (r.mode !== 'held' && r.stand === 'easel' && ne < 96) this.mEasel.setMatrixAt(ne++, r.m); if (r.stand === 'ped' && np < 12) { this.mMount.setMatrixAt(np, r.m); this.mPed.setMatrixAt(np++, r.sm); }
      if (d < 6.5 * Math.max(0.7, ctx.lod || 1) && fr.containsPoint(pos)) cand.push(r); }
    cand.sort((a, b) => a.d - b.d); const want = cand.slice(0, 8);
    this.slotOf ||= new Map(); for (const [r] of this.slotOf) if (!want.includes(r)) this.slotOf.delete(r);
    const used = new Set(this.slotOf.values()); for (const r of want) if (!this.slotOf.has(r)) { let s = 0; while (used.has(s)) s++; this.slotOf.set(r, s); used.add(s); r.fresh = true; }
    const A = this.aUV.array, tintOf = r => r.kind === 'agent' || r.kind === 'field' ? (r.role === 'sec' ? 2 : r.role === 'arch' ? 1 : 0) : r.kind === 'plan' || r.kind === 'holo' ? 1 : r.kind === 'merch' || r.kind === 'checkin' ? 2 : 0;
    for (let i = 0; i < nb; i++) { const r = this.byInst[i], s = this.slotOf.get(r); if (s != null) { r.slot = s; A[i * 4] = (s % 4) * 256 / 1024; A[i * 4 + 1] = 1 - (Math.floor(s / 4) * 176 + 176) / 360; A[i * 4 + 2] = 256 / 1024; A[i * 4 + 3] = 176 / 360; }
      else { const k = tintOf(r); A[i * 4] = (k * 64 + 32) / 1024; A[i * 4 + 1] = 1 - 356 / 360; A[i * 4 + 2] = 0; A[i * 4 + 3] = 0; } }
    this.aUV.needsUpdate = true;
    for (const [m, n] of [[this.mBody, nb], [this.mScr, nb], [this.mCase, nc], [this.mEasel, ne], [this.mMount, np], [this.mPed, np]]) { m.count = n; m.instanceMatrix.needsUpdate = true; m.boundingSphere = null; }
    /* redraw live screens twice a second (fresh slots at once) */
    this.acc = (this.acc || 0) + dt; let dirty = false; for (const [r, s] of this.slotOf) if (r.fresh) { r.fresh = false; this.draw(r, s); dirty = true; }
    if (this.acc > 0.5) { this.acc = 0; for (const [r, s] of this.slotOf) this.draw(r, s); dirty = this.slotOf.size > 0 || dirty; }
    if (dirty) this.tex.needsUpdate = true;
  },
};
