// Agent characters v1 (Joshua 2026-10-16: "all agents need better models"). One shared 65-bone rig (the office's own
// UBC rig, so every retargeted clip, the seat system and world-agents keep working), parts merged into ONE skinned mesh
// with ONE material per agent. Outfits are palette swaps on a single wardrobe shader (zone attribute -> colour slot),
// on top of one shared 1024 KTX2 atlas (skin / hair / eye detail). LOD0 < 4k tris, LOD1 ~1.5k, LOD2 = one instanced
// pawn draw call for the whole crowd at distance. Assets: tools/characters (Blender build), LICENSES in assets/characters.
import * as SkeletonUtils from '../../vendor/jsm/utils/SkeletonUtils.js?v=169';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
export const ZONES = ['skin', 'hair', 'eyes', 'top', 'bottom', 'shoes', 'forearm', 'shin', 'accent', 'hat', 'trim', 'brow', 'belt', 'sole'];
const ZI = Object.fromEntries(ZONES.map((z, i) => [z, i]));
const SECURITY = /^(Hœnir|Hoenir|Geri|Sigyn|Skírnir|Skirnir|Freki)$/;
const SKIN = ['#f1d3bd', '#e3b896', '#c99a74', '#a8774f', '#80583a', '#5c3d28'];
const HAIR = ['#2a1a10', '#4a2e18', '#121212', '#7a5a32', '#b08a5a', '#5a2a14', '#8a8a88'];
const CHINOS = ['#2b2f38', '#5c513f', '#1d2433', '#45474c', '#3b3226', '#6b6252'];
const SHOES = ['#2a1c14', '#141210', '#4a3020', '#1d1d20'];
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function kindOf(a, team) {
  const id = String(a.id || ''), n = a.name || '', r = String(a.role || '');
  if (SECURITY.test(n) || /patrol|security|police/i.test(r) || /^(sec|patrol)-/.test(id)) return 'security';
  if (/construction|crew|builder/i.test(r) || /^crew/.test(id)) return 'construction';
  if (id === 'receptionist' || n === 'Freyja' || n === 'Hermod' || id === 'store') return 'host';
  if (team === 'architecture' || /^(lead-)?arch/.test(id)) return 'architect';
  if (id === 'subceo') return 'exec';
  if (a.lead || /^lead-/.test(id)) return 'lead';
  return 'office';
}
export async function loadWardrobe(ctx, L) {
  const { THREE } = ctx, base = '/office/assets/characters/', V = '?v=1';
  const [gm, gf] = await Promise.all(['chars_m.glb', 'chars_f.glb'].map(f => L.loadAsync(base + f + V)));
  let atlas;
  try { atlas = await L.ktx2Loader.loadAsync(base + 'atlas.ktx2' + V); } catch (e) { console.warn('wardrobe: ktx2 atlas failed, jpg fallback', e); atlas = await new THREE.TextureLoader().loadAsync(base + 'atlas.jpg' + V); atlas.flipY = false; }
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const sexes = [gm, gf].map(g => {
    const parts = {}; let proto = null;
    g.scene.traverse(o => { if (o.isSkinnedMesh) { parts[o.name] = o; proto ||= o; } });
    const tpl = g.scene; tpl.updateMatrixWorld(true);
    for (const o of Object.values(parts)) o.parent.remove(o);   // template = armature only; clones are cheap
    return { tpl, parts, proto, boneNames: proto.skeleton.bones.map(b => b.name), inv: proto.skeleton.boneInverses, bind: proto.bindMatrix.clone(), host: proto.parent || tpl };
  });
  const geoCache = new Map();
  function merged(s, lod, list) {
    const k = s + '|' + lod + '|' + list.join(','); if (geoCache.has(k)) return geoCache.get(k);
    const S = sexes[s], gs0 = list.map(n => S.parts[n + '_L' + lod]?.geometry).filter(Boolean);
    /* meshopt/quantise may pick different storage per part (e.g. a constant _zone); unify mismatched attributes as float */
    const sig = at => at.array.constructor.name + (at.normalized ? 'n' : '') + (at.isInterleavedBufferAttribute ? 'i' : '');
    const toF = at => { const n = at.count, k = at.itemSize, a = new Float32Array(n * k), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) a[i * k + j] = at[get[j]](i); return new THREE.BufferAttribute(a, k); };
    const gs = gs0.map(g => g.clone());
    for (const name of Object.keys(gs[0].attributes)) if (new Set(gs.map(g => g.attributes[name] && sig(g.attributes[name]))).size > 1) for (const g of gs) g.setAttribute(name, toF(g.attributes[name]));
    for (const name of Object.keys(gs[0].morphAttributes)) for (let t = 0; t < gs[0].morphAttributes[name].length; t++)
      if (new Set(gs.map(g => sig(g.morphAttributes[name][t]))).size > 1) for (const g of gs) g.morphAttributes[name][t] = toF(g.morphAttributes[name][t]);
    for (const g of gs) for (const name of Object.keys(g.attributes)) if (g.attributes[name].isInterleavedBufferAttribute) g.setAttribute(name, toF(g.attributes[name]));
    const g = gs.length > 1 ? mergeGeometries(gs, false) : gs[0]; if (!g) throw new Error('wardrobe merge failed ' + k); g.morphTargetsRelative = gs0[0].morphTargetsRelative;   /* glTF morphs are deltas; merge/clone dropped the flag (exploded meshes) */ g.computeBoundingSphere(); geoCache.set(k, g); return g;
  }
  /* wardrobe shader: palette per zone, texture detail only where the zone says so, baked vertex AO */
  const GAIN = 1 / 0.6038;   // atlas detail is centred on sRGB 0.8 (= linear 0.604)
  const patch = sh => {
    sh.uniforms.uPal = { value: sh.__pal }; sh.uniforms.uTex = { value: sh.__tex };
    sh.vertexShader = 'attribute float _zone;\nattribute float _ao;\nvarying float vZone;\nvarying float vAo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvZone = _zone; vAo = _ao;');
    sh.fragmentShader = 'uniform vec3 uPal[14];\nuniform float uTex[14];\nuniform float uLodFade;\nuniform float uLodInvert;\nvarying float vZone;\nvarying float vAo;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      `int zi = int(vZone + 0.5); vec3 pc = uPal[zi]; float tm = uTex[zi]; vec3 tx = texture2D(map, vMapUv).rgb * ${GAIN.toFixed(4)};
       diffuseColor.rgb = mix(pc, pc * tx, tm) * mix(1.0, vAo, 0.8);
       if (uLodFade < 0.999 || uLodInvert > 0.5) {
         float ewsLodNoise = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
         if (uLodInvert > 0.5 ? ewsLodNoise <= uLodFade : ewsLodNoise > uLodFade) discard;
       }`);
  };
  function material(pal, tex, lodLevel) {
    const m = new THREE.MeshLambertMaterial({ map: atlas }); m.name = 'EWS_Wardrobe';
    const P = ZONES.map(z => new THREE.Color(pal[z] ?? '#808080')), T = ZONES.map(z => tex[z] ? 1 : 0);
    const fade = { value: 1 }, invert = { value: 0 };
    m.onBeforeCompile = sh => { sh.__pal = P; sh.__tex = T; sh.uniforms.uLodFade = fade; sh.uniforms.uLodInvert = invert; patch(sh); };
    m.customProgramCacheKey = () => 'ews-wardrobe-lod-2';
    m.userData.pal = P; m.userData.lodFade = fade; m.userData.lodInvert = invert; m.userData.lodLevel = lodLevel; return m;
  }
  const C = c => new THREE.Color(c);
  const shade = (c, l, s = 0) => { const x = C(c), h = {}; x.getHSL(h); x.setHSL(h.h, Math.min(1, Math.max(0, h.s + s)), Math.min(0.85, Math.max(0.08, h.l + l))); return '#' + x.getHexString(); };
  /* look: deterministic per agent (name hash + per-sex counter for spread), recognisable by role */
  function look(a, fem, col, k, team) {
    const h = hash(a.id || a.name), kind = kindOf(a, team), teamCol = '#' + C(col ?? 0x6a8fb8).getHexString();
    const skin = SKIN[(k + (h >>> 3)) % SKIN.length], HC = fem ? HAIR.slice(0, 6) : HAIR, hair = HC[(Math.floor(k / SKIN.length) + k + (h >>> 5)) % HC.length];   /* grey only on some of the men */
    const pal = { skin, hair, brow: shade(hair, -0.04), eyes: '#9a9a9a', sole: '#1a1714', belt: '#2a2018', trim: '#c9a24a' };
    const tex = { skin: 1, hair: 1, brow: 1, eyes: 1 };
    const hairs = fem ? ['Hair_Long', 'Hair_Buns', 'Hair_SimpleParted', 'Hair_BuzzedFemale'] : ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Long'];
    let hs = hairs[(h >>> 7) % hairs.length]; if (!fem && hs === 'Hair_Long' && (h >>> 9) % 2) hs = 'Hair_SimpleParted';
    const beard = !fem && (h >>> 11) % 3 === 0;
    const parts = ['body', 'shoes', 'eyes'];
    let rolled = (h >>> 4) % 3 === 0;
    pal.top = shade(teamCol, ((h >>> 2) % 5 - 2) * 0.04, -0.05); pal.bottom = CHINOS[(h >>> 6) % CHINOS.length]; pal.shoes = SHOES[(h >>> 8) % SHOES.length]; pal.accent = '#2b2f36';
    if (kind === 'security') {
      Object.assign(pal, { top: '#22324f', bottom: '#19202e', shoes: '#111214', hat: '#1b2740', accent: '#0e1116', trim: '#d4af37', belt: '#121212' });
      parts.push('cap', 'belt', 'badge'); hs = fem ? 'Hair_BuzzedFemale' : 'Hair_Buzzed'; rolled = false;
    } else if (kind === 'construction') {
      const hat = ['#f2c200', '#f4f4f0', '#ff7a1a'][h % 3], vest = (h >>> 3) % 2 ? '#c8f526' : '#ff7a1a';
      Object.assign(pal, { top: ['#5b6168', '#2f3d55', '#7a2f2a', '#3d4a3a'][(h >>> 5) % 4], bottom: ['#3b4f6e', '#6d6147', '#4a4a48'][(h >>> 7) % 3], shoes: '#6b4a2b', shin: '#6b4a2b', hat, accent: vest, trim: '#e8e8e8' });
      parts.push('hardhat', 'vest_hivis'); hs = fem ? 'Hair_BuzzedFemale' : 'Hair_Buzzed'; rolled = true;   /* t-shirt: bare forearms */
    } else if (kind === 'host') {   /* Freyja (reception) and Hermod (store): matching front-of-house look */
      Object.assign(pal, { top: '#efe6d4', bottom: '#2a2c31', shoes: '#16110e', accent: '#1f4a44', trim: '#c9a24a' });
      parts.push('jacket'); rolled = false;
    } else if (kind === 'architect') {
      Object.assign(pal, { top: ['#dfe7ef', '#c9d6c2', '#efe9df', '#b9c8db'][(h >>> 3) % 4], bottom: ['#5c513f', '#3b3f45', '#6b6252'][(h >>> 5) % 3], accent: ['#8a7a52', '#6f6a3e', '#9a6b3a'][(h >>> 7) % 3], trim: '#5e5338', shoes: '#4a3020' });
      parts.push('vest_field'); rolled = (h >>> 4) % 2 === 0;
    } else if (kind === 'exec') {
      Object.assign(pal, { top: '#f3f1ec', accent: '#1e1e22', bottom: '#1e1e22', shoes: '#0f0d0c', trim: '#8a1c2c' }); parts.push('jacket'); rolled = false;
    } else if (kind === 'lead') {
      Object.assign(pal, { accent: ['#2b2f36', '#1f2a3d', '#3a3430'][(h >>> 3) % 3], top: shade(teamCol, 0.12, -0.15) }); parts.push('jacket'); rolled = false;
    }
    if (rolled) { pal.forearm = skin; tex.forearm = 1; } else pal.forearm = pal.top;
    pal.shin = pal.shin || pal.bottom;
    parts.push('hair_' + hs); if (beard && kind !== 'security') parts.push('hair_Hair_Beard');
    const morph = [[0, 0, 0.25, 0.55, 0, 0.8][(h >>> 12) % 6], ((h >>> 14) % 7) / 6 * 1.4 - 0.5, ((h >>> 17) % 7) / 6 * 1.6 - 0.6, ((h >>> 20) % 5) / 4];
    if (kind === 'host' || kind === 'security') morph[0] = Math.min(morph[0], 0.25);
    return { kind, pal, tex, parts, morph, hair: hs };
  }
  const counters = [0, 0];
  function build(a, fem, col, team) {
    const s = fem ? 1 : 0, S = sexes[s], k = counters[s]++, L = look(a, fem, col, k, team);
    const root = SkeletonUtils.clone(S.tpl); const byName = {}; root.traverse(o => { if (o.isBone) byName[o.name] = o; });
    const skel = new THREE.Skeleton(S.boneNames.map(n => byName[n]), S.inv);
    let host = root; if (S.host !== S.tpl) root.traverse(o => { if (o.name === S.host.name) host = o; });
    const mats = [0, 1].map(lod => material(L.pal, L.tex, lod)), meshes = [0, 1].map(lod => {
      const m = new THREE.SkinnedMesh(merged(s, lod, L.parts), mats[lod]); m.name = 'agent_L' + lod; m.frustumCulled = false; m.castShadow = false;
      host.add(m); m.bind(skel, S.bind); m.updateMorphTargets(); if (m.morphTargetInfluences) L.morph.forEach((v, i) => { m.morphTargetInfluences[i] = v; }); return m; });
    meshes[1].visible = false;
    const tris = meshes.map(m => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3);
    return { body: root, meshes, look: L, tris, mat: mats[0], mats };
  }
  /* LOD2: every far agent is one instance of one pawn mesh (capsule body + head) in its outfit colour: one draw call */
  const MAXP = 192, pg = (() => { const b = new THREE.CapsuleGeometry(0.2, 0.95, 2, 8); b.translate(0, 0.68, 0); const hd = new THREE.SphereGeometry(0.12, 8, 6); hd.translate(0, 1.6, 0);
    for (const g of [b, hd]) { g.deleteAttribute('uv'); } return mergeGeometries([b, hd], false); })();
  const lodFade = new THREE.InstancedBufferAttribute(new Float32Array(MAXP), 1); pg.setAttribute('instanceLodFade', lodFade);
  const pawnMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  pawnMat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float instanceLodFade;\nvarying float vEwsLodFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEwsLodFade = instanceLodFade;');
    sh.fragmentShader = 'varying float vEwsLodFade;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (vEwsLodFade > 0.001) {
        float ewsLodNoise = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
        if (ewsLodNoise <= vEwsLodFade) discard;
      }`);
  };
  pawnMat.customProgramCacheKey = () => 'ews-pawn-lod-2';
  const pawn = new THREE.InstancedMesh(pg, pawnMat, MAXP); pawn.count = 0; pawn.frustumCulled = false; pawn.name = 'agent-pawns';
  pawn.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pawn.setColorAt(0, new THREE.Color()); ctx.scene.add(pawn);
  const pm = new THREE.Matrix4(), tc = new THREE.Color();
  const pawns = { begin() { pawn.count = 0; }, add(av, col, threshold = 0) { if (pawn.count >= MAXP) return; av.updateMatrixWorld(); pm.copy(av.matrixWorld); pawn.setMatrixAt(pawn.count, pm); pawn.setColorAt(pawn.count, col); lodFade.setX(pawn.count, threshold); pawn.count++; },
    addAt(x, y, z, yaw, col, threshold = 0) { if (pawn.count >= MAXP) return; pm.makeRotationY(yaw); pm.setPosition(x, y, z); pawn.setMatrixAt(pawn.count, pm); pawn.setColorAt(pawn.count, tc.set(col)); lodFade.setX(pawn.count, threshold); pawn.count++; },
    end() { pawn.instanceMatrix.needsUpdate = true; lodFade.needsUpdate = true; if (pawn.instanceColor) pawn.instanceColor.needsUpdate = true; pawn.visible = pawn.count > 0; } };
  return { build, pawns, kindOf, sexes, atlas };
}
