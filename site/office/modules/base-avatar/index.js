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
/* v3 packs (measured 2026-10-16 from planted-foot velocity on our own bodies at scale 1): Walk_Loop 1.293 m/s male /
   1.237 female, Walk_Carry_Loop 0.862 / 0.825. Agents move at exactly the clip's ground speed x their height scale, so
   the planted foot stays put (the old map asked for 'Walk'/'Jog'/'Idle'/'Talk', names that don't exist in the v3 packs,
   so every mover fell back to the standing idle and slid). Indoors nobody jogs. */
const SPEED3 = [{ walk: 1.293, carry: 0.862 }, { walk: 1.237, carry: 0.825 }];
const SEAT_CLIPS = new Set(['read', 'idle', 'type', 'blocked', 'phone', 'sitIn', 'sitOut', 'stretch', 'coffee', 'think', 'chat', 'write', 'mouse']);
const LAYER = { type: 'type', greet: 'wave' };   // NOTE: with the v3 packs the clips themselves type/wave; layers are skipped when packs load   // procedural arm layers (poses.js) on top of the base clip
const SEATED = new Set(['idle', 'type']);
/* Role-appropriate desk work (Joshua 2026-10-16: non-coders shouldn't type code). Coders/writers type; artists, store and QA work the mouse
   and read the screen; money/compliance/research read and write notes; client care and call-centre agents take calls. Each agent cycles
   its role's clips slowly (phase-offset), so a room never moves in lockstep. Without the v3 desk pack every role falls back to 'type'. */
