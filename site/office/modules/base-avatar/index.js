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
import { pose, bonesOf } from './poses.js?v=1';
import capsule from './capsule.js?v=6';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
const CLIP = { idle: 'Sitting_Idle_Loop', type: 'Sitting_Idle_Loop', stand: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', carry: 'Walk_Carry_Loop',
  inspect: 'Interact', talk: 'Idle_Talking_Loop', pickup: 'PickUp_Table', blocked: 'Idle_FoldArms_Loop', cheer: 'Dance_Loop', greet: 'Idle_Loop', phone: 'Idle_TalkingPhone_Loop', nod: 'Yes' };
// authored ground speed of the locomotion clips (m/s, from the root-motion versions) so feet don't slide
const SPEED = { walk: 0.975, carry: 0.65, run: 5.36 };
const LAYER = { type: 'type', greet: 'wave' };   // NOTE: with the v3 packs the clips themselves type/wave; layers are skipped when packs load   // procedural arm layers (poses.js) on top of the base clip
const SEATED = new Set(['idle', 'type']);
export default {
  async setup(ctx, cfg) {
    const { THREE, M, mat } = ctx;
    let gltf, humans;
    const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(ctx.renderer));
    let packs; const AN = '/office/assets/anims/', PK = ['locomotion', 'desk', 'social', 'social2'];
    try { [gltf, ...humans] = await Promise.all(['anims.glb?v=1', 'human_Male.glb?v=1', 'human_Female.glb?v=1'].map(f => L.loadAsync('/office/modules/base-avatar/assets/' + f)));
      /* PR #6 v3 library: retargeted onto our skeleton, separate female bakes (_f), shirt-fixed v2 bodies. Old file stays as fallback. */
      try { const v2 = await Promise.all(['human_Male_v2.glb', 'human_Female_v2.glb'].map(f => L.loadAsync(AN + f + '?v=3'))); humans = v2;
        packs = await Promise.all([...PK.map(p => L.loadAsync(AN + p + '.glb?v=3')), ...PK.map(p => L.loadAsync(AN + p + '_f.glb?v=3'))]); } catch (e) { console.warn('anim v3 packs failed, using v1 clips', e); packs = null; } }
    catch (e) { console.warn('rig load failed, capsule fallback', e); this.fb = capsule; return capsule.setup(ctx, cfg); }
    // clips come from the UAL file; bodies are the clothed Universal Base Characters on the same 65-bone rig (CC0)
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    const clipsF = { ...clips }; if (packs) { packs.slice(0, PK.length).forEach(g => g.animations.forEach(c => { clips[c.name] = c; })); packs.slice(PK.length).forEach(g => g.animations.forEach(c => { clipsF[c.name] = c; })); }
    if (packs) { SEATED.add('blocked'); SEATED.add('phone'); }
    if (packs) Object.assign(CLIP, { idle: 'Sit_ReadMonitor_Loop', type: 'Sit_Type_Loop', stand: 'Idle', walk: 'Walk', run: 'Jog', carry: 'Walk_Carry', inspect: 'Interact', talk: 'Talk', pickup: 'PickUp_Table', blocked: 'Sit_LeanBack_Loop', cheer: 'Dance', greet: 'Wave', phone: 'Sit_Phone_Loop', nod: 'Yes', host: 'Freyja_Desk_Idle' });
    const bases = humans.map(h => { const b = h.scene; const bb = new THREE.Box3(); b.updateMatrixWorld(true); b.traverse(o => { if (o.isSkinnedMesh) bb.expandByObject(o); }); const hh = bb.isEmpty() ? 0 : bb.max.y - bb.min.y; b.userData.k = 1; b.userData.h = hh;   /* GLBs are authored at real scale; the old bbox included a hidden 2 m sphere and shrank everyone to ~89% (hands missed props) */
      b.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } }); return b; });
    let _skin = null; const skinMat = () => _skin ||= new THREE.MeshLambertMaterial({ vertexColors: true });
    const shirtMats = new Map(), hairMats = new Map();
    const shirt = (src, col) => { const k = src.uuid + col; if (!shirtMats.has(k)) { const m = src.clone(); m.color = new THREE.Color(col); shirtMats.set(k, m); } return shirtMats.get(k); };
    const HAIR = [0x2a1a10, 0x4a2e18, 0x111111, 0x7a5a32, 0xb08a5a, 0x5a2a14, 0x8a8a88];          // dark brown, brown, black, light brown, dark blonde, auburn, grey
    const SKIN = [0xf1d3bd, 0xe0b897, 0xc99a74, 0xa8774f, 0x80583a, 0x5c3d28];                     // six realistic tones
    const HEIGHT = [0.97, 0.985, 1, 1.015, 1.03], BUILD = [0.95, 1, 1.05], CHEST = [0.94, 1, 1.06], PANTS = [0x2b2f38, 0x3b3226, 0x1d2433, 0x4a4a4a];
    const FEMALE = /^(Freyja|Frigg|Eir|Hlín|Iðunn|Saga|Skaði|Fulla|Vár|Gefjon|Gná|Var|Syn|Hnoss|Snotra|Rán|Vor|Lofn|Norns)$/; const sexCount = [];
    const hair = (src, i) => { const k = src.uuid + i; if (!hairMats.has(k)) { const m = src.clone(); m.color = new THREE.Color(HAIR[i]); hairMats.set(k, m); } return hairMats.get(k); };
    const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    const folderGeo = new THREE.BoxGeometry(0.32, 0.24, 0.025), folderMat = M(0xd9b45a);
    const geo = { bar: new THREE.PlaneGeometry(0.9, 0.07), bg: new THREE.PlaneGeometry(0.94, 0.11), flag: new THREE.OctahedronGeometry(0.12) };
    const red = new THREE.MeshBasicMaterial({ color: 0xff4a4a }), barBg = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .6 });
    const agents = new Map(), all = new Set();
    function make(a, col, onPick) {
      const h = hash(a.id || a.name), fem = a.female ?? (FEMALE.test(a.name || '') ? 1 : 0), base = bases[fem] || bases[0];
      /* distinct look per agent: a unique (skin, hair colour) pair inside each body type, plus height, build, chest and trousers.
         Realistic ranges only; height stays within +-3% so hands still land within the 5 cm contact gate. */
      const k = (sexCount[fem] = (sexCount[fem] ?? -1) + 1), look = { skin: k % SKIN.length, hair: (Math.floor(k / SKIN.length) + k) % HAIR.length, height: HEIGHT[(k * 2 + fem) % HEIGHT.length], build: BUILD[(k * 7 + 1) % BUILD.length], chest: CHEST[(k * 5 + fem) % CHEST.length], pants: PANTS[(k * 3) % PANTS.length] };
      const scale = base.userData.k * look.height;
      const g = new THREE.Group(), body = SkeletonUtils.clone(base); body.scale.setScalar(scale); body.rotation.y = 0; body.userData.cloneOf = a.id || a.name; g.add(body);   // UBC humans face +z = the group's forward
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.9; g.add(hit);
      body.traverse(o => { if (!o.isMesh) return; const n = o.material?.name || '';
        if (n === 'Shirt') o.material = shirt(o.material, col); else if (/hair|eyebrow/i.test(n)) o.material = hair(o.material, look.hair);
        else if (/superhero|skin|body/i.test(n)) { o.material = o.material.clone(); o.material.color = new THREE.Color(SKIN[look.skin]); }
        else if (n === 'Pants') { o.material = o.material.clone(); o.material.color = new THREE.Color(look.pants); } });
      { const B = {}; body.traverse(o => { if (o.isBone) B[o.name] = o; });                       /* build + chest via spine scale, children compensated so arms/neck keep length */
        const sc = (b, v) => { if (!b) return; b.scale.multiply(v); for (const c of b.children) if (c.isBone) c.scale.divide(v); };
        sc(B.spine_02, new THREE.Vector3(look.build, 1, look.build)); sc(B.spine_03, new THREE.Vector3(1, 1, look.chest)); }
      /* one draw call per agent: merge the untextured skinned parts (same skin) into a single vertex-coloured SkinnedMesh */
      { const parts = []; body.traverse(o => { if (o.isSkinnedMesh && !Array.isArray(o.material) && !o.material.map && !o.material.transparent) parts.push(o); });
        if (parts.length > 1 && parts.every(p => p.skeleton.bones.length === parts[0].skeleton.bones.length && p.skeleton.bones.every((b, i) => b === parts[0].skeleton.bones[i]))) {
          const geos = parts.map(p => { let g = p.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k); for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];   /* keep indices: skinning cost scales with vertex count */
            const n = g.attributes.position.count, c = new Float32Array(n * 3), col = p.material.color; for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; });
          const mg = mergeGeometries(geos, false);
          if (mg) { const m0 = parts[0], sm = new THREE.SkinnedMesh(mg, skinMat()); sm.frustumCulled = false; m0.parent.add(sm); sm.position.copy(m0.position); sm.quaternion.copy(m0.quaternion); sm.scale.copy(m0.scale); sm.bind(m0.skeleton, m0.bindMatrix); parts.forEach(p => p.parent.remove(p)); } } }
      let hand = null, mid = null; body.traverse(o => { if (o.isBone && /^hand_r$/i.test(o.name)) hand = o; if (o.isBone && /^middle_01_r$/i.test(o.name)) mid = o; });
      const folder = new THREE.Mesh(folderGeo, folderMat); folder.visible = false;
      if (hand) { // seat the folder in the palm: halfway to the finger root, long side along the hand, scale undone
        hand.add(folder); body.updateMatrixWorld(true); const ws = new THREE.Vector3(); hand.getWorldScale(ws); folder.scale.setScalar(1 / ws.x);
        const dir = mid ? mid.position.clone() : new THREE.Vector3(0, 0.08 * scale, 0); folder.position.copy(dir).multiplyScalar(0.9);
        folder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize()); }
      const tag = ctx.publicMode && a.id !== 'receptionist' ? ctx.label(a.role ? a.role[0].toUpperCase() + a.role.slice(1) : 'Team', '') : ctx.label(a.name, a.role);   /* public: roles only; Freyja is the only named character */ tag.position.y = 2.05; tag.material.transparent = true; tag.material.depthTest = true; tag.visible = false; g.add(tag);
      const bar = new THREE.Mesh(geo.bar, mat.glow); bar.position.y = 2.36; bar.visible = false; g.add(bar);
      const bg = new THREE.Mesh(geo.bg, barBg); bg.position.set(0, 2.36, -0.01); bg.visible = false; g.add(bg);
      const flag = new THREE.Mesh(geo.flag, red); flag.position.y = 2.62; flag.visible = false; g.add(flag);
      const mixer = new THREE.AnimationMixer(body), actions = {};
      const C = base === bases[1] ? clipsF : clips; const act = k => actions[k] ||= mixer.clipAction(C[CLIP[k]] || C[CLIP.stand] || C.Idle_Loop);
      g.userData = { a, look, body, tag, bones: bonesOf(body), lw: 0, layer: null, bar, bg, flag, folder, mixer, act, cur: null, state: {}, target: null, home: null, phase: Math.random() * 6, pose: null, acc: 0, frame: 0 };
      play(g, 'idle', 0); mixer.update(0.05); g.userData.posed = true; /* never show a bind/T-pose: pose the rig before its first frame */ ctx.onClick(hit, () => { ctx.revealTag(g); onPick && onPick(); });
      all.add(g); if (a.id) agents.set(a.id, g); return g;
    }
    function play(g, k, fade = 0.3) {
      const u = g.userData; if (u.cur === k) return; const next = u.act(k); next.reset().play();
      next.timeScale = 1; if (k === 'pickup') next.setLoop(THREE.LoopRepeat, Infinity);
      if (u.cur) u.act(u.cur).crossFadeTo(next, fade, false); else next.time = u.phase; u.cur = k;
      u.body.position.y = 0; u.body.position.z = SEATED.has(k) ? 0.25 : 0; /* the sitting clip puts the pelvis 0.33 m behind the root: pull it forward onto the seat centre */ u.folder.visible = k === 'carry' || k === 'pickup';
    }
    const tmp = new THREE.Vector3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 1.2);
    function animate(av, dt) {
      const u = av.userData, s = u.state || {}; let moving = false, dist = 0;
      if (u.target) { tmp.set(u.target.x - av.position.x, 0, u.target.z - av.position.z); dist = tmp.length();
        if (dist > 0.08) { moving = true; tmp.normalize(); const carryNow = ['QA', 'ready', 'review'].includes(s.stage), sp = carryNow ? 0.9 : dist > 4 ? 3.2 : 1.3; u.speed = sp; av.position.addScaledVector(tmp, Math.min(dist, dt * sp)); av.rotation.y = Math.atan2(tmp.x, tmp.z); }
        }
      if (!moving && u.home && Math.hypot(av.position.x - u.home.x, av.position.z - u.home.z) < 0.1) av.rotation.y = u.homeRot ?? Math.PI;   /* at the own desk: always face the monitor */
      const carrying = ['QA', 'ready', 'review'].includes(s.stage);
      let k;
      if (moving) k = carrying ? 'carry' : dist > 4 ? 'run' : 'walk';
      else if (u.pose === 'wave') k = u.talking ? 'talk' : (Math.sin(performance.now() / 4000 + u.phase) > 0.75 ? 'greet' : 'stand');
      else if (u.pose === 'host') k = u.greeting ? 'greet' : (u.talking || u.speaking) ? 'talk' : (packs ? 'host' : 'stand');
      else if (u.pose === 'talk') k = 'talk';
      else if (u.team && u.home && s.stage && s.stage !== 'released' && Math.hypot(av.position.x - u.home.x, av.position.z - u.home.z) < 0.2) k = 'type';   /* active work = seated at the own desk, typing */
      else if (s.blocked && !(u.team && u.home)) k = 'blocked';   /* team agents stay seated at their desk when blocked */
      else if (s.stage === 'QA') { k = 'type'; if (u.target) av.rotation.y = Math.PI; }   /* seated at the QA station, facing its monitor */
      else if (s.stage === 'review') k = 'talk';
      else if (s.stage === 'ready') k = 'pickup';
      else if (s.stage === 'released') k = 'cheer';
      else if (['plan', 'build', 'self-check'].includes(s.stage)) k = 'type';
      else k = u.home ? (u.team ? 'idle' : 'stand') : 'stand';
      if (!u.team && k === 'idle') k = 'stand';
      play(av, k); if (SPEED[k] && u.speed) u.act(k).timeScale = u.speed / SPEED[k];
      const lay = packs ? null : (LAYER[k] || null); if (lay) u.layer = lay; u.lw += ((lay ? 1 : 0) - u.lw) * Math.min(1, dt * 5);
      // culling + distance LOD for the skeleton update
      sph.center.copy(av.position).setY(0.9); const d = sph.center.distanceTo(ctx.cam.position); u.acc += dt; u.frame++;
      const L = ctx.lod || 1, visible = d < 16 * L && frustum.intersectsSphere(sph), every = d < 8 * L ? 1 : d < 14 * L ? 2 : 6;   // far agents: hidden; mid: thinned updates
      av.visible = d < 15 * Math.max(0.8, L) && frustum.intersectsSphere(sph);
      if (!visible && u.frame % 90 === 0) { u.mixer.update(u.acc); u.acc = 0; }   // off-screen rigs still get a rare update so a state change never reveals a bind pose
      if (visible && u.frame % every === 0) { u.mixer.update(u.acc); u.acc = 0; if (u.layer && u.lw > 0.01 && d < 14) { u.lt = (u.lt || 0) + dt * every; av.updateMatrixWorld(true); pose(u.bones, u.layer, u.lt + u.phase, u.lw, av); } }
      const p = s.progress; u.bar.visible = u.bg.visible = visible && p != null && !!s.stage;
      if (u.bar.visible) { u.bar.scale.x = Math.max(0.02, p); u.bar.position.x = -0.45 * (1 - p); u.bar.quaternion.copy(ctx.cam.quaternion); u.bg.quaternion.copy(ctx.cam.quaternion); }
      u.tagD = visible ? d : Infinity;
      u.flag.visible = false; if (s.blocked) u.flag.rotation.y += dt * 2;
      
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
