// Elderverse live world (2026-10-16): the town builds itself in front of you, with no page reload.
// Server: Durable Object room (functions/api/office/world.js -> workers/office-limiter/world.js) holds lots, roads and buildings with
// their REAL construction stage + progress (CT111 world_events.py posts pipeline events). This module joins over a WebSocket
// (snapshot, then deltas; 10 s polling fallback), eases the displayed progress toward the reported one (and creeps toward the
// pipeline's own "next" estimate, never past it), and renders each stage procedurally on the lot:
//   site:  survey stakes + total station -> ground prep (excavator, dirt pad) -> foundation (formwork, mixer truck) -> steel framing +
//          decks (tower crane lifting) -> wall panels (scaffolding) -> glazing -> signage -> landscaping (streamed GLB shrubs) -> open
//   road:  survey cones -> grading/milling -> base/tack coat -> paving front (paver + roller) -> striping -> open
// plus hard-hat crews (5 instanced draw calls for ALL workers), a live progress board on every lot, and stage toasts.
// GLB parts (entity.parts[stage]) stream in only when that stage is reached. Cheap-device rules: Lambert, instancing, distance
// culling (hidden past the exterior view distance, crews/cranes only animate within 90 m), tier-scaled crew sizes.
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
import { DRACOLoader } from '../../vendor/jsm/loaders/DRACOLoader.js?v=169';
import { KTX2Loader } from '../../vendor/jsm/loaders/KTX2Loader.js?v=169';

const BUILD = ['survey', 'groundwork', 'foundation', 'framing', 'walls', 'glazing', 'signage', 'landscaping', 'open'];
const ROAD = ['survey', 'grading', 'base', 'paving', 'striping', 'open'];
const BL = ['Surveying', 'Ground prep', 'Foundation', 'Steel framing', 'Walls', 'Glazing', 'Signage', 'Landscaping', 'Open'];
const RL = ['Surveying', 'Grading', 'Base course', 'Paving', 'Striping', 'Open'], RLR = ['Surveying', 'Milling', 'Tack coat', 'Paving', 'Striping', 'Open'];
const WALLC = { sandstone: '#cdb48e', brick: '#9a5844', slate: '#5d6670', cream: '#e3d9c4', timber: '#8a6446', teal: '#3f7473' };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sm = x => x * x * (3 - 2 * x);