const ROLE_WORK = [
  [/^(coder|game-coder|devlog|docs|social|jacob-seo|kiosk-polish|client-sites|client-fast|heal|prevent|bugs)/, ['type', 'type', 'read']],
  [/^(assets|animation|anim-polish|design)/, ['mouse', 'mouse', 'read']],
  [/^(store|store-pages|qa|reviews|pipeline-audit)/, ['mouse', 'read', 'mouse']],
  [/^(cfo|bookkeeper|finance|compliance|lead-money|stats|research|prospects|casestudy)/, ['read', 'write', 'mouse']],
  [/^(client-care|follow-?up|callcenter|lead-callcenter|community|games-community|inbox|support|elderai-onboarding)/, ['phone', 'mouse', 'read']],
  [/^(guard|watchdog|lead-|subceo)/, ['read', 'mouse', 'read']],
];
function workClip(u) {
  const id = u.a?.id || '', set = (ROLE_WORK.find(([re]) => re.test(id)) || [0, ['type', 'read']])[1];
  return set[Math.floor(performance.now() / 1000 / 24 + u.phase) % set.length];
}
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
    if (packs) Object.assign(CLIP, { idle: 'Sit_ReadMonitor_Loop', type: 'Sit_Type_Loop', mouse: 'Sit_Mouse_Loop', stand: 'Idle_Loop', walk: 'Walk_Loop', run: 'Walk_Loop', carry: 'Walk_Carry_Loop', inspect: 'Interact', talk: 'Idle_Talking_Loop', pickup: 'PickUp_Table',
      blocked: 'Sit_LeanBack_Loop', cheer: 'Dance_Loop', greet: 'Wave', phone: 'Sit_Phone_Loop', nod: 'Yes', host: 'Freyja_Desk_Idle', sitIn: 'Sitting_Enter', sitOut: 'Sitting_Exit', blockedStand: 'Idle_FoldArms_Loop', phoneStand: 'Idle_TalkingPhone_Loop',
      /* life moments (Joshua 2026-10-16), all CC0 Quaternius-derived clips already retargeted to our rigs (assets/anims) */
      stretch: 'Sit_Stretch', coffee: 'Sit_Coffee', think: 'Sit_LeanBack_Loop', chat: 'Sitting_Talking_Loop', write: 'Sit_Write_Loop', present: 'Present_Loop', point: 'Point_Fwd', wave: 'Wave', read: 'Sit_ReadMonitor_Loop' });
    for (const k of Object.keys(CLIP)) if (!clips[CLIP[k]]) console.warn('base-avatar: missing clip', k, CLIP[k]);
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
      g.userData = { a, fem, look, body, tag, bones: bonesOf(body), lw: 0, layer: null, bar, bg, flag, folder, mixer, act, cur: null, state: {}, target: null, home: null, phase: Math.random() * 6, pose: null, acc: 0, frame: 0 };
      play(g, 'stand', 0); mixer.update(0.05); g.userData.posed = true; /* never show a bind/T-pose: pose the rig before its first frame */ ctx.onClick(hit, () => { ctx.revealTag(g); onPick && onPick(); });
      all.add(g); if (a.id) agents.set(a.id, g); return g;
    }
    const ONCE = new Set(['sitIn', 'sitOut', 'stretch', 'coffee', 'wave', 'point', 'nod']);
    function play(g, k, fade = 0.3) {
      const u = g.userData; if (u.cur === k) return; const next = u.act(k); next.reset().play();
      next.timeScale = 1; if (k === 'pickup') next.setLoop(THREE.LoopRepeat, Infinity);
      if (ONCE.has(k)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; } else next.setLoop(THREE.LoopRepeat, Infinity);
      if (u.cur) u.act(u.cur).crossFadeTo(next, fade, false); else if (!ONCE.has(k) && next.getClip()) next.time = u.phase % (next.getClip().duration || 1); u.cur = k;
      u.folder.visible = k === 'carry' || k === 'pickup';
    }
    const dur = (u, k) => u.act(k).getClip().duration || 1;
    const tmp = new THREE.Vector3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 1.2);
    const CH = ctx.kit.chairs ? ctx.kit.chairs(ctx) : null, OFF = { tucked: 0.087, sat: 0.337, out: 0.48 }; this.CH = CH;
    const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const ease = a => a * a * (3 - 2 * a);
    const ACTIVE = new Set(['plan', 'build', 'self-check', 'QA']);
    /* Seat state machine (2026-10-16). Phases: stand -> sitIn (Sitting_Enter, chair rolls under) -> tuck (agent + chair
       scoot to the desk) -> seated (type / read / life moments) -> untuck -> sitOut (Sitting_Exit, chair pushed back) -> stand.
       A seated clip is only ever played in a seated phase, i.e. on a reserved chair at its desk. */
    const SIT_BODY_DY = -0.025;
    function setPh(u, m) { u.ph.m = m; u.ph.t = 0; }
    function seatedClip(u, s, t) {
      if (s.blocked) return 'blocked';
      const working = !!(s.stage && ACTIVE.has(s.stage)), L = u.life ||= { k: null, until: 0, next: t + 6 + Math.random() * 30 };
      if (t < L.until && L.k) return L.k;
      /* life moments: random but believable, one every ~20-60 s, never the same twice in a row, only while seated */
      if (t > L.next) { const pool = working ? ['stretch', 'coffee', 'think', 'mouse', 'write'] : ['coffee', 'think', 'stretch', 'chat', 'phone', 'mouse'];
        let k = pool[Math.floor(Math.random() * pool.length)]; if (k === L.k) k = pool[(pool.indexOf(k) + 1) % pool.length];
        if (k === 'chat') { const me = u.seat, nb = me && CH.seats.find(o => o !== me && o.holder && Math.abs(o.root.z - me.root.z) < 0.2 && Math.abs(o.root.x - me.root.x) < 2.2 && o.holder.userData.ph?.m === 'seated' && !(o.holder.userData.life?.until > t));
          if (!nb) k = 'think'; else { const v = nb.holder.userData, len = 6 + Math.random() * 4, dir = Math.sign(Math.cos(me.rot) * (nb.root.x - me.root.x) - Math.sin(me.rot) * (nb.root.z - me.root.z));
            u.chatDir = dir; v.chatDir = -dir; v.life = { k: 'chat', until: t + len, next: t + len + 20 + Math.random() * 30 }; L.k = 'chat'; L.until = t + len; L.next = L.until + 20 + Math.random() * 30; return 'chat'; } }
        const len = ONCE.has(k) ? dur(u, k) : 4 + Math.random() * 5; L.k = k; L.until = t + len; L.next = L.until + (working ? 25 : 14) + Math.random() * 35; return k; }
      return working ? (packs ? workClip(u) : 'type') : 'idle';   /* role-appropriate desk work (bd162be) */
    }
    function routed(av) {   /* expand each leg with the room's walking route (around desks, through doorways) */
      const u = av.userData, R = ctx.use('route'); if (!R) return; const out = []; let from = av.position;
      for (const p of u.path) { for (const q of R(from, p)) out.push(q); out.push(p); from = p; } u.path = out;
    }
    function buildPath(av) { buildPath0(av); routed(av); }
    function buildPath0(av) {
      const u = av.userData, T = u.target; u.path = []; u.goalSeat = null; u.faceRot = T?.rot ?? null;
      if (!T) return; const last = u.lastSeat;
      const seat = CH && CH.at(T); if (seat && CH.reserve(seat, av)) u.goalSeat = seat;
      if (last && last !== seat && Math.hypot(av.position.x - last.root.x, av.position.z - last.root.z) < 0.4) u.path.push(last.aislePt);   /* leave a desk the way you came: back out past the chair first */
      if (seat && !u.goalSeat) { u.path.push(seat.aislePt); return; }   /* someone else holds that chair: wait in the aisle, never share */
      if (u.goalSeat) { u.path.push(seat.aislePt, seat.root); return; }
      u.path.push(T);
    }
    function animate(av, dt) {
      const u = av.userData, s = u.state || {}, t = performance.now() / 1000; let moving = false, sp = 0;
      u.ph ||= { m: 'stand', t: 0 }; const ph = u.ph; ph.t += dt;
      if (u.target !== u._tgt) { u._tgt = u.target; const same = u.seat && ph.m !== 'stand' && CH && u.target && CH.at(u.target) === u.seat; if (same) { u.goalSeat = u.seat; u.repath = false; u.path = []; } else if (ph.m === 'stand') buildPath(av); else u.repath = true; }   /* sent to the chair they already sit on: stay seated (was a stand-up/sit-down loop at load) */
      /* first frame: agents that start on their own chair are seated already (no pop) */
      if (!u._init && u.home) { u._init = 1; const st = CH && CH.at(u.home); if (st && u.team && Math.hypot(av.position.x - st.root.x, av.position.z - st.root.z) < 0.05 && CH.reserve(st, av)) { u.seat = u.lastSeat = st; u.goalSeat = st; u.path = []; setPh(u, 'seated'); u.off = 0.25; st.c.off = OFF.tucked; play(av, 'idle', 0); u.mixer.update(0.05); } }   /* wait for a home (floor modules set it after the avatar exists); start in the seated pose, no fade from standing */
      const seat = u.seat; let k = 'stand';
      if (ph.m !== 'stand' && seat) {
        const stay = u.goalSeat === seat && !u.repath; const c = seat.c; av.position.set(seat.root.x, 0, seat.root.z); av.rotation.y = seat.rot;
        if (ph.m === 'sitIn') { k = 'sitIn'; c.drive = false; c.tOff = OFF.sat; c.tSw = 0; u.off = 0; u.sitA = Math.min(1, ph.t / dur(u, 'sitIn'));
          if (ph.t >= dur(u, 'sitIn') - 0.05) setPh(u, 'tuck'); }
        else if (ph.m === 'tuck') { const a = ease(Math.min(1, ph.t / 0.7)); c.drive = true; c.off = OFF.sat + (OFF.tucked - OFF.sat) * a; c.sw = 0; u.off = 0.25 * a; u.sitA = 1; k = seatedClip(u, s, t); if (a >= 1) { c.drive = false; c.tOff = c.off; setPh(u, 'seated'); } }
        else if (ph.m === 'seated') { c.drive = false; c.tOff = OFF.tucked; u.off = 0.25; u.sitA = 1; k = seatedClip(u, s, t);
          /* chatting with the neighbour: agent and chair swivel together about the chair centre (hips stay on the seat) */
          const want = k === 'chat' ? (u.chatDir || 0) * 0.55 : 0; u.chatYaw = (u.chatYaw || 0) + Math.sign(want - (u.chatYaw || 0)) * Math.min(Math.abs(want - (u.chatYaw || 0)), dt * 1.4);
          c.tSw = u.chatYaw; c.sw = u.chatYaw;
          if (u.chatYaw) { const fx = Math.sin(seat.rot), fz = Math.cos(seat.rot), cx = seat.root.x - fx * OFF.tucked, cz = seat.root.z - fz * OFF.tucked, rx = seat.root.x - cx, rz = seat.root.z - cz, cs = Math.cos(u.chatYaw), sn = Math.sin(u.chatYaw);
            av.position.set(cx + rx * cs + rz * sn, 0, cz - rx * sn + rz * cs); av.rotation.y = seat.rot + u.chatYaw; }
          if (!stay && Math.abs(u.chatYaw) < 0.01) { u.life = null; u.chatYaw = 0; setPh(u, 'untuck'); } else if (!stay) u.life = null; }
        else if (ph.m === 'untuck') { const a = ease(Math.min(1, ph.t / 0.5)); c.drive = true; c.off = OFF.tucked + (OFF.sat - OFF.tucked) * a; u.off = 0.25 * (1 - a); u.sitA = 1; k = u.cur && SEAT_CLIPS.has(u.cur) && u.cur !== 'sitIn' ? u.cur : 'idle'; if (a >= 1) { c.drive = false; c.tOff = OFF.sat; setPh(u, 'sitOut'); } }
        else if (ph.m === 'sitOut') { k = 'sitOut'; u.off = 0; c.tOff = OFF.out; c.tSw = 0.45; u.sitA = Math.max(0, 1 - ph.t / dur(u, 'sitOut'));
          if (ph.t >= dur(u, 'sitOut') - 0.05) { u.seat = null; setPh(u, 'stand'); if (!stay) CH.release(seat, av); u.repath = false; buildPath(av); } }
      } else {
        if (ph.m !== 'stand') setPh(u, 'stand'); u.off = 0; u.sitA = 0;
        if (u.repath) { u.repath = false; buildPath(av); }
        const P = u.path && u.path[0];
        if (P) { tmp.set(P.x - av.position.x, 0, P.z - av.position.z); const dist = tmp.length(), lastLeg = u.path.length === 1;
          if (dist < 0.05) { av.position.x = P.x; av.position.z = P.z; u.path.shift(); }
          else { moving = true; const carryNow = ['QA', 'ready', 'review'].includes(s.stage), S3 = SPEED3[u.fem] || SPEED3[0];
            const want = Math.atan2(tmp.x, tmp.z), diff = wrap(want - av.rotation.y), turn = Math.min(Math.abs(diff), dt * 6.5) * Math.sign(diff); av.rotation.y = wrap(av.rotation.y + turn);
            /* speed = the clip's own ground speed (x height), slowed while turning sharply and on the final 0.5 m; the clip's
               playback rate follows the same factor, so feet never slide */
            const base = (carryNow ? S3.carry : S3.walk) * u.look.height, f = Math.max(0.3, Math.cos(Math.min(Math.abs(diff), 1.4))) * (lastLeg ? Math.max(0.45, Math.min(1, dist / 0.5)) : 1);
            sp = base * f; tmp.normalize(); av.position.addScaledVector(tmp, Math.min(dist, dt * sp)); k = carryNow ? 'carry' : 'walk'; u.rate = f;
            /* chair rolls out and swivels toward the agent as they walk up to it */
            const g = u.goalSeat; if (g && Math.hypot(av.position.x - g.root.x, av.position.z - g.root.z) < 1.8) { g.c.tOff = OFF.out; const sx = Math.cos(g.rot) * (av.position.x - g.root.x) - Math.sin(g.rot) * (av.position.z - g.root.z); g.c.tSw = Math.sign(sx || 1) * 0.5; } } }
        if (!moving) {
          const g = u.goalSeat;
          if (g && !(u.path && u.path.length) && Math.hypot(av.position.x - g.root.x, av.position.z - g.root.z) < 0.06) {   /* at the chair: turn to face the desk, then sit */
            const diff = wrap(g.rot - av.rotation.y); av.rotation.y = wrap(av.rotation.y + Math.min(Math.abs(diff), dt * 4) * Math.sign(diff));
            if (Math.abs(diff) < 0.06 && g.c.off > OFF.out - 0.06) { av.rotation.y = g.rot; u.seat = u.lastSeat = g; setPh(u, 'sitIn'); }
            k = 'stand'; }
          else {
            if (u.faceRot != null && !(u.path && u.path.length)) { const diff = wrap(u.faceRot - av.rotation.y); av.rotation.y = wrap(av.rotation.y + Math.min(Math.abs(diff), dt * 4) * Math.sign(diff)); }
            if (u.pose === 'wave') k = u.talking ? 'talk' : (Math.sin(performance.now() / 4000 + u.phase) > 0.75 ? 'greet' : 'stand');
            else if (u.pose === 'host') k = u.greeting ? 'greet' : (u.talking || u.speaking) ? 'talk' : (packs ? 'host' : 'stand');
            else if (u.pose === 'talk') k = 'talk';
            else if (u.spotK) k = u.spotK;                       /* whiteboard / tray / cooler moments set by the room */
            else if (s.stage === 'review') k = 'talk';
            else if (s.stage === 'ready') k = 'pickup';
            else if (s.stage === 'released') k = 'cheer';
            else if (s.blocked) k = 'blockedStand';
            else k = 'stand';
            /* a visitor walks up close: idle standing agents turn to look and wave once */
            const pc = ctx.pos && ctx.pos(); if (pc && u.team && k === 'stand') { const dx = pc.x - av.position.x, dz = pc.z - av.position.z, d2 = dx * dx + dz * dz;
              if (d2 < 2.6 * 2.6) { const want = Math.atan2(dx, dz), diff = wrap(want - av.rotation.y); av.rotation.y = wrap(av.rotation.y + Math.min(Math.abs(diff), dt * 3) * Math.sign(diff));
                if (!u.waved || t - u.waved > 40) { u.waved = t; u.waveUntil = t + dur(u, 'wave'); } }
              if (u.waveUntil && t < u.waveUntil) k = 'wave'; }
          }
        }
      }
      if (SEAT_CLIPS.has(k) && !(u.seat && ph.m !== 'stand')) k = k === 'blocked' ? 'blockedStand' : k === 'phone' ? 'phoneStand' : 'stand';   /* hard rule: no chair, no seated pose */
      /* detailed life moments only up close; far away (or on the low tier) they collapse to the plain loop */
      const dCam = av.position.distanceTo(ctx.cam.position); if (['stretch', 'coffee', 'think', 'chat', 'wave'].includes(k) && (dCam > 9 || (ctx.tier ?? 2) === 0)) k = SEAT_CLIPS.has(k) ? (s.stage && ACTIVE.has(s.stage) ? (packs ? workClip(u) : 'type') : 'idle') : 'stand';
      play(av, k, k === 'sitIn' || k === 'sitOut' || u.prevK === 'sitIn' ? 0.2 : 0.28); u.prevK = k;
      if ((k === 'walk' || k === 'carry') && packs) { const S3 = SPEED3[u.fem] || SPEED3[0]; u.act(k).timeScale = Math.max(0.3, u.rate || 1); } else if (SPEED[k] && !packs && sp) u.act(k).timeScale = sp / SPEED[k];
      u.body.position.z = u.off || 0; u.body.position.y = SIT_BODY_DY * (u.sitA || 0);
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
    const find = n => [...all].find(av => av.userData.a?.name === n);
    this.dbgApi = { dbg: n => { const av = find(n); if (!av) return null; const u = av.userData; return { ph: u.ph, path: (u.path || []).map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]), tgt: u.target && [u.target.x, u.target.z], seat: u.seat?.i, goal: u.goalSeat?.i, rate: u.rate, clip: u.cur, life: u.life }; },
      /* test hooks for the motion checks: hold an agent's wander and send them somewhere / home */
      agentGo: (n, x, z, rot) => { const av = find(n); if (!av) return false; av.userData.wander = { until: Infinity }; av.userData.target = Object.assign(new THREE.Vector3(x, 0, z), { rot }); return true; },
      agentHome: n => { const av = find(n); if (!av) return false; av.userData.wander = { until: Infinity }; av.userData.target = av.userData.home; return true; },
      agentLife: (n, k, secs = 6) => { const av = find(n); if (!av) return false; const t = performance.now() / 1000; av.userData.life = { k, until: t + secs, next: t + secs + 60 }; return true; } };
  },
  onFrame(dt, t) { if (this.fb) return this.fb.onFrame(dt, t); if (this.dbgApi && window.__ewsOffice && !window.__ewsOffice.agentGo) Object.assign(window.__ewsOffice, this.dbgApi); this.pre(); this.CH?.update(dt); for (const av of this._all) this._animate(av, dt); this._tags(); },
};
