// Shared base avatar: one rigged realistic humanoid (Quaternius Universal Animation Library mannequin, CC0) for every
// agent, team-colour clothing tint + Norse name/job tag. Clips are shared; each agent only owns a skeleton + mixer.
// State machine (from the live stage): idle(sit) · walk/run · sit+type · carry folder · inspect · talk (dais) ·
// blocked (waiting) · celebrate. Mobile cost control: mixer updates are culled off-screen and thinned with distance.
// If the GLB can't load, falls back to the capsule body (capsule.js) with the same API.
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { MeshoptDecoder } from '../../vendor/jsm/libs/meshopt_decoder.module.js?v=169';
import * as SkeletonUtils from '../../vendor/jsm/utils/SkeletonUtils.js?v=169';
import { DRACOLoader } from '../../vendor/jsm/loaders/DRACOLoader.js?v=169';
import { KTX2Loader } from '../../vendor/jsm/loaders/KTX2Loader.js?v=169';
import capsule from './capsule.js?v=6';
const CLIP = { idle: 'Sitting_Idle_Loop', type: 'Sitting_Talking_Loop', stand: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', carry: 'Walk_Formal_Loop',
  inspect: 'Interact', talk: 'Idle_Talking_Loop', pickup: 'PickUp_Table', blocked: 'Idle_Loop', cheer: 'Dance_Loop', greet: 'Spell_Simple_Enter' };