export default {
  setup(ctx, cfg) {
    const T = ctx.THREE, me = this; this.ctx = ctx; this.T = T;
    const ents = new Map(); let skew = 0, seq = 0, ws = null, live = false, pollT = 0, retry = 1000, connected = false;
    this.ents = ents; this.vis = new Map(); this.stats = { msgs: 0, mode: 'connecting', last: null };
    const onSnap = m => { skew = me.skew = (m.now || Date.now()) - Date.now(); seq = m.seq; const seen = new Set();
      for (const e of m.ents || []) { seen.add(e.id); upsert(e, !live); } for (const id of [...ents.keys()]) if (!seen.has(id)) remove(id); live = true; me.layout = m.layout || me.layout; me.control?.(m.ents || [], []); };
    const onDelta = m => { skew = me.skew = (m.now || Date.now()) - Date.now(); if (m.seq <= seq) return; seq = m.seq; if (m.layout) me.layout = m.layout; for (const e of m.up || []) upsert(e, false); for (const id of m.rm || []) remove(id); me.control(m.up || [], m.rm || []); };
    // office agents: hand every server pose to the seating worker's walk/seat system (world-agents, 779552e); never tween office avatars here
    me.control = (up, rm) => { const C = ctx.use('agentControl'); if (!C) return; const poses = up.filter(e => e.kind === 'agent').map(e => ({ ...e, id: e.id.replace(/^agent:/, '') }));
      if (poses.length) try { C.apply(poses); } catch (err) { console.warn('agentControl.apply', err); } for (const id of rm) if (/^agent:/.test(id)) try { C.gone(id.replace(/^agent:/, '')); } catch {} };
    this.agents = new Map();   // kind 'agent' (CT119 poses): kept for the avatar layer, never built as a site; 'rt-' round-trip probes ignored
    const skip = e => e.kind === 'agent' ? (me.agents.set(e.id, e), true) : (e.kind === 'road' && /^road:rt-/.test(e.id));
    const upsert = (e, initial) => { if (skip(e)) return; const old = ents.get(e.id); ents.set(e.id, e); if (!me.vis.has(e.id)) me.vis.set(e.id, { D: initial ? null : 0, stage: -1, fresh: !initial }); if (old && old.kind !== e.kind) me.drop(e.id); };
    const remove = id => { me.agents?.delete(id); ents.delete(id); me.drop(id); me.vis.delete(id); };
    this.target = e => { const N = (e.kind === 'road' ? ROAD : BUILD).length - 1; let o = (e.si + e.p) / N;
      if (e.next && e.next.o > o) { const k = clamp((Date.now() + skew - e.at) / 1000 / e.next.eta); o += (e.next.o - o) * k; } return e.hold ? Math.min(o, 0.99 / N) : clamp(o); };
    const handle = txt => { let m; try { m = JSON.parse(txt); } catch { return; } me.stats.msgs++; me.stats.last = Date.now(); if (m.t === 'snap') { onSnap(m); me._ready?.(); } else if (m.t === 'delta') onDelta(m); else if (m.t === 'release') { me.stats.release = m; ctx.use('assets')?.check?.('release'); } };
    const poll = async () => { try { const r = await fetch(cfg.url || '/api/office/world', { cache: 'no-store' }); if (r.ok) handle(await r.text()); } catch {} };
    const connect = () => {
      if (!('WebSocket' in window)) { me.stats.mode = 'poll'; return; }
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + (cfg.url || '/api/office/world')); } catch { me.stats.mode = 'poll'; return; }
      ws.onopen = () => { connected = true; retry = 1000; me.stats.mode = 'live'; };
      ws.onmessage = ev => handle(ev.data);
      ws.onclose = () => { if (me.dead) return; connected = false; me.stats.mode = 'reconnecting'; setTimeout(connect, retry); retry = Math.min(30000, retry * 2); };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    me.timers = [setTimeout(() => { poll(); connect(); }, 600),
      setInterval(() => { if (connected && ws.readyState === 1) ws.send('ping'); else if (Date.now() - pollT > 10000) { pollT = Date.now(); poll(); } }, 25000),
      setInterval(() => { if (!connected) poll(); }, 10000)];
    me.closeWs = () => { try { ws && ws.close(); } catch {} };
    this.sites = new Map(); this.workers = null; this.acc = 0; this.toastQ = [];
    this.staging = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname) && !ctx.publicMode;
    this.setupDemoStand();
    // hot swap: resolve setup only once the first world snapshot is in, so the new version is fully built before it replaces the old
    return new Promise(res => { me._ready = () => { me._ready = null; res(); }; setTimeout(() => me._ready?.(), 5000); });
  },
  dispose() {
    this.dead = true; for (const t of this.timers || []) { clearTimeout(t); clearInterval(t); } this.closeWs?.();
    for (const id of [...(this.sites?.keys() || [])]) this.drop(id);
    for (const P of [this.workers, this.archPool, this.secPool]) if (P) for (const m of [P.body, P.legs, P.arms]) { m.parent?.remove(m); m.dispose?.(); }
    this.toastEl?.remove?.();
    if (this.post) this.post.parent?.remove(this.post); if (this.stand) this.stand.parent?.remove(this.stand);
    for (const F of [...(this.figs?.values() || []), ...(this.cops?.values() || [])]) { F.tag?.parent?.remove(F.tag); if (F.av) { F.av.visible = false; F.av.parent?.remove(F.av); } }
  },

  /* ---------------- shared resources ---------------- */
  res() {
    if (this._res) return this._res; const T = this.T, ctx = this.ctx;
    const L = (o) => new T.MeshLambertMaterial(o);
    const mat = { vc: L({ vertexColors: true }), concrete: L({ color: '#b9b4aa' }), dirt: L({ color: '#7a5a3c' }), gravel: L({ color: '#8d8a84' }),
      milled: L({ color: '#55565a', polygonOffset: true, polygonOffsetFactor: -2 }), tack: L({ color: '#2a2622', polygonOffset: true, polygonOffsetFactor: -3 }),
      fresh: L({ color: '#2a2b2f', polygonOffset: true, polygonOffsetFactor: -4 }), stripe: L({ color: '#efe6c8', emissive: '#3a3628', polygonOffset: true, polygonOffsetFactor: -6 }),
      steel: L({ color: '#a8432f' }), deck: L({ color: '#9c988f' }), glass: L({ color: '#8fb4c9', transparent: true, opacity: 0.55, emissive: '#000000' }),
      lawn: L({ color: '#6d9047', polygonOffset: true, polygonOffsetFactor: -2 }), pave: L({ color: '#c8c1b3', polygonOffset: true, polygonOffsetFactor: -3 }),
      scaffold: L({ color: '#c9ccd0' }), plank: L({ color: '#a77d4a' }), cone: L({ color: '#ff6a1a', emissive: '#331100' }), tape: new T.LineBasicMaterial({ color: '#ff5d8f' }),
      form: L({ color: '#b98a54' }), cable: L({ color: '#222222' }) };
    const box = new T.BoxGeometry(1, 1, 1), boxB = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), planeX0 = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    // vertex-colour merge helper for machines + crews
    const tc = new T.Color();
    const part = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => { const g = geo.clone(); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); const n = g.attributes.position.count, c = new Float32Array(n * 3); tc.set(col); for (let i = 0; i < n; i++) c.set([tc.r, tc.g, tc.b], i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; };
    const B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (r1, r2, h, s = 10) => new T.CylinderGeometry(r1, r2, h, s);
    const merge = list => mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false);
    const Y = '#e8b524', DK = '#2a2b30';
    const geo = {
      excav: merge([part(B(2.6, 0.6, 3.4), DK, 0, 0.3, 0), part(B(2.4, 0.9, 2.4), Y, 0, 1.05, -0.2), part(B(1.1, 1.2, 1.1), Y, 0.6, 2.05, 0.3), part(B(1.0, 0.8, 0.05), '#33475a', 0.6, 2.2, 0.86), part(B(1.6, 0.6, 0.8), '#54504a', 0, 1.25, -1.6)]),
      boom: merge([part(B(0.4, 0.4, 3.2), Y, 0, 0, 1.6), part(B(0.35, 0.35, 2.2), Y, 0, -0.9, 3.2, -0.6), part(B(0.9, 0.6, 0.6), DK, 0, -1.9, 3.7)]),
      mixer: merge([part(B(2.3, 0.9, 6.5), DK, 0, 0.9, 0), part(B(2.3, 1.5, 1.8), '#e8e3d6', 0, 1.9, 2.4), part(B(2.2, 0.7, 0.05), '#33475a', 0, 2.2, 3.31), ...[-2.2, -0.4, 2.2].flatMap(z => [part(C(0.5, 0.5, 0.4, 10), '#1a1a1a', 1.2, 0.5, z, 0, 0, Math.PI / 2), part(C(0.5, 0.5, 0.4, 10), '#1a1a1a', -1.2, 0.5, z, 0, 0, Math.PI / 2)])]),
      drum: merge([part(C(0.55, 1.0, 3.6, 12), '#d8d2c4', 0, 0, 0, Math.PI / 2 - 0.2), part(B(0.1, 1.9, 0.1), '#a8432f', 0, 0, 0, Math.PI / 2 - 0.2)]),
      paver: merge([part(B(3.2, 0.9, 3.0), Y, 0, 0.75, 0), part(B(3.4, 0.5, 1.2), '#3a3b40', 0, 0.35, -1.9), part(B(2.6, 0.9, 1.4), Y, 0, 1.6, 0.9), part(B(1.2, 1.2, 1.0), '#3b4c5c', 0, 2.25, -0.2), part(B(1.4, 0.1, 1.4), DK, 0, 2.9, -0.2), part(B(0.5, 0.5, 2.4), '#1a1a1a', 1.3, 0.25, 0.4), part(B(0.5, 0.5, 2.4), '#1a1a1a', -1.3, 0.25, 0.4)]),
      roller: merge([part(C(0.7, 0.7, 2.0, 14), '#5b5d63', 0, 0.7, 1.4, 0, 0, Math.PI / 2), part(C(0.7, 0.7, 2.0, 14), '#5b5d63', 0, 0.7, -1.4, 0, 0, Math.PI / 2), part(B(1.6, 0.8, 2.0), Y, 0, 1.3, 0), part(B(1.1, 1.0, 0.9), '#3b4c5c', 0, 2.15, -0.2), part(B(1.3, 0.08, 1.2), DK, 0, 2.7, -0.2)]),
      striper: merge([part(B(0.8, 0.6, 1.2), '#f0f0ea', 0, 0.5, 0), part(B(0.5, 0.4, 0.4), Y, 0, 0.95, -0.2), part(C(0.2, 0.2, 0.15, 8), '#1a1a1a', 0.35, 0.2, 0.4, 0, 0, Math.PI / 2), part(C(0.2, 0.2, 0.15, 8), '#1a1a1a', -0.35, 0.2, 0.4, 0, 0, Math.PI / 2)]),
      tripod: merge([part(B(0.04, 1.5, 0.04), Y, 0.25, 0.7, 0, 0, 0, 0.3), part(B(0.04, 1.5, 0.04), Y, -0.13, 0.7, 0.2, -0.25, 0, -0.15), part(B(0.04, 1.5, 0.04), Y, -0.13, 0.7, -0.2, 0.25, 0, -0.15), part(B(0.22, 0.28, 0.2), '#e7e3da', 0, 1.55, 0), part(B(0.08, 0.08, 0.3), DK, 0, 1.6, 0.18)]),
      mast: merge([part(B(1.4, 1, 1.4), Y, 0, 0.5, 0), part(B(1.5, 0.04, 1.5), DK, 0, 0.25, 0), part(B(1.5, 0.04, 1.5), DK, 0, 0.75, 0), part(B(3.2, 0.06, 3.2), '#8c8c8c', 0, 0.03, 0)]),
      jib: merge([part(B(1.2, 1.0, 22), Y, 0, 0, 8), part(B(1.2, 0.8, 7), Y, 0, 0, -4.5), part(B(2.2, 1.8, 2.4), '#9a9a96', 0, -0.6, -7.2), part(B(1.6, 1.6, 1.6), '#3b4c5c', 0.9, -1.2, 0.6), part(B(0.3, 3.2, 0.3), Y, 0, 1.9, 0), part(B(0.06, 0.06, 18), DK, 0, 3.4, 6, -0.17)]),
      hook: merge([part(B(0.5, 0.6, 0.3), Y, 0, 0, 0), part(B(0.12, 0.35, 0.12), DK, 0, -0.45, 0)]),
      sign: merge([part(B(0.15, 2.0, 0.15), DK, -1.15, 1.0, 0), part(B(0.15, 2.0, 0.15), DK, 1.15, 1.0, 0), part(B(2.6, 1.42, 0.08), DK, 0, 1.75, -0.03)]),
      monument: merge([part(B(3.4, 0.5, 0.9), '#6b655b', 0, 0.25, 0), part(B(3.0, 1.4, 0.6), '#d9d2c4', 0, 1.2, 0)]),
      body: merge([part(B(0.36, 0.16, 0.22), '#2d3340', 0, 0.9, 0), part(B(0.42, 0.52, 0.25), '#ff7a1a', 0, 1.22, 0), part(B(0.43, 0.05, 0.26), '#e8e8e8', 0, 1.12, 0), part(B(0.43, 0.05, 0.26), '#e8e8e8', 0, 1.3, 0), part(B(0.12, 0.08, 0.12), '#c99a78', 0, 1.51, 0), part(B(0.2, 0.22, 0.21), '#c99a78', 0, 1.65, 0), part(C(0.13, 0.14, 0.09, 10), '#f2c230', 0, 1.8, 0), part(C(0.17, 0.17, 0.02, 10), '#f2c230', 0, 1.755, 0.02)]),
      abody: merge([part(B(0.36, 0.16, 0.22), '#3a3f4a', 0, 0.9, 0), part(B(0.42, 0.52, 0.25), '#24324a', 0, 1.22, 0), part(B(0.2, 0.3, 0.02), '#e8e3d6', 0, 1.28, 0.13), part(B(0.12, 0.08, 0.12), '#b98b6c', 0, 1.51, 0), part(B(0.2, 0.22, 0.21), '#b98b6c', 0, 1.65, 0), part(C(0.13, 0.14, 0.09, 10), '#f4f4f0', 0, 1.8, 0), part(C(0.17, 0.17, 0.02, 10), '#f4f4f0', 0, 1.755, 0.02)]),
      aarm: merge([part(B(0.12, 0.5, 0.13), '#24324a', 0, -0.25, 0), part(B(0.1, 0.12, 0.1), '#b98b6c', 0, -0.56, 0), part(B(0.02, 0.22, 0.3), '#1b1d22', 0.06, -0.6, 0.1)]),
      sbody: merge([part(B(0.36, 0.16, 0.22), '#1c2230', 0, 0.9, 0), part(B(0.42, 0.52, 0.25), '#1f2a3d', 0, 1.22, 0), part(B(0.43, 0.06, 0.26), '#d8e04a', 0, 1.16, 0), part(B(0.1, 0.07, 0.02), '#c9a24e', 0.11, 1.38, 0.13), part(B(0.12, 0.08, 0.12), '#a97e5f', 0, 1.51, 0), part(B(0.2, 0.22, 0.21), '#a97e5f', 0, 1.65, 0), part(C(0.12, 0.12, 0.08, 10), '#151b26', 0, 1.79, 0), part(B(0.2, 0.02, 0.12), '#151b26', 0, 1.755, 0.12), part(B(0.24, 0.32, 0.02), '#0e1014', -0.2, 1.08, 0.48, -0.9), part(B(0.21, 0.28, 0.005), '#5fb7d6', -0.2, 1.085, 0.493, -0.9)]),
      sleg: merge([part(B(0.15, 0.78, 0.16), '#1c2230', 0, -0.39, 0), part(B(0.16, 0.1, 0.26), '#0f0f10', 0, -0.83, 0.04)]),
      sarm: merge([part(B(0.12, 0.5, 0.13), '#1f2a3d', 0, -0.25, 0), part(B(0.1, 0.12, 0.1), '#a97e5f', 0, -0.56, 0)]),
      post: merge([part(B(1.8, 0.12, 1.8), '#6b655b', 0, 0.06, 0), part(B(1.6, 1.0, 1.6), '#2a2f38', 0, 0.62, 0), part(B(1.62, 1.1, 1.62), '#9fc3d8', 0, 1.67, 0), part(B(0.08, 1.1, 0.08), '#2a2f38', 0.78, 1.67, 0.78), part(B(0.08, 1.1, 0.08), '#2a2f38', -0.78, 1.67, 0.78), part(B(0.08, 1.1, 0.08), '#2a2f38', 0.78, 1.67, -0.78), part(B(0.08, 1.1, 0.08), '#2a2f38', -0.78, 1.67, -0.78), part(B(2.1, 0.16, 2.1), '#1f2a3d', 0, 2.3, 0), part(B(1.2, 0.26, 0.04), '#d8e04a', 0, 2.05, 0.83), part(B(0.06, 0.06, 0.06), '#ffd58a', 0, 2.42, 0)]),
      leg: merge([part(B(0.15, 0.78, 0.16), '#2d3340', 0, -0.39, 0), part(B(0.16, 0.1, 0.26), '#3b2a1d', 0, -0.83, 0.04)]),
      arm: merge([part(B(0.12, 0.5, 0.13), '#ff7a1a', 0, -0.25, 0), part(B(0.1, 0.12, 0.1), '#c99a78', 0, -0.56, 0)]),
      cone: merge([part(C(0.04, 0.17, 0.55, 8), '#ff6a1a', 0, 0.3, 0), part(C(0.1, 0.13, 0.08, 8), '#f4f4f4', 0, 0.3, 0), part(B(0.36, 0.04, 0.36), '#1a1a1a', 0, 0.02, 0)]),
      stake: merge([part(B(0.05, 0.6, 0.05), '#d8c7a0', 0, 0.3, 0), part(B(0.07, 0.1, 0.03), '#ff4f86', 0, 0.55, 0.03)]),
    };
    return (this._res = { mat, geo, box, boxB, plane, planeX0 });
  },

  /* ---------------- crews: every worker in the world = 5 instanced meshes ---------------- */
  crew(kind) {
    if (kind === 'arch') { if (this.archPool) return this.archPool; } else if (kind === 'sec') { if (this.secPool) return this.secPool; } else if (this.workers) return this.workers;
    const T = this.T, { geo, mat } = this.res(), MAX = kind ? 12 : 48, G = kind === 'arch' ? { body: geo.abody, leg: geo.leg, arm: geo.aarm } : kind === 'sec' ? { body: geo.sbody, leg: geo.sleg, arm: geo.sarm } : { body: geo.body, leg: geo.leg, arm: geo.arm };
    const mk = (g, n) => { const m = new T.InstancedMesh(g, mat.vc, n); m.count = 0; m.frustumCulled = false; m.userData.noCollide = 1; m.userData.keep = 1; this.ctx.scene.add(m); return m; };
    const W = { body: mk(G.body, MAX), legs: mk(G.leg, MAX * 2), arms: mk(G.arm, MAX * 2), list: [], MAX };
    const M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1), E = new T.Euler(), P = new T.Matrix4(), base = new T.Matrix4();
    W.draw = (t) => { let n = 0; this.ctx.use('crews')?.draw(W, kind, t);   /* shared-rig characters near, instanced pawns far (base-avatar crews); flagged workers skip the figures below */
      for (const w of W.list) { if (!w.on || w.rigged || n >= MAX) continue;
        const walk = w.mode === 'walk', ph = w.ph != null ? w.ph : t * 7 + w.phase, sw = walk ? Math.sin(ph) * 0.55 : 0, bob = walk ? Math.abs(Math.cos(ph)) * 0.04 : 0;
        base.compose(V.set(w.x, w.y + bob, w.z), Q.setFromEuler(E.set(0, w.yaw, 0)), S.set(1, 1, 1)); W.body.setMatrixAt(n, base);
        for (const [i, sx] of [[0, -0.1], [1, 0.1]]) { P.compose(V.set(sx, 0.86, 0), Q.setFromEuler(E.set(i ? -sw : sw, 0, 0)), S); M.multiplyMatrices(base, P); W.legs.setMatrixAt(n * 2 + i, M); }
        let ar = -sw * 0.8, al = sw * 0.8, rz = 0;
        if (w.mode === 'work') { ar = -1.2 - Math.max(0, Math.sin(t * 5 + w.phase)) * 1.3; al = -0.5; }       // hammering / bolting
        else if (w.mode === 'survey') { ar = -1.45; al = -0.2; }                                              // sighting through the instrument
        else if (w.mode === 'wave') { ar = Math.PI - 0.3 + Math.sin(t * 6) * 0.3; rz = 0.2; }
        if (w.tablet) al = w.mode === 'walk' ? -1.05 : -1.2;                                                   // tablet held in the left hand, in front
        if (w.tablet && w.mode !== 'walk') ar = -1.0 + Math.sin(t * 2 + w.phase) * 0.12;                 // tapping it
        for (const [i, sx, a] of [[0, -0.27, al], [1, 0.27, ar]]) { P.compose(V.set(sx, 1.44, 0), Q.setFromEuler(E.set(a, 0, i ? -rz : rz)), S); M.multiplyMatrices(base, P); W.arms.setMatrixAt(n * 2 + i, M); }
        n++; }
      W.body.count = n; W.legs.count = W.arms.count = n * 2; W.body.visible = W.legs.visible = W.arms.visible = n > 0; /* no empty draw calls */ W.body.instanceMatrix.needsUpdate = W.legs.instanceMatrix.needsUpdate = W.arms.instanceMatrix.needsUpdate = true; };
    if (kind === 'arch') return (this.archPool = W);
    if (kind === 'sec') return (this.secPool = W);
    return (this.workers = W);
  },
  // crew AI: walk between the stage's work points, work a few seconds at each
  crewStep(list, pts, dt, origin, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const w of list) {
      if (!pts.length) { w.on = false; continue; } w.on = true;
      if (!w.tgt || w.gen !== pts.gen) { const p = pts[(w.i++) % pts.length]; w.tgt = p; w.gen = pts.gen; w.wait = 0; w.mode = 'walk'; }
      w.top = pts.top ?? 0.01;
      const lx = w.tgt[0], lz = w.tgt[2], tx = origin.x + lx * c + lz * s, tz = origin.z - lx * s + lz * c;
      const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
      if (w.mode === 'walk' && Math.abs(w.y - w.tgt[1]) > 0.05) w.y = d < 1.2 ? w.tgt[1] : 0;                 // off a level: down the ladder to the ground, up again at the target's ladder
      if (d > 0.15 && w.mode === 'walk') { const st = Math.min(d, dt * 1.35); w.x += dx / d * st; w.z += dz / d * st; w.yaw = Math.atan2(dx, dz); }
      else { if (w.mode === 'walk') { w.mode = w.tgt[3] || 'work'; w.wait = 3 + Math.random() * 4; if (w.tgt[4] != null) w.yaw = rot + w.tgt[4]; } w.wait -= dt; if (w.wait <= 0) { w.tgt = pts[(w.i++ + (Math.random() * 3 | 0)) % pts.length]; w.mode = 'walk'; } }
    }
  },

  /* ---------------- a construction site on a lot ---------------- */
  makeSite(e) {
    const T = this.T, ctx = this.ctx, lot = ctx.town?.lots?.[e.lot - 1]; if (!lot) return null; const R = this.res(), { mat, geo } = R;
    const g = new T.Group(); g.name = 'world:' + e.id; g.userData.keep = 1; g.userData.noFarCull = 1; g.position.set(lot.cx, 0, lot.cz); g.rotation.y = lot.face < 0 ? Math.PI : 0; ctx.scene.add(g);
    const st = e.style || {}, F = st.floors || 2, FH = 3.6, W = Math.min(14, lot.w - 7), Dp = 12, bz = -(lot.d / 2 - Dp / 2 - 2.5), NX = 4, NZ = 3, bx = W / NX, bzS = Dp / NZ;
    const S = { e, g, lot, F, FH, W, Dp, bz, parts: {}, crew: [], el: {} };
    const add = (m, y = 0) => { m.userData.noCollide = 1; g.add(m); return m; };
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3();
    const inst = (geom, material, mats) => { const m = new T.InstancedMesh(geom, material, mats.length); mats.forEach((mm, i) => m.setMatrixAt(i, mm)); m.count = 0; m.userData.noCollide = 1; m.userData.full = mats; g.add(m); return m; };
    const mx = (x, y, z, sx, sy, sz, ry = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sx, sy, sz));
    // survey: 12 stakes around the footprint + string lines + total station
    const stakePts = []; for (let i = 0; i < 12; i++) { const k = i / 12 * 4, side = k | 0, f = k - side, hw = W / 2 + 1, hd = Dp / 2 + 1;
      const [x, z] = side === 0 ? [-hw + 2 * hw * f, -hd] : side === 1 ? [hw, -hd + 2 * hd * f] : side === 2 ? [hw - 2 * hw * f, hd] : [-hw, hd - 2 * hd * f]; stakePts.push([x, bz + z]); }
    S.el.stakes = inst(geo.stake, mat.vc, stakePts.map(([x, z]) => mx(x, 0, z, 1, 1, 1)));
    { const pts = []; for (let i = 0; i < 12; i++) { const a = stakePts[i], b = stakePts[(i + 1) % 12]; pts.push(new T.Vector3(a[0], 0.45, a[1]), new T.Vector3(b[0], 0.45, b[1])); }
      S.el.tape = add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), mat.tape)); S.tapeN = 24; }
    S.el.tripod = add(new T.Mesh(geo.tripod, mat.vc)); S.el.tripod.position.set(-W / 2 - 3, 0, bz + Dp / 2 + 4);
    // ground prep
    S.el.dirt = add(new T.Mesh(R.box, mat.dirt)); S.dirtW = W + 4; S.dirtD = Dp + 4;
    S.el.excav = add(new T.Group()); { const b = new T.Mesh(geo.excav, mat.vc), boom = new T.Mesh(geo.boom, mat.vc); boom.position.set(0, 1.6, 0.9); S.el.excav.add(b, boom); S.boom = boom; }
    // foundation
    S.el.slab = add(new T.Mesh(R.boxB, mat.concrete)); S.el.slab.scale.set(W + 0.6, 0.45, Dp + 0.6); S.el.slab.position.set(0, 0, bz);
    S.el.form = add(new T.Group()); for (const [w, d, x, z] of [[W + 1, 0.08, 0, bz - Dp / 2 - 0.4], [W + 1, 0.08, 0, bz + Dp / 2 + 0.4], [0.08, Dp + 1, -W / 2 - 0.4, bz], [0.08, Dp + 1, W / 2 + 0.4, bz]]) { const m = new T.Mesh(R.boxB, mat.form); m.scale.set(w, 0.6, d); m.position.set(x, 0, z); S.el.form.add(m); }
    S.el.mixer = add(new T.Group()); { const b = new T.Mesh(geo.mixer, mat.vc), d = new T.Mesh(geo.drum, mat.vc); d.position.set(0, 2.1, -1.0); S.el.mixer.add(b, d); S.drum = d; S.el.mixer.position.set(W / 2 + 3.2, 0, bz + Dp / 2 + 1); S.el.mixer.rotation.y = Math.PI; }
    // framing: columns per floor, perimeter + interior beams, one deck per floor; ordered bottom-up so the frame rises floor by floor
    const fr = [], fk = [], deckM = [];
    for (let f = 0; f < F; f++) { const y0 = 0.45 + f * FH;
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) { fr.push(mx(-W / 2 + i * bx, y0, bz - Dp / 2 + j * bzS, 0.3, FH, 0.3)); fk.push('c'); }
      for (let j = 0; j <= NZ; j++) { fr.push(mx(0, y0 + FH - 0.35, bz - Dp / 2 + j * bzS, W, 0.35, 0.22)); fk.push('b'); }
      for (let i = 0; i <= NX; i++) { fr.push(mx(-W / 2 + i * bx, y0 + FH - 0.35, bz, 0.22, 0.35, Dp)); fk.push('b'); }
      deckM.push(mx(0, y0 + FH - 0.05, bz, W + 0.3, 0.25, Dp + 0.3)); }
    S.el.frame = inst(R.boxB, mat.steel, fr); S.el.deck = inst(R.boxB, mat.deck, deckM); S.frN = fr.length; S.frPerFloor = fr.length / F;
    // envelope: per floor, every perimeter bay gets a spandrel panel (walls stage) and a glass pane (glazing stage)
    const wc = mat.wall = new T.MeshLambertMaterial({ color: WALLC[st.color] || WALLC.sandstone });
    const bays = []; for (let i = 0; i < NX; i++) { bays.push([-W / 2 + (i + 0.5) * bx, bz + Dp / 2, bx, 0, 'front', i]); bays.push([-W / 2 + (i + 0.5) * bx, bz - Dp / 2, bx, Math.PI, 'back', i]); }
    for (let j = 0; j < NZ; j++) { bays.push([W / 2, bz - Dp / 2 + (j + 0.5) * bzS, bzS, Math.PI / 2, 'side', j]); bays.push([-W / 2, bz - Dp / 2 + (j + 0.5) * bzS, bzS, -Math.PI / 2, 'side', j]); }
    const wallM = [], glassM = [], pierM = [];
    for (let f = 0; f < F; f++) { const y0 = 0.45 + f * FH;
      for (const [x, z, w, ry, side, i] of bays) { const shop = f === 0 && side === 'front', off = 0.12, ox = Math.sin(ry) * off, oz = Math.cos(ry) * off;
        if (!shop) { wallM.push(mx(x + ox, y0, z + oz, w - 0.05, 1.0, 0.25, ry)); wallM.push(mx(x + ox, y0 + FH - 0.75, z + oz, w - 0.05, 0.75, 0.25, ry)); glassM.push(mx(x + ox * 0.6, y0 + 1.0, z + oz * 0.6, w - 0.4, FH - 1.75, 0.06, ry)); }
        else { wallM.push(mx(x + ox, y0 + FH - 0.75, z + oz, w - 0.05, 0.75, 0.25, ry)); glassM.push(mx(x + ox * 0.6, y0 + 0.05, z + oz * 0.6, w - 0.3, FH - 0.85, 0.06, ry)); } } }
    for (let i = 0; i <= NX; i++) for (const zz of [bz - Dp / 2, bz + Dp / 2]) pierM.push(mx(-W / 2 + i * bx, 0.45, zz + Math.sign(zz - bz) * 0.12, 0.45, F * FH + 0.6, 0.4));
    S.el.wall = inst(R.boxB, wc, [...pierM, ...wallM]); S.wallN = pierM.length + wallM.length; S.el.glass = inst(R.boxB, mat.glass, glassM); S.glassN = glassM.length;
    S.el.roof = add(new T.Mesh(R.boxB, wc)); S.el.roof.scale.set(W + 0.6, 0.9, Dp + 0.6); S.el.roof.position.set(0, 0.45 + F * FH, bz);
    S.el.hvac = add(new T.Mesh(geo.excav.clone().scale(0.6, 0.5, 0.5), mat.vc)); S.el.hvac.material = new T.MeshLambertMaterial({ color: '#b8bcc2' }); S.el.hvac.position.set(W / 4, 0.45 + F * FH + 0.9, bz - 1);
    // scaffolding: poles every ~2 m around the perimeter + a plank deck per floor
    const scM = [], plM = []; const H = F * FH + 1.2;
    for (let x = -W / 2 - 1; x <= W / 2 + 1.01; x += 2) for (const z of [bz - Dp / 2 - 1, bz + Dp / 2 + 1]) scM.push(mx(x, 0, z, 0.06, H, 0.06));
    for (let z = bz - Dp / 2 + 1; z < bz + Dp / 2; z += 2) for (const x of [-W / 2 - 1, W / 2 + 1]) scM.push(mx(x, 0, z, 0.06, H, 0.06));
    for (let f = 1; f <= F; f++) { const y = 0.45 + f * FH - 1.2; plM.push(mx(0, y, bz - Dp / 2 - 0.75, W + 2, 0.06, 0.7), mx(0, y, bz + Dp / 2 + 0.75, W + 2, 0.06, 0.7), mx(-W / 2 - 0.75, y, bz, 0.7, 0.06, Dp + 2), mx(W / 2 + 0.75, y, bz, 0.7, 0.06, Dp + 2)); }
    S.el.scaf = inst(R.boxB, mat.scaffold, scM); S.el.plank = inst(R.boxB, mat.plank, plM); S.scafH = H;
    // tower crane at the rear corner
    S.el.crane = add(new T.Group()); S.el.crane.position.set(W / 2 + 4, 0, bz - Dp / 2 - 2); { const ch = F * FH + 12; const mast = new T.Mesh(geo.mast, mat.vc); mast.scale.y = ch; S.el.crane.add(mast);
      const jib = new T.Group(); jib.position.y = ch; jib.add(new T.Mesh(geo.jib, mat.vc)); S.el.crane.add(jib); const trolley = new T.Group(); jib.add(trolley);
      const cable = new T.Mesh(R.boxB, mat.cable); cable.scale.set(0.04, 1, 0.04); cable.rotation.x = Math.PI; trolley.add(cable); const hook = new T.Mesh(geo.hook, mat.vc); trolley.add(hook);
      const load = new T.Mesh(R.box, mat.steel); load.scale.set(0.3, 0.3, 4); hook.add(load); load.position.y = -0.8; Object.assign(S, { craneH: ch, jib, trolley, cable, hook, load, mast }); }
    // signage: fascia over the shop front + monument sign at the street, tenant name only when the lease is public
    const name = (e.public && e.tenant) ? e.tenant : 'Coming soon';
    S.signTex = this.textTex([name.toUpperCase(), 'ELDERVERSE TOWN · LOT ' + String(e.lot).padStart(2, '0')], 1024, 256, '#1e1b24', '#e9dcc0', '#d9b45a');
    S.el.fascia = add(new T.Mesh(new T.PlaneGeometry(W * 0.48, W * 0.48 / 4.5), new T.MeshLambertMaterial({ map: S.signTex, emissive: '#ffffff', emissiveMap: S.signTex, emissiveIntensity: 0.15 })));
    S.el.fascia.position.set(0, 0.45 + FH - 0.38, bz + Dp / 2 + 0.3); S.fasciaY = S.el.fascia.position.y;
    S.el.mon = add(new T.Group()); { const b = new T.Mesh(geo.monument, mat.vc), face = new T.Mesh(new T.PlaneGeometry(2.8, 0.7), S.el.fascia.material); face.position.set(0, 1.25, 0.31); S.el.mon.add(b, face); S.el.mon.position.set(W / 2 - 1.5, 0, lot.d / 2 - 1.6); }
    // landscaping: lawn strips + forecourt pavers + shrubs (streamed GLB part, or simple fallback cones of green)
    S.el.lawnL = add(new T.Mesh(R.plane, mat.lawn)); S.el.lawnL.position.set(-W / 2 + 2.5, 0.1, bz + Dp / 2 + 4.6); S.lawnLW = [5, 6];
    S.el.lawnR = add(new T.Mesh(R.plane, mat.lawn)); S.el.lawnR.position.set(W / 2 - 3.5, 0.1, bz + Dp / 2 + 3.2); S.lawnRW = [6, 3.2];
    S.el.pave = add(new T.Mesh(R.plane, mat.pave)); S.el.pave.position.set(0, 0.11, (bz + Dp / 2 + lot.d / 2) / 2); S.paveW = [3.2, lot.d / 2 - (bz + Dp / 2)];
    S.shrubPts = []; for (let i = 0; i < 10; i++) S.shrubPts.push([-W / 2 + 0.8 + i * (W - 1.6) / 9, bz + Dp / 2 + 1.1]); for (let i = 0; i < 4; i++) S.shrubPts.push([-W / 2 + 0.8 + i * 1.5, lot.d / 2 - 1.4]);
    // "now open" banner + progress board at the street edge
    S.openTex = this.textTex(['NOW OPEN', name], 512, 160, '#a8432f', '#fff4dc', '#ffe1a6');
    S.el.banner = add(new T.Mesh(new T.PlaneGeometry(4, 1.25), new T.MeshLambertMaterial({ map: S.openTex, emissive: '#ffffff', emissiveMap: S.openTex, emissiveIntensity: 0.25, side: T.DoubleSide }))); S.el.banner.position.set(0, 0.45 + FH + 0.9, bz + Dp / 2 + 0.6);
    S.board = this.board(g, -lot.w / 2 + 1.7, lot.d / 2 - 1.0, 0);
    // crew work points per stage (local x, y, z, mode, facing)
    const per = (y, n) => { const out = []; for (let i = 0; i < n; i++) { const k = i / n * 4, side = k | 0, f = k - side, hw = W / 2 + 0.75, hd = Dp / 2 + 0.75; const [x, z] = side === 0 ? [-hw + 2 * hw * f, -hd] : side === 1 ? [hw, -hd + 2 * hd * f] : side === 2 ? [hw - 2 * hw * f, hd] : [-hw, hd - 2 * hd * f]; out.push([x, y, bz + z, 'work']); } return out; };
    const tp = S.el.tripod.position;
    S.pts = [
      [[tp.x, 0, tp.z + 0.6, 'survey', Math.PI], ...stakePts.map(([x, z]) => [x, 0, z + 0.4, 'work'])],
      [[-W / 2, 0, bz + Dp / 2 + 2.5, 'work'], [W / 2, 0, bz + Dp / 2 + 2.5, 'work'], [0, 0, bz + Dp / 2 + 3, 'wave', Math.PI], [-W / 2 - 1.5, 0, bz, 'work']],
      per(0, 8), [...per(0, 6), ...Array.from({ length: F }, (_, f) => [[-W / 4, 0.45 + f * FH + FH, bz, 'work'], [W / 4, 0.45 + f * FH + FH, bz + 2, 'work']]).flat()],
      Array.from({ length: F }, (_, f) => per(0.45 + (f + 1) * FH - 1.14, 5)).flat(), Array.from({ length: F }, (_, f) => per(0.45 + (f + 1) * FH - 1.14, 5)).flat(),
      [[-1.2, 0, bz + Dp / 2 + 1.4, 'work', Math.PI], [1.2, 0, bz + Dp / 2 + 1.4, 'work', Math.PI], [W / 2 - 1.5, 0, lot.d / 2 - 2.6, 'work', 0]],
      [...S.shrubPts.filter((_, i) => i % 2 === 0).map(([x, z]) => [x, 0, z + 0.6, 'work', Math.PI])], []];
    S.pts.forEach((p, i) => p.gen = i);
    return S;
  },
  textTex(lines, w, h, bg, fg, accent) {
    const T = this.T, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = accent; g.lineWidth = Math.max(4, h / 40); g.strokeRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; let fs = h * 0.38; g.font = `700 ${fs}px Inter, system-ui, sans-serif`; while (g.measureText(lines[0]).width > w * 0.9 && fs > 10) { fs -= 2; g.font = `700 ${fs}px Inter, system-ui, sans-serif`; }
    g.fillText(lines[0], w / 2, h * (lines[1] ? 0.4 : 0.5)); if (lines[1]) { g.fillStyle = accent; g.font = `600 ${h * 0.15}px Inter, system-ui, sans-serif`; g.fillText(lines[1], w / 2, h * 0.76); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  },
  // construction site sign (Joshua 11:22 PM photo): framed panel with a bevelled timber/bronze frame, header cap with the EWS crest, two
  // posts on concrete footings, a gooseneck lamp that lights the face at night. All geometry = one merged vertex-coloured mesh per sign.
  // Text: safe margins + measure-and-fit on every line (never clipped); the canvas is high-DPI only when the sign is near the camera (LOD).
  signGeo() {
    if (this._signGeo) return this._signGeo; const T = this.T, cols = [];
    const part = (g, hex, x, y, z, rx = 0, ry = 0, rz = 0) => { g = g.toNonIndexed(); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); const c = new T.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) c.toArray(a, k * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
    const B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (a, b, h, n) => new T.CylinderGeometry(a, b, h, n);
    const CON = '#9c968b', WD = '#6b4e33', WDk = '#4f3925', BR = '#8a6d3b', PAN = '#1a1820', GOLD = '#d9b45a', IRON = '#2a2a2e', PW = 2.7, PH = 1.62, CY = 1.95;
    const L = [];
    for (const sx of [-1, 1]) { L.push(part(B(0.5, 0.22, 0.5), CON, sx * 1.22, 0.11, 0), part(B(0.42, 0.06, 0.42), '#aaa49a', sx * 1.22, 0.25, 0),   // footing + chamfer cap
      part(B(0.14, CY + PH / 2 + 0.12 - 0.22, 0.14), WD, sx * 1.22, 0.22 + (CY + PH / 2 + 0.12 - 0.22) / 2, -0.09), part(B(0.16, 0.06, 0.16), WDk, sx * 1.22, CY + PH / 2 + 0.15, -0.09)); }
    L.push(part(B(PW + 0.02, PH + 0.02, 0.05), PAN, 0, CY, -0.03));                                                   // backing board
    for (const [w, h, x, y] of [[PW + 0.2, 0.1, 0, CY + PH / 2 + 0.05], [PW + 0.2, 0.1, 0, CY - PH / 2 - 0.05], [0.1, PH, -PW / 2 - 0.05, CY], [0.1, PH, PW / 2 + 0.05, CY]]) {
      L.push(part(B(w, h, 0.12), WD, x, y, -0.01));                                                                     // frame rails
      L.push(part(B(w > h ? w - 0.08 : 0.04, w > h ? 0.04 : h - 0.06, 0.03), BR, x + (w > h ? 0 : (x < 0 ? 0.04 : -0.04)), y + (w > h ? (y > CY ? -0.04 : 0.04) : 0), 0.055)); }   // bronze bevel lip on the inside edge
    L.push(part(B(PW + 0.42, 0.07, 0.42), WDk, 0, CY + PH / 2 + 0.14, 0.02), part(B(PW + 0.3, 0.05, 0.34), '#3b3b40', 0, CY + PH / 2 + 0.2, 0.02));   // header cap (drip edge)
    L.push(part(C(0.17, 0.17, 0.04, 20), GOLD, 0, CY + PH / 2 + 0.42, 0.04, Math.PI / 2), part(C(0.13, 0.13, 0.045, 20), '#16141b', 0, CY + PH / 2 + 0.42, 0.045, Math.PI / 2), part(B(0.06, 0.18, 0.05), WDk, 0, CY + PH / 2 + 0.26, 0.04));   // EWS crest on the cap
    L.push(part(B(0.04, 0.04, 0.5), IRON, PW / 2 - 0.25, CY + PH / 2 + 0.3, 0.2), part(B(0.04, 0.2, 0.04), IRON, PW / 2 - 0.25, CY + PH / 2 + 0.2, -0.04), part(C(0.05, 0.11, 0.09, 10), IRON, PW / 2 - 0.25, CY + PH / 2 + 0.27, 0.45));   // lamp arm + shade
    const merged = mergeGeometries(L); merged.computeVertexNormals();
    const bulb = new T.CylinderGeometry(0.06, 0.06, 0.02, 10); bulb.translate(PW / 2 - 0.25, CY + PH / 2 + 0.22, 0.45);
    const cone = new T.ConeGeometry(0.75, 0.9, 16, 1, true); cone.translate(0, -0.45, 0); cone.rotateX(-0.5); cone.translate(PW / 2 - 0.25, CY + PH / 2 + 0.22, 0.45);
    return (this._signGeo = { merged, bulb, cone, PW, PH, CY });
  },
  board(parent, x, z, ry) {
    const T = this.T, { mat } = this.res(), G = this.signGeo(), me = this;
    const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; grp.add(new T.Mesh(G.merged, mat.vc));
    const fm = new T.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 }), face = new T.Mesh(new T.PlaneGeometry(G.PW, G.PH), fm); face.position.set(0, G.CY, 0.004); grp.add(face);
    const bulb = new T.Mesh(G.bulb, new T.MeshBasicMaterial({ color: '#3a3428' })); grp.add(bulb);
    const glow = new T.Mesh(G.cone, new T.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.025, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); glow.visible = false; grp.add(glow);
    grp.traverse(o => o.userData.noCollide = 1); parent.add(grp);
    let key = '', res = 0, c = null, tex = null, lastAt = 0, args = null;
    const FONT = (w, px) => `${w} ${px}px Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
    // fit: shrink to fit the box; below the floor size, ellipsize. Returns the font size used.
    const fit = (g, txt, maxW, px, w, min) => { g.font = FONT(w, px); while (g.measureText(txt).width > maxW && px > min) { px -= 1; g.font = FONT(w, px); }
      if (g.measureText(txt).width > maxW) { let t = txt; while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); txt = t + '…'; } return [txt, px]; };
    const paint = () => { const [title, sub, stage, pct, step, steps, note, o] = args, W = c.width, H = c.height, k = W / 1024, g = c.getContext('2d'), M = 46 * k, IW = W - 2 * M;
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillStyle = '#16141b'; g.fillRect(0, 0, W, H); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // header band: crest + lot plaque
      g.fillStyle = '#241f18'; g.fillRect(0, 0, W, 92 * k); g.fillStyle = '#d9b45a'; g.fillRect(0, 92 * k, W, 4 * k);
      const cx = M + 34 * k, cy = 46 * k; g.beginPath(); g.arc(cx, cy, 32 * k, 0, 7); g.fillStyle = '#d9b45a'; g.fill(); g.beginPath(); g.arc(cx, cy, 26 * k, 0, 7); g.fillStyle = '#16141b'; g.fill();
      g.fillStyle = '#d9b45a'; g.textAlign = 'center'; g.font = FONT(800, 20 * k); g.fillText('EWS', cx, cy + 7 * k); g.textAlign = 'left';
      const plaque = (o && o.plaque) || ''; let pw = 0; if (plaque) { const [pt, ps] = fit(g, plaque, 260 * k, 34 * k, 800, 18 * k); g.font = FONT(800, ps); pw = g.measureText(pt).width + 36 * k;
        g.fillStyle = '#d9b45a'; g.fillRect(W - M - pw, 18 * k, pw, 56 * k); g.fillStyle = '#16141b'; g.fillText(pt, W - M - pw + 18 * k, 58 * k); }
      { const [hd, hs] = fit(g, (o && o.header) || 'ELDER WORLD STUDIO · CONSTRUCTION', IW - 90 * k - pw - 20 * k, 24 * k, 700, 14 * k); g.font = FONT(700, hs); g.fillStyle = '#e9dcc0'; g.fillText(hd, M + 84 * k, 56 * k); }
      // name + line
      let y = 168 * k; { const [t, s2] = fit(g, title, IW, 58 * k, 800, 26 * k); g.font = FONT(800, s2); g.fillStyle = '#f3ead6'; g.fillText(t, M, y); }
      y += 46 * k; { const [t, s2] = fit(g, sub, IW, 32 * k, 500, 18 * k); g.font = FONT(500, s2); g.fillStyle = '#b9ad94'; g.fillText(t, M, y); }
      // stage + percent (percent measured first so the stage never runs under it)
      y += 70 * k; const pc = Math.floor(clamp(pct) * 100) + '%'; g.font = FONT(800, 46 * k); const pcw = g.measureText(pc).width; g.fillStyle = '#ffd58a'; g.textAlign = 'right'; g.fillText(pc, W - M, y); g.textAlign = 'left';
      { const [t, s2] = fit(g, stage, IW - pcw - 30 * k, 46 * k, 800, 22 * k); g.font = FONT(800, s2); g.fillText(t, M, y); }
      // segmented meter: one segment per stage; done = full, current = filled to its real fraction, rest empty
      y += 26 * k; const gap = 8 * k, sw = (IW - gap * (steps - 1)) / steps, sh = 34 * k, cur = Math.min(steps, pct * steps);
      for (let i = 0; i < steps; i++) { const x0 = M + i * (sw + gap); g.fillStyle = '#2c2833'; g.fillRect(x0, y, sw, sh); const fr = clamp(cur - i);
        if (fr > 0) { g.fillStyle = fr >= 1 ? '#d9b45a' : '#ffd58a'; g.fillRect(x0, y, sw * fr, sh); } if (i === step && fr < 1) { g.strokeStyle = '#ffd58a'; g.lineWidth = 2 * k; g.strokeRect(x0 + k, y + k, sw - 2 * k, sh - 2 * k); } }
      if (o && o.labels) { g.font = FONT(600, 15 * k); for (let i = 0; i < steps; i++) { const [t] = fit(g, o.labels[i] || '', sw - 4 * k, 15 * k, 600, 9 * k); g.fillStyle = i <= step ? '#cdbf9f' : '#6d6578'; g.fillText(t, M + i * (sw + gap) + 2 * k, y + sh + 22 * k); } }
      // live line
      y = H - 34 * k; g.beginPath(); g.arc(M + 8 * k, y - 9 * k, 7 * k, 0, 7); g.fillStyle = o && o.hold ? '#8fb3d9' : '#7bd88f'; g.fill();
      { const [t, s2] = fit(g, note, IW - 26 * k, 26 * k, 500, 14 * k); g.font = FONT(500, s2); g.fillStyle = '#a99f8c'; g.fillText(t, M + 26 * k, y); }
      tex.needsUpdate = true; };
    const draw = (title, sub, stage, pct, step, steps, note, o) => {
      const cam = me.ctx.cam.position, wp = grp.getWorldPosition(me._v3 ||= new T.Vector3()), d = Math.hypot(wp.x - cam.x, wp.z - cam.z), want = d < 16 ? 1024 : 512;
      const night = (me.ctx.dayNight?.el ?? 30) < -2; glow.visible = night && d < 60; bulb.material.color.set(night ? '#ffe7b8' : '#3a3428'); fm.emissiveIntensity = night ? 0.55 : 0.3;
      if (want !== res) { res = want; c = document.createElement('canvas'); c.width = want; c.height = Math.round(want * G.PH / G.PW); tex?.dispose(); tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; fm.map = fm.emissiveMap = tex; fm.needsUpdate = true; key = ''; }
      const k2 = [title, sub, stage, Math.floor(pct * 400), step, note, o && o.plaque, o && o.hold].join('|'); args = [title, sub, stage, pct, step, steps, note, o];
      const now = performance.now(); if (k2 === key || now - lastAt < 250) return; key = k2; lastAt = now; paint(); };
    if (document.fonts?.ready) document.fonts.ready.then(() => { key = ''; });   // repaint once the web font is in (old canvas measured the fallback)
    return { grp, draw, face };
  },
  loadPart(S, stage, url) {
    if (S.parts[stage]) return S.parts[stage]; const T = this.T, p = S.parts[stage] = { url, obj: null, state: 'loading' };
    (this._gl ||= new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(this.ctx.renderer))).load(url, gl => { p.state = 'ready'; p.scene = gl.scene; gl.scene.updateMatrixWorld(true); this.placePart(S, stage, p); this.stats.glbs = (this.stats.glbs || 0) + 1; }, undefined, err => { p.state = 'failed'; console.warn('world part failed', url, err?.message || err); });
    return p;
  },
  placePart(S, stage, p) {
    const T = this.T, src = p.scene;
    if (stage === 'landscaping') {   // shrub/plant GLB: instance it on every planting point, revealed one by one
      const bb = new T.Box3().setFromObject(src), k = 0.9 / Math.max(bb.getSize(new T.Vector3()).y, 0.01), meshes = []; src.traverse(o => { if (o.isMesh) meshes.push(o); });
      p.obj = new T.Group(); p.inst = meshes.map(o => { const m = new T.InstancedMesh(o.geometry, new T.MeshLambertMaterial({ map: o.material.map, color: o.material.color, alphaTest: 0.5, side: T.DoubleSide }), S.shrubPts.length);
        S.shrubPts.forEach(([x, z], i) => m.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(x, 0.1 - bb.min.y * k, z), new T.Quaternion().setFromEuler(new T.Euler(0, i * 2.1, 0)), new T.Vector3(k, k, k)).multiply(o.matrixWorld)));
        m.count = 0; m.userData.noCollide = 1; p.obj.add(m); return m; });
      S.g.add(p.obj);
    } else {                          // any other stage: a full model for that stage, fitted to the footprint, rising into place
      const bb = new T.Box3().setFromObject(src), sz = bb.getSize(new T.Vector3()), k = Math.min(S.W / Math.max(sz.x, 0.01), S.Dp / Math.max(sz.z, 0.01));
      p.obj = new T.Group(); src.scale.setScalar(k); src.position.set(-(bb.min.x + sz.x / 2) * k, -bb.min.y * k + 0.45, -(bb.min.z + sz.z / 2) * k); p.obj.add(src); p.obj.position.z = S.bz; p.obj.traverse(o => o.userData.noCollide = 1); S.g.add(p.obj);
    }
  },

  /* ---------------- a road job ---------------- */
  makeRoad(e) {
    const T = this.T, ctx = this.ctx, R = this.res(), { mat, geo } = R; if (!e.a || !e.b) return null;
    const [ax, az] = e.a, [bx, bz] = e.b, L = Math.hypot(bx - ax, bz - az), w = e.w || 8, ang = Math.atan2(-(bz - az), bx - ax);
    const g = new T.Group(); g.name = 'world:' + e.id; g.userData.keep = 1; g.position.set(ax, 0, az); g.rotation.y = ang; ctx.scene.add(g);
    const strip = (m, y) => { const s = new T.Mesh(R.planeX0, m); s.position.y = y; s.scale.set(0.001, 1, w); s.userData.noCollide = 1; g.add(s); return s; };
    const S = { e, g, L, w, ang, el: {}, crew: [] };
    S.el.grade = strip(e.resurface ? mat.milled : mat.dirt, 0.036); S.el.base = strip(e.resurface ? mat.tack : mat.gravel, 0.04); S.el.fresh = strip(mat.fresh, 0.045);
    const cones = []; for (let x = 1; x < L - 0.5; x += 4) for (const z of [-w / 2 - 0.4, w / 2 + 0.4]) cones.push(new T.Matrix4().makeTranslation(x, 0.04, z));
    S.el.cones = new T.InstancedMesh(geo.cone, mat.vc, cones.length); cones.forEach((m, i) => S.el.cones.setMatrixAt(i, m)); S.el.cones.count = 0; S.el.cones.userData.noCollide = 1; g.add(S.el.cones); S.coneN = cones.length;
    const dash = []; for (let x = 1.5; x < L - 1.5; x += 6) dash.push(new T.Matrix4().compose(new T.Vector3(x + 1.3, 0.05, 0), new T.Quaternion(), new T.Vector3(2.6, 1, 0.16)));
    S.el.dash = new T.InstancedMesh(R.plane, mat.stripe, dash.length); dash.forEach((m, i) => S.el.dash.setMatrixAt(i, m)); S.el.dash.count = 0; S.el.dash.userData.noCollide = 1; g.add(S.el.dash); S.dashN = dash.length; S.dashX = dash.map(m => m.elements[12]);
    S.el.paver = new T.Mesh(geo.paver, mat.vc); S.el.paver.rotation.y = Math.PI / 2; g.add(S.el.paver);
    S.el.roller = new T.Mesh(geo.roller, mat.vc); S.el.roller.rotation.y = Math.PI / 2; g.add(S.el.roller);
    S.el.grader = new T.Group(); { const b = new T.Mesh(geo.excav, mat.vc), boom = new T.Mesh(geo.boom, mat.vc); boom.position.set(0, 1.6, 0.9); S.el.grader.add(b, boom); S.el.grader.rotation.y = Math.PI / 2; S.gBoom = boom; } g.add(S.el.grader);
    S.el.striper = new T.Mesh(geo.striper, mat.vc); S.el.striper.rotation.y = Math.PI / 2; g.add(S.el.striper);
    for (const k of ['paver', 'roller', 'grader', 'striper']) S.el[k].traverse(o => o.userData.noCollide = 1);
    S.board = this.board(g, -2.5, -w / 2 - 2.2, Math.PI / 2 * 0); S.board.grp.rotation.y = -Math.PI / 2 + 0; S.board.grp.position.set(-2.5, 0, -w / 2 - 2.5); S.board.grp.rotation.y = -Math.PI / 2;
    return S;
  },

  /* ---------------- work zones (no lot): e.g. the campus ground-floor rebuild. Taped corners, survey kit, materials, rolling scaffold ---------------- */
  makeZone(e) {
    const T = this.T, ctx = this.ctx, town = ctx.town, R = this.res(), { geo, mat } = R; if (!town || !Array.isArray(e.rect)) return null;
    const [x0, z0, x1, z1] = e.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const g = new T.Group(); g.name = 'world:' + e.id; g.position.set(town.X0 + cx, (e.floor && e.floor !== 'G') ? 0 : 0, town.Z0 + cz); ctx.scene.add(g);
    const S = { e, g, w, d, r: Math.hypot(w, d) / 2, el: {}, crew: [] }, hw = w / 2 - 0.6, hd = d / 2 - 0.6;
    const cones = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([x, z]) => new T.Matrix4().makeTranslation(x, 0.02, z));
    S.el.cones = new T.InstancedMesh(geo.cone, mat.vc, 4); cones.forEach((m, i) => S.el.cones.setMatrixAt(i, m)); g.add(S.el.cones);
    const stakes = [[-hw + 1, -hd + 1], [hw - 1, -hd + 1], [hw - 1, hd - 1], [-hw + 1, hd - 1], [0, -hd + 1], [0, hd - 1]];
    S.el.stakes = new T.InstancedMesh(geo.stake, mat.vc, stakes.length); stakes.forEach(([x, z], i) => S.el.stakes.setMatrixAt(i, new T.Matrix4().makeTranslation(x, 0, z))); S.el.stakes.count = 0; g.add(S.el.stakes); S.stakeN = stakes.length;
    S.el.tripod = new T.Mesh(geo.tripod, mat.vc); S.el.tripod.position.set(-hw + 2, 0, hd - 2.2); g.add(S.el.tripod);
    S.el.pallet = new T.Group(); for (let i = 0; i < 6; i++) { const b = new T.Mesh(R.boxB, i % 2 ? mat.plank : mat.concrete); b.scale.set(1.1, 0.28, 0.8); b.position.set((i % 2) * 0.05, (i / 2 | 0) * 0.3 + 0.12, 0); S.el.pallet.add(b); } S.el.pallet.position.set(hw - 1.4, 0, hd - 1.6); g.add(S.el.pallet);
    S.el.tower = new T.Group(); { const H = 3.2; for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) { const p = new T.Mesh(R.boxB, mat.scaffold); p.scale.set(0.05, H, 0.05); p.position.set(x, 0, z); S.el.tower.add(p); }
      for (const y of [1.1, 2.2, 3.15]) { const k = new T.Mesh(R.boxB, mat.plank); k.scale.set(1.3, 0.05, 0.9); k.position.y = y; S.el.tower.add(k); } } g.add(S.el.tower);
    S.board = this.board(g, -hw + 1.6, hd - 0.4, 0);
    g.traverse(o => { o.userData.noCollide = 1; }); g.userData.keep = 1; g.userData.noFarCull = 1;
    S.pts = Array.from({ length: 9 }, (_, i) => { const st = [[-hw + 2.4, 0, hd - 2.2, 'survey', Math.PI], ...stakes.map(([x, z]) => [x, 0, z + 0.4, 'work']), [hw - 1.4, 0, hd - 2.4, 'work', Math.PI], [0, 0, 0, 'work']]; return st; });
    S.pts.forEach((p, i) => p.gen = 'z' + i);
    return S;
  },
  drawZone(S, si, f, t, near, dt, crewN) {
    const el = S.el, e = S.e, at = k => si === BUILD.indexOf(k);
    el.cones.visible = si < 8; el.stakes.count = at('survey') ? Math.ceil(f * S.stakeN) : si <= 2 ? S.stakeN : 0; el.stakes.instanceMatrix.needsUpdate = true; el.tripod.visible = si <= 1;
    el.pallet.visible = si >= 1 && si <= 5; el.tower.visible = !e.floor && si >= 3 && si <= 6; if (el.tower.visible) el.tower.position.set(S.w / 2 - 3, 0, -S.d / 4);   /* indoor zones (e.floor, e.g. the ground-floor rebuild) get no rolling scaffold: it slid across the finished lobby and read as a moving shelf (Joshua 11:29 PM); outdoors it stands still */
    S.board.grp.visible = si < 8; if (near && si < 8) S.board.draw(e.name.toUpperCase().slice(0, 26), e.arch ? 'Architecture team job · live' : 'Work zone · live', e.hold ? 'Planned · awaiting layout approval' : BL[si], e.hold ? 0 : (si + f) / 8, e.hold ? 0 : si, 8, e.hold ? 'Architects planning on site · no building until the layout is approved' : 'Real progress from the team · ' + this.ago(e.since), { plaque: 'ZONE', hold: !!e.hold });
    const n = near && si < 8 && si >= 1 ? Math.min(2, crewN) : 0; this.ensureCrew(S, n); for (let i = n; i < S.crew.length; i++) S.crew[i].on = false;
    const pts = S.pts[0].slice(1); pts.gen = 'z' + si; this.crewStep(S.crew.slice(0, n), pts, dt, S.g.position, 0);
  },
  /* ---------------- architecture team in the field (CT119 agent.pose zone 'town'): walk out through the sliding doors to the job ---------------- */
  architects(dt, t, onG) {
    const ctx = this.ctx, town = ctx.town; if (!town || !this.agents) return;
    const NAMES = { 'lead-arch': 'Máni', 'arch-building': 'Vili', 'arch-landscape': 'Jörð', 'arch-qa': 'Vé' }, figs = (this.figs ||= new Map());
    const out = [...this.agents.values()].filter(a => a.zone === 'town' && a.act !== 'away');
    // the job they are working: an unfinished architecture job (site or zone), else the lot the server named
    const jobs = [...this.ents.values()].filter(e => e.arch && this.target(e) < 1).sort((a, b) => (b.at || 0) - (a.at || 0)); const job = jobs[0];
    const door = [town.X0, town.Z0 + 2.2], doorIn = [town.X0, town.Z0 - 1.8], curb = [town.X0, town.AVE - town.RW / 2 - 1.6];
    const pool = this.crew('arch'); let k = 0;
    for (const a of out) {
      let F = figs.get(a.id); if (!F) { F = { id: a.id, x: door[0], y: 0, z: door[1], yaw: 0, phase: Math.random() * 6, mode: 'walk', on: true, path: [], key: '' }; figs.set(a.id, F); pool.list.push(F); }
      F.leaving = false; F.on = onG; let tx, tz, mode = 'work', face = null, inside = false;
      if (job) { const S = this.sites.get(job.id); if (S && S.e.kind === 'zone') { const p = S.pts[0][k % S.pts[0].length]; tx = S.g.position.x + p[0]; tz = S.g.position.z + p[2]; mode = p[3]; face = p[4]; inside = true; }
        else if (S && S.pts) { const p = S.pts[0][k % S.pts[0].length], th = S.g.rotation.y, c = Math.cos(th), sn = Math.sin(th); tx = S.g.position.x + p[0] * c + p[2] * sn; tz = S.g.position.z - p[0] * sn + p[2] * c; mode = p[3]; face = p[4] != null ? th + p[4] : null; } }
      if (tx == null) { const L = town.lots[(a.lot || 9) - 1] || town.lots[8]; tx = L.cx - 4 + k * 2.2; tz = L.cz + L.face * (L.d / 2 - 1); mode = k === 0 ? 'survey' : 'work'; }
      const key = [tx.toFixed(1), tz.toFixed(1)].join(','); if (key !== F.key) { F.key = key; F.path = inside ? [door, doorIn, [tx, tz]] : (F.z < town.Z0 + 1 ? [doorIn, door, curb, [tx, tz]] : [curb, [tx, tz]]); if (Math.hypot(F.x - tx, F.z - tz) < 6) F.path = [[tx, tz]]; F.arrive = mode; F.face = face; }
      k++;
    }
    for (const [id, F] of figs) if (!out.find(a => a.id === id) && !F.leaving && !(F.arrivedAt && performance.now() - F.arrivedAt < 60000) && !(F.path.length && !F.arrivedAt)) { F.leaving = true; F.path = F.z < town.Z0 ? [door, doorIn] : [curb, door, doorIn]; F.arrive = 'gone'; F.key = ''; }
    for (const [id, F] of figs) {
      const wp = F.path[0];
      if (wp) { const dx = wp[0] - F.x, dz = wp[1] - F.z, d = Math.hypot(dx, dz); if (d < 0.2) { F.path.shift(); if (!F.path.length && F.arrive !== 'gone') F.arrivedAt = performance.now(); } else { let rem = d; for (let i = 1; i < F.path.length; i++) rem += Math.hypot(F.path[i][0] - F.path[i - 1][0], F.path[i][1] - F.path[i - 1][1]); const st = Math.min(d, dt * (rem > 15 ? 2.6 : 1.35)); F.x += dx / d * st; F.z += dz / d * st; F.yaw = Math.atan2(dx, dz); F.mode = 'walk'; } }
      else if (F.arrive === 'gone') { F.on = false; pool.list = pool.list.filter(x => x !== F); figs.delete(id); F.tag?.parent?.remove(F.tag); continue; }
      else { F.mode = F.arrive || 'work'; if (F.face != null) F.yaw = F.face; }
      if (!F.tag && ctx.label) { F.tag = ctx.label(NAMES[id.replace(/^agent:/, '')] || 'Architect', 'Architecture team'); F.tag.userData.noCollide = 1; ctx.scene.add(F.tag); }
      if (F.tag) { F.tag.position.set(F.x, 2.15, F.z); const dd = Math.hypot(F.x - ctx.cam.position.x, F.z - ctx.cam.position.z); F.tag.visible = onG && dd < 28; F.tag.quaternion.copy(ctx.cam.quaternion); }
    }
    pool.draw(t);
  },

  /* ---------------- Elderverse patrol (security team, CT119 agent.pose zone 'town', campus frame): on foot with tablets ---------------- */
  patrols(dt, t, onG) {
    const ctx = this.ctx, town = ctx.town; if (!town || !this.agents) return; const T = this.T;
    if (!this.post) { const R = this.res(), x = town.guardPostX ?? town.X0 + 4.6; this.post = new T.Mesh(R.geo.post, R.mat.vc); this.post.position.set(x, 0, town.Z0 + 53.2 + 1.3); this.post.userData.noCollide = 1; this.post.userData.keep = 1; this.post.userData.noFarCull = 1; ctx.scene.add(this.post);
      this.ctx.colliders?.push?.([x - 0.9, town.Z0 + 53.6, x + 0.9, town.Z0 + 55.4]); }
    this.post.visible = onG && (ctx.exterior?.root?.visible ?? true);
    const NAMES = { 'sec-lead': 'Hœnir', 'sec-vuln': 'Geri', 'sec-harden': 'Sigyn', 'sec-pentest': 'Skírnir', 'sec-watch': 'Freki' }, now = Date.now(), cops = (this.cops ||= new Map()), pool = this.crew('sec');
    const av = ctx.use('avatar'), cam = ctx.cam.position, seen = new Set();
    for (const a of this.agents.values()) {
      const sid = a.id.replace(/^agent:/, ''); if (!NAMES[sid] || a.zone !== 'town') continue; seen.add(sid);
      // server position, dead-reckoned along its walk target at its speed between the ~1 s pose batches (never past the target)
      let px = a.x, pz = a.z; if (a.to && a.v) { const el = Math.max(0, (now + (this.skew || 0) - a.at) / 1000), dx = a.to[0] - a.x, dz = a.to[1] - a.z, d = Math.hypot(dx, dz), m = Math.min(d, a.v * el); if (d > 1e-3) { px += dx / d * m; pz += dz / d * m; } }
      const wx = town.X0 + px, wz = town.Z0 + pz;
      let F = cops.get(sid); if (!F) { F = { id: sid, x: wx, y: 0, z: wz, yaw: a.h || 0, phase: Math.random() * 6, ph: 0, mode: 'walk', on: true, tablet: true }; cops.set(sid, F); pool.list.push(F); }
      const dx = wx - F.x, dz = wz - F.z, d = Math.hypot(dx, dz);
      if (d > 12) { F.x = wx; F.z = wz; } else if (d > 0.03) { const sp = Math.min(d / Math.max(dt, 1e-3), d > 1.5 ? 2.2 : 1.45), st = Math.min(d, sp * dt); F.x += dx / d * st; F.z += dz / d * st; F.yaw = Math.atan2(dx, dz); F.ph += st * 4.4; F.speed = st / Math.max(dt, 1e-3); }   // stride-synced: 4.4 rad per metre
      else F.speed = 0;
      const moving = (F.speed || 0) > 0.15; F.mode = moving ? 'walk' : 'idle'; if (!moving && a.act !== 'walk') F.yaw = sid === 'sec-lead' ? 0 : (a.h ?? F.yaw);
      F.on = onG && (ctx.exterior?.root?.visible ?? true);
      // near the camera: the shared rigged avatar (real walk clip at its measured ground speed, tablet = the carry prop); far: instanced figure
      const dc = Math.hypot(F.x - cam.x, F.z - cam.z), wantRig = !!av?.make && F.on && dc < 12 && (ctx.lod || 1) >= 0.5;
      if (wantRig && !F.av) { try { F.av = av.make({ id: 'patrol-' + sid, name: NAMES[sid], role: 'Elderverse patrol' }, '#1f2a3d'); ctx.scene.add(F.av); const fo = F.av.userData.folder; if (fo) { fo.material = new T.MeshLambertMaterial({ color: '#101318' }); fo.scale.multiplyScalar(1.15); } } catch { F.av = null; } }
      F.rigged = !!(wantRig && F.av);
      if (F.av) { const u = F.av.userData; F.av.visible = F.rigged; if (F.rigged) { u.state = { stage: 'review' }; u.target = moving ? { x: F.x + Math.sin(F.yaw) * 0.4, z: F.z + Math.cos(F.yaw) * 0.4 } : null;
          F.av.position.set(F.x, 0, F.z); F.av.rotation.y = F.yaw; if (moving && u.cur === 'carry') u.act('carry').timeScale = (F.speed || 1.3) / 0.65; } }
    }
    for (const [sid, F] of cops) if (!seen.has(sid)) { F.on = false; if (F.av) F.av.visible = false; }
    pool.draw(t);
  },

  drop(id) { const S = this.sites.get(id); if (!S) return; S.g.parent?.remove(S.g); S.g.traverse(o => { if (o.isInstancedMesh) o.dispose?.(); }); for (const w of S.crew) w.on = false; if (this.workers) this.workers.list = this.workers.list.filter(w => !S.crew.includes(w)); this.sites.delete(id); },

  /* ---------------- per frame ---------------- */
  onFrame(dt, t) {
    const ctx = this.ctx; if (!window.__ewsOffice) return;
    if (!this.hooked) { this.hooked = true; window.__ewsOffice.world = () => ({ layout: this.layout || null, float: Math.max(0, ...[this.workers, this.archPool, this.secPool].filter(Boolean).flatMap(P => P.list.filter(w => w.on && !w.rigged).map(w => (w.y > 0.05 && w.y > (w.top ?? 0.05) + 0.05) || (w.mode === 'walk' && w.y > 0.05 && Math.abs(w.y - (w.tgt?.[1] ?? 0)) > 0.05) ? w.y : 0))), crewOn: [this.workers, this.archPool, this.secPool].filter(Boolean).reduce((n, P) => n + P.list.filter(w => w.on).length, 0), mode: this.stats.mode, msgs: this.stats.msgs, agents: this.agents.size, patrol: this.cops ? [...this.cops.values()].map(F => ({ id: F.id, x: +F.x.toFixed(1), z: +F.z.toFixed(1), mode: F.mode, rig: !!F.rigged, on: F.on })) : [], field: this.figs ? [...this.figs.values()].map(F => ({ id: F.id, x: +F.x.toFixed(1), z: +F.z.toFixed(1), mode: F.mode, leaving: !!F.leaving })) : [], glbs: this.stats.glbs || 0, ents: [...this.ents.values()].map(e => ({ id: e.id, kind: e.kind, stage: (e.kind === 'road' ? ROAD : BUILD)[e.si], p: e.p, target: +this.target(e).toFixed(3), shown: +(this.vis.get(e.id)?.D ?? 0).toFixed(3), demo: !!e.demo })), workers: this.workers ? this.workers.list.filter(w => w.on).length : 0 });
      window.__ewsOffice.watchBuild = id => this.watch(id); window.__ewsOffice.signAt = id => { const S = this.sites.get(id); if (!S?.board) return null; const g = S.board.grp, p = g.getWorldPosition(new this.T.Vector3()), q = new this.T.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new this.T.Quaternion())); return { x: p.x, z: p.z, nx: q.x, nz: q.z }; }; window.__ewsOffice.demoBuild = o => this.demo(o); }
    if (!ctx.town || !ctx.exterior) return;
    if (this.stand) this.stand.visible = !!(this.layout && this.layout.approved);   // no 'watch the town build' demo while construction is on hold
    const ext = ctx.exterior.root, onG = !ctx.curFloor || ctx.curFloor === 'G', show = onG && ext.visible, cam = ctx.cam, cp = cam.position;
    const tier = ctx.tier ?? 1, crewN = [2, 3, 4][tier] ?? 3, view = [85, 110, 125][tier] ?? 110, night = (ctx.dayNight?.el ?? 30) < -2;
    for (const [id, e] of this.ents) {
      let S = this.sites.get(id); if (!S) { S = e.kind === 'road' ? this.makeRoad(e) : e.kind === 'zone' ? this.makeZone(e) : this.makeSite(e); if (!S) continue; S.g.userData.noFarCull = 1; S.g.userData.keep = 1; S.g.traverse(o => { o.userData.noCollide = 1; }); this.sites.set(id, S); }
      S.e = e; const v = this.vis.get(id); const tgt = this.target(e); if (v.D == null) v.D = tgt;
      v.D += (tgt - v.D) * Math.min(1, dt * 1.8); if (Math.abs(tgt - v.D) < 1e-4) v.D = tgt;     // ease toward the real (or pipeline-estimated) progress
      const N = (e.kind === 'road' ? ROAD : BUILD).length - 1, x = v.D * N, si = Math.min(N, Math.floor(x + 1e-6)), f = si >= N ? 1 : x - si;
      if (si !== v.stage) { if (v.stage >= 0 || v.fresh) this.toast(e, si); v.stage = si; }
      const dx = S.g.position.x - cp.x, dz = S.g.position.z - cp.z, dist = Math.hypot(dx, dz) - (e.kind === 'road' ? S.L / 2 : e.kind === 'zone' ? S.r : 0);
      S.g.visible = e.kind === 'zone' ? (ctx.curFloor || 'G') === (e.floor || 'G') && dist < 45 : show && dist < view; if (!S.g.visible) { for (const w of S.crew) w.on = false; continue; }
      const near = dist < 90;
      if (e.kind === 'zone') this.drawZone(S, si, f, t, dist < 40, dt, crewN); else if (e.kind === 'road') this.drawRoad(S, si, f, t, near, dt, crewN); else this.drawSite(S, si, f, t, near, dt, crewN, night);
    }
    if (this.workers) this.workers.draw(t);
    this.architects(dt, t, onG); this.patrols(dt, t, onG);
    this.flushToast(dt);
  },
  ensureCrew(S, n) { const W = this.crew(); while (S.crew.length < n && W.list.length < W.MAX) { const w = { x: S.g.position.x + (Math.random() - 0.5) * 4, y: 0, z: S.g.position.z + (Math.random() - 0.5) * 4, yaw: 0, phase: Math.random() * 6, i: (Math.random() * 5) | 0, mode: 'walk', on: false }; S.crew.push(w); W.list.push(w); } },
  drawSite(S, si, f, t, near, dt, crewN, night) {
    const el = S.el, F = S.F, FH = S.FH, e = S.e, cur = BUILD[si], done = k => si > BUILD.indexOf(k), at = k => si === BUILD.indexOf(k), from = k => si >= BUILD.indexOf(k);
    // survey
    el.stakes.count = at('survey') ? Math.ceil(f * 12) : si <= 1 ? 12 : 0; el.stakes.instanceMatrix.needsUpdate = true;
    el.tape.visible = si <= 1 && (si > 0 || f > 0.05); el.tape.geometry.setDrawRange(0, 2 * Math.max(0, (at('survey') ? Math.floor(f * 12) - 1 : 12))); el.tripod.visible = at('survey');
    // ground prep: the pad spreads from one end behind the excavator
    const dg = at('groundwork') ? sm(f) : from('foundation') ? 1 : 0; el.dirt.visible = dg > 0 && si < 8; el.dirt.scale.set(Math.max(0.01, S.dirtW * dg), 0.12, S.dirtD); el.dirt.position.set(-S.dirtW / 2 + S.dirtW * dg / 2, 0.06 - (si >= 7 ? 0 : 0), S.bz);
    el.excav.visible = at('groundwork'); if (el.excav.visible) { el.excav.position.set(-S.dirtW / 2 + S.dirtW * dg + 2.2, 0, S.bz + Math.sin(t * 0.4) * 2); el.excav.rotation.y = -Math.PI / 2; if (near) S.boom.rotation.x = -0.3 + Math.sin(t * 1.3) * 0.35; }
    // foundation: forms, then the slab pours up
    el.form.visible = at('foundation') && f < 0.92; el.mixer.visible = at('foundation'); if (el.mixer.visible && near) S.drum.rotation.z += dt * 2.5;
    el.slab.visible = from('foundation') && (si > 2 || f > 0.15); el.slab.scale.y = at('foundation') ? Math.max(0.02, 0.45 * clamp((f - 0.15) / 0.75)) : 0.45;
    // framing: members appear bottom-up; the newest one grows into place
    const fr = at('framing') ? f * S.frN : from('walls') ? S.frN : 0; this.reveal(el.frame, fr); const floorsUp = Math.min(F, Math.floor(fr / S.frPerFloor + 1e-6)); el.deck.count = floorsUp; el.deck.instanceMatrix.needsUpdate = true;
    // walls + glazing
    this.reveal(el.wall, at('walls') ? f * S.wallN : from('glazing') ? S.wallN : 0); this.reveal(el.glass, at('glazing') ? f * S.glassN : from('signage') ? S.glassN : 0);
    el.roof.visible = from('walls'); el.roof.scale.y = at('walls') ? 0.9 * clamp(f * 3) : 0.9; el.hvac.visible = from('glazing') && (si > 5 || f > 0.6);
    el.glass.material.emissive.set(night && from('landscaping') ? '#6b5330' : '#000000');
    // scaffolding up from late framing until signage
    const sc = (at('framing') && f > 0.6) || at('walls') || at('glazing') || (at('signage') && f < 0.35); el.scaf.count = sc ? el.scaf.userData.full.length : 0; el.plank.count = sc ? el.plank.userData.full.length : 0; el.scaf.instanceMatrix.needsUpdate = el.plank.instanceMatrix.needsUpdate = true;
    // crane: rises during foundation, works framing -> glazing, comes down during signage
    const cr = at('foundation') ? clamp((f - 0.4) / 0.5) : (from('framing') && si <= 5) ? 1 : at('signage') ? 1 - clamp(f / 0.4) : 0;
    el.crane.visible = cr > 0.01; if (el.crane.visible) { S.mast.scale.y = S.craneH * cr; S.jib.position.y = S.craneH * cr; S.jib.visible = cr > 0.95;
      if (near && S.jib.visible) { const busy = si >= 3 && si <= 5, a = busy ? -0.6 + Math.sin(t * 0.25) * 0.9 : -0.3; S.jib.rotation.y = a; const reach = 8 + Math.sin(t * 0.25 + 1) * 5; S.trolley.position.z = reach;
        const drop = busy ? S.craneH * (0.55 + 0.35 * Math.max(0, Math.sin(t * 0.5))) : 3; S.cable.scale.y = drop; S.hook.position.y = -drop; S.load.visible = busy && at('framing'); } }
    // signage: fascia slides up into place, monument rises
    el.fascia.visible = from('signage') && (si > 6 || f > 0.35); el.fascia.position.y = S.fasciaY - (at('signage') ? (1 - sm(clamp((f - 0.35) / 0.4))) * 1.2 : 0); el.fascia.material.emissiveIntensity = night ? 0.9 : 0.15;
    el.mon.visible = from('signage'); el.mon.scale.y = at('signage') ? Math.max(0.02, sm(f)) : 1;
    // landscaping: lawn rolls out, pavers, shrubs (GLB streamed in when this stage begins)
    const ld = at('landscaping') ? f : si > 7 ? 1 : 0; for (const [m, wd] of [[el.lawnL, S.lawnLW], [el.lawnR, S.lawnRW]]) { m.visible = ld > 0; m.scale.set(wd[0], 1, Math.max(0.01, wd[1] * clamp(ld * 1.6))); }
    el.pave.visible = ld > 0.3; el.pave.scale.set(S.paveW[0], 1, S.paveW[1]);
    const url = e.parts?.landscaping; if (url && from('groundwork')) { const p = this.loadPart(S, 'landscaping', url); if (p.inst) for (const m of p.inst) { m.count = Math.round(clamp((ld - 0.3) / 0.65) * S.shrubPts.length); m.instanceMatrix.needsUpdate = true; } }
    for (const [k, u] of Object.entries(e.parts || {})) if (k !== 'landscaping' && from(k)) { const p = this.loadPart(S, k, u); if (p.obj) p.obj.scale.y = at(k) ? Math.max(0.02, sm(f)) : 1; }
    // open: dirt gone, banner for the grand opening, board shows the opening
    el.banner.visible = si >= 8 && (Date.now() - (this.vis.get(e.id).openAt ||= Date.now())) < 15 * 60e3;
    const pct = (si + f) / 8, lotN = 'LOT ' + String(e.lot).padStart(2, '0'), title = (e.public && e.tenant) || 'New shop', CS = ['Staking out the pad', 'Grading the pad', 'Pouring the slab', 'Raising steel', 'Closing in the walls', 'Setting the glass', 'Hanging the signage', 'Planting + paving', 'Open'];
    S.board.grp.visible = si < 8 || el.banner.visible;
    if (near) { const hold = !!e.hold; S.board.draw(title, 'Website → explorable building', hold ? 'Planned · awaiting layout approval' : si >= 8 ? 'Open now' : BL[si], hold ? 0 : Math.min(pct, 1), hold ? 0 : si, 8,
      hold ? 'Survey crew: pad staked · build starts after Joshua approves the town layout' : si >= 8 ? 'Built live in the Elderverse' : 'Live · crew: ' + CS[si] + ' · ' + this.ago(e.since),
      { plaque: lotN, hold, header: e.demo ? 'STAGING DEMO · NOT A REAL LEASE' : 'ELDERVERSE · DISTRICT 1 · CONSTRUCTION', labels: ['Survey', 'Ground', 'Found.', 'Frame', 'Walls', 'Glass', 'Signs', 'Land'] }); }
    // crew
    this.ensureCrew(S, near ? crewN + (si === 3 || si === 4 ? 1 : 0) : 0); const top = sc ? 99 : 0.45 + floorsUp * FH + 0.01, ck = si + ':' + top;
    if (S.ptsK !== ck) { S.ptsK = ck; S.ptsOk = S.pts[si].filter(p => p[1] <= 0.01 || p[1] <= top); if (!S.ptsOk.length) S.ptsOk = S.pts[0].slice(1); S.ptsOk.gen = ck; S.ptsOk.top = top; }   // only levels that exist right now
    const pts = near ? S.ptsOk : []; for (let i = 0; i < S.crew.length; i++) if (i >= (near ? crewN + 1 : 0)) S.crew[i].on = false;
    this.crewStep(S.crew.slice(0, near ? crewN + (si === 3 || si === 4 ? 1 : 0) : 0), pts, dt, S.g.position, S.g.rotation.y);
  },
  reveal(m, n) { const full = m.userData.full, k = Math.min(full.length, Math.ceil(n)); m.count = k; const fr = n - Math.floor(n);
    if (k > 0) { const i = k - 1, M = m.userData._tmp ||= new this.T.Matrix4(); if (fr > 1e-3 && k === Math.ceil(n) && n < full.length) { M.copy(full[i]); const s = 0.05 + 0.95 * sm(fr); M.elements[4] *= s; M.elements[5] *= s; M.elements[6] *= s; m.setMatrixAt(i, M); } else m.setMatrixAt(i, full[i]); if (i > 0) m.setMatrixAt(i - 1, full[i - 1]); }
    m.instanceMatrix.needsUpdate = true; },
  drawRoad(S, si, f, t, near, dt, crewN) {
    const el = S.el, L = S.L, e = S.e, at = k => si === ROAD.indexOf(k), from = k => si >= ROAD.indexOf(k), len = (k) => at(k) ? sm(f) : from(k) && si > ROAD.indexOf(k) ? 1 : 0;
    el.cones.count = at('survey') ? Math.ceil(f * S.coneN) : si < 5 ? S.coneN : 0; el.cones.instanceMatrix.needsUpdate = true;
    const lg = len('grading'), lb = len('base'), lp = len('paving');
    el.grade.visible = lg > 0 && lp < 1; el.grade.scale.x = Math.max(0.001, L * lg); el.base.visible = lb > 0 && lp < 1; el.base.scale.x = Math.max(0.001, L * lb);
    el.fresh.visible = lp > 0; el.fresh.scale.x = Math.max(0.001, L * lp);
    el.grader.visible = at('grading') || at('base'); if (el.grader.visible) { el.grader.position.set(Math.min(L - 1, L * (at('grading') ? lg : lb) + 2.4), 0, -S.w / 4 + Math.sin(t * 0.5) * 0.6); if (near) S.gBoom.rotation.x = -0.3 + Math.sin(t * 1.5) * 0.3; }
    el.paver.visible = at('paving'); if (el.paver.visible) el.paver.position.set(Math.min(L, L * lp) + 1.6, 0, 0);
    el.roller.visible = at('paving') || (at('striping') && f < 0.2); if (el.roller.visible) el.roller.position.set(at('paving') ? Math.max(1.2, L * lp - 5 + Math.sin(t * 0.8) * 2.5) : L - 3, 0, S.w / 5);
    const ds = at('striping') ? f : si > 4 ? 1 : 0; let k = 0; while (k < S.dashN && S.dashX[k] <= L * ds) k++; el.dash.count = k; el.dash.instanceMatrix.needsUpdate = true;
    el.striper.visible = at('striping'); if (el.striper.visible) el.striper.position.set(L * ds + 0.8, 0, 0);
    S.board.grp.visible = si < 5; if (near && si < 5) S.board.draw(e.name.toUpperCase().slice(0, 24), e.demo ? 'Demo job (staging)' : 'Architecture team road job', e.hold ? 'Planned · awaiting layout approval' : (e.resurface ? RLR : RL)[si], e.hold ? 0 : (si + f) / 5, e.hold ? 0 : si, 5, e.hold ? 'Surveyed · paving starts after the layout is approved' : 'Live from the road crew · ' + this.ago(e.since), { plaque: 'ROAD', hold: !!e.hold });
    // crew: stays with the working machine
    const fx = at('paving') ? L * lp : at('striping') ? L * ds : at('grading') ? L * lg : at('base') ? L * lb : L * f, n = near && si < 5 ? Math.min(3, crewN) : 0;
    this.ensureCrew(S, n); const pts = []; if (n) { pts.push([fx - 2, 0, S.w / 2 + 0.8, 'work', -Math.PI / 2], [fx + 3.5, 0, -S.w / 2 - 0.8, 'wave', Math.PI / 2], [Math.max(0, fx - 7), 0, -S.w / 2 + 0.6, 'work']); pts.gen = si * 1000 + Math.floor(fx / 6); }
    for (let i = n; i < S.crew.length; i++) S.crew[i].on = false; this.crewStep(S.crew.slice(0, n), pts, dt, S.g.position, S.g.rotation.y);
  },
  ago(since) { if (!since) return 'live'; const m = Math.round((Date.now() - since) / 60000); return m < 1 ? 'started just now' : m < 60 ? `started ${m} min ago` : `started ${Math.round(m / 60)} h ago`; },

  /* ---------------- stage toasts (small, top-centre, 4 s; screen-reader announced) ---------------- */
  toast(e, si) {
    const where = e.kind === 'road' || e.kind === 'zone' ? e.name : 'Lot ' + String(e.lot).padStart(2, '0') + ((e.public && e.tenant) ? ' · ' + e.tenant : '');
    const what = e.kind === 'zone' ? (si >= 8 ? 'done' : si === 0 ? 'architects surveying' : BL[si] + ' started') : e.kind === 'road' ? (si >= 5 ? 'open to traffic' : (e.resurface ? RLR : RL)[si] + ' started') : si === 0 ? (e.leased === true ? 'leased · surveyors on site' : e.demo ? 'Staging demo' : 'Architects surveying') : si >= 8 ? 'now open' : BL[si] + ' started';   /* 'leased' ONLY for a real tenant lease (Joshua 2026-10-17 00:24) */
    if (e.kind === 'site' && e.hold && si === 0 && !e.leased) return;   /* layout gate: a held survey site is not news */
    const m = where + ': ' + what; this.toastSeen ||= new Set(); if (this.toastSeen.has(m) || this.toastQ.includes(m)) return; this.toastSeen.add(m);   /* never repeat a message */
    this.toastQ.push(m); if (this.toastQ.length > 3) this.toastQ.shift();
  },
  flushToast(dt) {
    if (this.toastEl && (this.toastT -= dt) > 0) return; if (this.toastEl) { this.toastEl.remove(); this.toastEl = null; }
    if (!this.toastQ.length) return; const now = performance.now(); if (this.toastLast && now - this.toastLast < 10000) return; this.toastLast = now;   /* at most 1 toast every 10 s; queued ones are combined */
    const q = this.toastQ.splice(0), m = q.length > 1 ? q[0] + ' (+' + (q.length - 1) + ' more)' : q[0]; const d = document.createElement('div'); d.className = 'office-world-toast'; d.setAttribute('role', 'status'); d.textContent = '🏗 ' + m;
    d.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:8;font:600 14px Inter,system-ui,sans-serif;color:#f3ead7;background:#16141be6;border:1px solid #d9b45a;padding:7px 14px;border-radius:8px;pointer-events:none;white-space:nowrap';
    (this.ctx.root || document.body).append(d); this.toastEl = d; this.toastT = 4; this.ctx.announce?.(m);
  },

  /* ---------------- viewing + staging demo ---------------- */
  watch(id) {
    const S = id ? this.sites.get(id) : [...this.sites.values()].find(s => s.e.kind !== 'road') || [...this.sites.values()][0]; if (!S || !this.ctx.teleport) return false;
    if (S.e.kind === 'road') { const m = S.L / 2, c = Math.cos(S.ang), s = Math.sin(S.ang); const mx = S.g.position.x + m * c, mz = S.g.position.z - m * s; this.ctx.teleport(mx - s * 0 - 0, mz - 22, mx, mz); return true; }
    // from the street, diagonally off the front-left corner (local frame: +z = street), looking at the building
    const lot = S.lot, th = S.g.rotation.y, c = Math.cos(th), sn = Math.sin(th), L2W = (x, z) => [lot.cx + x * c + z * sn, lot.cz - x * sn + z * c];
    const [ex, ez] = L2W(-S.W / 2 - 7, lot.d / 2 + 7), [tx, tz] = L2W(0, S.bz); this.ctx.teleport(ex, ez, tx, tz); return true;
  },
  async demo(o = {}) {
    const town = this.ctx.town, h = (town?.RW || 10) / 2; const r = await fetch('/api/office/world-demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lot: o.lot || 9, secs: o.secs || 240, aveZ: town ? town.AVE : undefined, roadX0: -40, roadX1: 40, road: o.road !== false, clear: !!o.clear }) });
    return r.json();
  },
  setupDemoStand() {
    if (!this.staging) return; const ctx = this.ctx, T = this.T, me = this;
    // a small sign on the main walk by the avenue: "Town builds · watch a demo build" (staging only; production never shows it)
    const place = () => { const town = ctx.town; if (!town) return setTimeout(place, 1000); const X0 = 0, z = town.AVE - town.RW / 2 - 3.5;
      const tex = this.textTex(['WATCH THE TOWN BUILD', 'Staging demo · tap to start'], 768, 200, '#16141b', '#e9dcc0', '#d9b45a');
      const g = new T.Group(); g.position.set(X0 + 4.2, 0, z); g.rotation.y = Math.PI; const post = new T.Mesh(this.res().geo.sign, this.res().mat.vc); g.add(post); me.stand = g;
      const face = new T.Mesh(new T.PlaneGeometry(2.5, 0.65), new T.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, side: T.DoubleSide })); face.position.set(0, 1.75, 0.05); g.add(face); g.userData.keep = 1; g.userData.noFarCull = 1; ctx.scene.add(g);
      const open = () => { const c = ctx.card(`<h3>Watch the town build</h3><p>Staging demo: a test shop leases Lot 09 across the avenue, and the avenue in front of the campus gets resurfaced. Every stage builds live in front of you, with no reload.</p><p><button class="ob gold" data-a="go" type="button">Start demo build (4 min)</button> <button class="ob" data-a="look" type="button">Go watch</button> <button class="ob" data-a="clear" type="button">Clear demo</button></p><p class="wd-msg" style="opacity:.8"></p>`);
        const msg = c.querySelector('.wd-msg'); c.querySelector('[data-a=go]').onclick = async () => { msg.textContent = 'Starting…'; const j = await me.demo({}); msg.textContent = j.ok ? 'Lease signed. Surveyors are heading to Lot 09.' : (j.error || 'Could not start'); if (j.ok) setTimeout(() => { ctx.closeCard(); me.watch('lot:' + j.lot); }, 1200); };
        c.querySelector('[data-a=look]').onclick = () => { ctx.closeCard(); me.watch(); }; c.querySelector('[data-a=clear]').onclick = async () => { const j = await me.demo({ clear: true }); msg.textContent = j.ok ? 'Demo cleared.' : 'Could not clear'; }; };
      ctx.onClick(face, open); ctx.onClick(post, open); };
    place();
  },
};