const SEATED = new Set(['idle', 'type']);
export default {
  async setup(ctx, cfg) {
    const { THREE, M, mat } = ctx;
    let gltf, humans;
    const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(ctx.renderer));
    try { [gltf, ...humans] = await Promise.all(['agent.glb?v=1', 'human_Male.glb?v=1', 'human_Female.glb?v=1'].map(f => L.loadAsync('/office/modules/base-avatar/assets/' + f))); }
    catch (e) { console.warn('rig load failed, capsule fallback', e); this.fb = capsule; return capsule.setup(ctx, cfg); }
    // clips come from the UAL file; bodies are the clothed Universal Base Characters on the same 65-bone rig (CC0)
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    const bases = humans.map(h => { const b = h.scene; const bb = new THREE.Box3().setFromObject(b); b.userData.k = 1.78 / (bb.max.y - bb.min.y || 1.78);
      b.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } }); return b; });
    const shirtMats = new Map(), hairMats = new Map();
    const shirt = (src, col) => { const k = src.uuid + col; if (!shirtMats.has(k)) { const m = src.clone(); m.color = new THREE.Color(col); shirtMats.set(k, m); } return shirtMats.get(k); };
    const HAIR = [0x2a1a10, 0x4a2e18, 0x111111, 0x7a5a32, 0x9a6a3a, 0x5a2a14];
    const hair = (src, i) => { const k = src.uuid + i; if (!hairMats.has(k)) { const m = src.clone(); m.color = new THREE.Color(HAIR[i]); hairMats.set(k, m); } return hairMats.get(k); };
    const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    const folderGeo = new THREE.BoxGeometry(0.32, 0.24, 0.025), folderMat = M(0xd9b45a);
    const geo = { bar: new THREE.PlaneGeometry(0.9, 0.07), bg: new THREE.PlaneGeometry(0.94, 0.11), flag: new THREE.OctahedronGeometry(0.12) };
    const red = new THREE.MeshBasicMaterial({ color: 0xff4a4a }), barBg = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .6 });
    const agents = new Map(), all = new Set();
    function make(a, col, onPick) {
      const h = hash(a.id || a.name), base = bases[a.female ?? (h & 1)] || bases[0], scale = base.userData.k;
      const g = new THREE.Group(), body = SkeletonUtils.clone(base); body.scale.setScalar(scale); body.rotation.y = Math.PI; g.add(body);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.9; g.add(hit);
      body.traverse(o => { if (!o.isMesh) return; const n = o.material?.name || '';
        if (n === 'Shirt') o.material = shirt(o.material, col); else if (/hair/i.test(n)) o.material = hair(o.material, (h >> 3) % HAIR.length); });
      let hand = null, mid = null; body.traverse(o => { if (o.isBone && /^hand_r$/i.test(o.name)) hand = o; if (o.isBone && /^middle_01_r$/i.test(o.name)) mid = o; });
      const folder = new THREE.Mesh(folderGeo, folderMat); folder.visible = false;
      if (hand) { // seat the folder in the palm: halfway to the finger root, long side along the hand, scale undone
        hand.add(folder); body.updateMatrixWorld(true); const ws = new THREE.Vector3(); hand.getWorldScale(ws); folder.scale.setScalar(1 / ws.x);
        const dir = mid ? mid.position.clone() : new THREE.Vector3(0, 0.08 * scale, 0); folder.position.copy(dir).multiplyScalar(0.9);
        folder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize()); }
      const tag = ctx.label(a.name, a.role); tag.position.y = 2.05; tag.material.transparent = true; tag.material.depthTest = true; tag.visible = false; g.add(tag);
      const bar = new THREE.Mesh(geo.bar, mat.glow); bar.position.y = 2.36; bar.visible = false; g.add(bar);
      const bg = new THREE.Mesh(geo.bg, barBg); bg.position.set(0, 2.36, -0.01); bg.visible = false; g.add(bg);
      const flag = new THREE.Mesh(geo.flag, red); flag.position.y = 2.62; flag.visible = false; g.add(flag);
      const mixer = new THREE.AnimationMixer(body), actions = {};
      const act = k => actions[k] ||= mixer.clipAction(clips[CLIP[k]] || clips.Idle_Loop);
      g.userData = { a, body, tag, bar, bg, flag, folder, mixer, act, cur: null, state: {}, target: null, home: null, phase: Math.random() * 6, pose: null, acc: 0, frame: 0 };
      play(g, 'idle', 0); ctx.onClick(hit, () => { ctx.revealTag(g); onPick && onPick(); });
      all.add(g); if (a.id) agents.set(a.id, g); return g;
    }
    function play(g, k, fade = 0.3) {
      const u = g.userData; if (u.cur === k) return; const next = u.act(k); next.reset().play();
      next.timeScale = k === 'blocked' ? 0.45 : 1; if (k === 'pickup' || k === 'greet') { next.setLoop(THREE.LoopRepeat, Infinity); }
      if (u.cur) u.act(u.cur).crossFadeTo(next, fade, false); else next.time = u.phase; u.cur = k;
      u.body.position.y = SEATED.has(k) ? 0.0 : 0; u.folder.visible = k === 'carry' || k === 'pickup';
    }
    const tmp = new THREE.Vector3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 1.2);
    function animate(av, dt) {
      const u = av.userData, s = u.state || {}; let moving = false, dist = 0;
      if (u.target) { tmp.set(u.target.x - av.position.x, 0, u.target.z - av.position.z); dist = tmp.length();
        if (dist > 0.08) { moving = true; tmp.normalize(); const sp = dist > 4 ? 2.6 : 1.3; av.position.addScaledVector(tmp, Math.min(dist, dt * sp)); av.rotation.y = Math.atan2(tmp.x, tmp.z); }
        else if (u.home && u.target.equals(u.home)) av.rotation.y = u.homeRot ?? Math.PI; }
      const carrying = ['QA', 'ready', 'review'].includes(s.stage);
      let k;
      if (moving) k = carrying ? 'carry' : dist > 4 ? 'run' : 'walk';
      else if (u.pose === 'wave') k = u.talking ? 'talk' : (Math.sin(performance.now() / 4000 + u.phase) > 0.75 ? 'greet' : 'stand');
      else if (u.pose === 'host') k = u.greeting ? 'greet' : u.talking ? 'talk' : 'stand';
      else if (u.pose === 'talk') k = 'talk';
      else if (s.blocked) k = 'blocked';
      else if (s.stage === 'QA') k = 'inspect';
      else if (s.stage === 'review') k = 'talk';
      else if (s.stage === 'ready') k = 'pickup';
      else if (s.stage === 'released') k = 'cheer';
      else if (['plan', 'build', 'self-check'].includes(s.stage)) k = 'type';
      else k = u.home ? (u.team ? 'idle' : 'stand') : 'stand';
      if (!u.team && k === 'idle') k = 'stand';
      play(av, k);
      // culling + distance LOD for the skeleton update
      sph.center.copy(av.position).setY(0.9); const d = sph.center.distanceTo(ctx.cam.position); u.acc += dt; u.frame++;
      const visible = frustum.intersectsSphere(sph) && d < 40, every = d < 12 ? 1 : d < 22 ? 2 : 4;
      if (visible && u.frame % every === 0) { u.mixer.update(u.acc); u.acc = 0; }
      const p = s.progress; u.bar.visible = u.bg.visible = visible && p != null && !!s.stage;
      if (u.bar.visible) { u.bar.scale.x = Math.max(0.02, p); u.bar.position.x = -0.45 * (1 - p); u.bar.quaternion.copy(ctx.cam.quaternion); u.bg.quaternion.copy(ctx.cam.quaternion); }
      u.tagD = visible ? d : Infinity;
      u.flag.visible = !!s.blocked; if (s.blocked) u.flag.rotation.y += dt * 2;
      if (u.monitor) u.monitor.material = s.stage ? mat.glow : mat.dark;
    }
    this.pre = () => { ctx.cam.updateMatrixWorld(); pm.multiplyMatrices(ctx.cam.projectionMatrix, ctx.cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm); };
    ctx.provide('avatar', { make, animate, all, rigged: true }); ctx.provide('agents', agents);
    // name tags: only within ~6 m (or briefly after a tap), fade with distance, nearest first, no screen overlap
    const NEAR = 6, shown = [], pv = new THREE.Vector3(), cam = ctx.cam;
    ctx.revealTag = g => { g.userData.reveal = performance.now() + 4000; };
    this._tags = () => { const now = performance.now(), cand = [];
      for (const av of all) { const u = av.userData; if (!u.tag) continue; const near = u.tagD < NEAR, rev = (u.reveal || 0) > now && u.tagD < 30;
        if (near || rev) cand.push(av); else u.tag.visible = false; }
      cand.sort((x, y) => x.userData.tagD - y.userData.tagD); shown.length = 0; const H = innerHeight, W = innerWidth;
      for (const av of cand) { const u = av.userData; u.tag.getWorldPosition(pv); pv.project(cam);
        const sx = (pv.x + 1) * W / 2, sy = (1 - pv.y) * H / 2, k = 1 / Math.max(u.tagD, 1), w = Math.min(260, 520 * k * (H / 800)) , hh = w / 4;
        const r = { x0: sx - w / 2, x1: sx + w / 2, y0: sy - hh / 2, y1: sy + hh / 2 };
        if (pv.z > 1 || shown.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0) || shown.length >= 4) { u.tag.visible = false; continue; }
        shown.push(r); u.tag.visible = true; const f = (u.reveal || 0) > now ? 1 : Math.min(1, (NEAR - u.tagD) / 1.5); u.tag.material.opacity = Math.max(0.15, f);
        const sc = Math.min(1, 0.55 + u.tagD * 0.06); u.tag.scale.set(1.3 * sc, 0.325 * sc, 1); } };
    this._all = all; this._animate = animate;
  },
  onFrame(dt, t) { if (this.fb) return this.fb.onFrame(dt, t); this.pre(); for (const av of this._all) this._animate(av, dt); this._tags(); },
};
