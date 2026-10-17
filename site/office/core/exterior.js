// Elderverse exterior v1 (campus grounds + town reserve). Replaces the painted backdrop behind the lobby glass with real,
// walkable geometry: plaza + canopy, lawn, paths, lake (cheap water shader), parking, the building's own facade, the
// tree-crest tower and glass dome (massing), Poly Haven trees (8-angle baked impostors, one draw call) and shrubs (real
// GLBs, instanced), street lamps that glow at night, a camera-following sky + distant hills, and beyond the campus road a flat
// town reserve: a road grid with empty, numbered lot pads on EWS-owned streets, built lazily in chunks.
// Cheap-device rules: everything is unlit-baked or Lambert (no shadows, no real-time lights), static parts merged per material,
// trees/shrubs instanced, KTX2 (ETC1S) textures with WebP fallback, chunks built/shown by distance, tier-scaled counts + view
// distance, and the whole exterior is skipped when you're deep inside the building (it can only be seen through the lobby glass).
// Day/night: core/daynight.js calls dayNight(P, el, date) on every apply. Off switch: ?ext=0 (engine falls back to the baked view).
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js?v=169';
import { DRACOLoader } from '../vendor/jsm/loaders/DRACOLoader.js?v=169';
import { KTX2Loader } from '../vendor/jsm/loaders/KTX2Loader.js?v=169';

const A = '/office/assets/exterior/';
const SPECIES = [   // atlas row order (assets/exterior/trees_atlas.*): id, frame side S in model metres, model height H, target height range
  { id: 'jacaranda_tree', S: 25.394, H: 19.469, h: [9, 12] }, { id: 'island_tree_02', S: 4.376, H: 3.407, h: [5.5, 7.5] },
  { id: 'tree_small_02', S: 4.739, H: 4.557, h: [6, 8.5] }, { id: 'island_tree_01', S: 5.229, H: 5.027, h: [7, 9.5] },
  { id: 'fir_tree_01', S: 19.696, H: 18.939, h: [12, 16] }, { id: 'quiver_tree_02', S: 1.528, H: 1.469, h: [3.2, 4.4] }];
const FR = 8, BASE = 0.02;
let KTX = null; const ktxL = R => (KTX ||= new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(R));

export function build(ctx, shell) {
  const T = ctx.THREE, { scene } = ctx, { fx, fX, fz, fZ, EN } = shell, Z0 = fZ, X0 = EN ? EN.x : 0;
  const q = new URLSearchParams(location.search); let tier = ctx.tier;
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const root = new T.Group(); root.name = 'exterior'; root.userData.keep = 1; root.userData.noFarCull = 1; scene.add(root);
  const sky = new T.Group(); sky.name = 'exterior-sky'; sky.userData.keep = 1; sky.userData.noFarCull = 1; scene.add(sky);
  const cols = (ctx.extraCols ||= []); const col = (x0, z0, x1, z1) => { const r = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]; cols.push(r); ctx.colliders?.push?.(r); };
  const BOUNDS = [-175, 175, fz - 36, Z0 + 330];

  /* ---------- shared uniforms + material helpers ---------- */
  const U = { uHazeC: { value: new T.Color('#c9d6e2') }, uHazeN: { value: 34 }, uHazeF: { value: 118 }, uLit: { value: 1 }, uTime: { value: 0 },
    uSkyT: { value: new T.Color('#7fb2e0') }, uSkyH: { value: new T.Color('#e9e2cf') }, uSunDir: { value: new T.Vector3(0.3, 0.6, 0.7).normalize() },
    uSunC: { value: new T.Color('#ffe2b0') }, uNight: { value: 0 }, uLakeT: { value: new T.Color('#7fa6c4') }, uLakeB: { value: new T.Color('#3f6684') },
    uTint: { value: new T.Color(1, 1, 1) }, uLights: { value: 0 } };
  const HAZE_GLSL = 'uniform vec3 uHazeC; uniform float uHazeN, uHazeF, uLit;\n';
  const patch = m => { m.fog = false; m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uHazeC: U.uHazeC, uHazeN: U.uHazeN, uHazeF: U.uHazeF, uLit: U.uLit });
      sh.fragmentShader = HAZE_GLSL + sh.fragmentShader
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', 'vec3 outgoingLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * uLit + totalEmissiveRadiance;')
        .replace('#include <fog_fragment>', '#include <fog_fragment>\n{ float hz = pow(smoothstep(uHazeN, uHazeF, length(vViewPosition)), 1.5); gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(uHazeC, 1.0)).rgb, hz); }'); };
    m.customProgramCacheKey = () => 'ews-ext-haze'; return m; };
  const LM = (o = {}) => patch(new T.MeshLambertMaterial(o));
  const glsl = { haze: 'uniform vec3 uHazeC; uniform float uHazeN, uHazeF;\nvec3 hazeIt(vec3 c, float d) { return mix(c, uHazeC, pow(smoothstep(uHazeN, uHazeF, d), 1.5)); }\n' };
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = tier > 0 ? 4 : 1; return t; };
  const noise = (g, w, h, n, a, b, alpha = 0.18) => { for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? a : b; g.globalAlpha = alpha * rnd(); const s = 1 + rnd() * 3; g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; };
  const tex = {
    grain: canvas(256, 256, (g, w, h) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, '#ffffff', '#9a9a9a', 0.35); }),
    grass: canvas(256, 256, (g, w, h) => { g.fillStyle = '#d6e0c8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.strokeStyle = rnd() < 0.5 ? '#f2f7e6' : '#9fae8a'; g.globalAlpha = 0.25 + rnd() * 0.3; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4); g.stroke(); } g.globalAlpha = 1; }),
    pavers: canvas(256, 256, (g, w, h) => { g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const o = (y % 2) * 32; g.fillStyle = ['#c9c2b4', '#bdb5a6', '#d2cbbd', '#b4ac9d'][(x * 3 + y * 5) % 4]; g.fillRect(x * 64 + o + 1, y * 32 + 1, 62, 30); g.fillRect(x * 64 + o - 255, y * 32 + 1, 62, 30); } noise(g, w, h, 2500, '#ffffff', '#6f685c', 0.15); }),
    glow: canvas(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,214,150,1)'); r.addColorStop(0.35, 'rgba(255,200,130,.45)'); r.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }),
    blob: canvas(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }) };
  const mats = { vc: LM({ vertexColors: true, map: tex.grain }), lawn: LM({ vertexColors: true, map: tex.grass }), pav: LM({ map: tex.pavers }),
    head: new T.MeshBasicMaterial({ color: 0xcfc8b8, toneMapped: false, fog: false }),
    pool: new T.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    blob: new T.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.8, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }) };

  /* ---------- tiny merge builder: boxes / cylinders / flat quads with vertex colours + world-space UVs ---------- */
  const tmpC = new T.Color(), m4 = new T.Matrix4(), q4 = new T.Quaternion(), e3 = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3();
  function Batch() { const list = [];
    const push = (geo, c, x, y, z, ry = 0, uvs = 4) => { geo.applyMatrix4(m4.compose(v3.set(x, y, z), q4.setFromEuler(e3.set(0, ry, 0)), s3.set(1, 1, 1)));
      const p = geo.attributes.position, n = p.count, ca = new Float32Array(n * 3), ua = new Float32Array(n * 2); tmpC.set(c);
      const nn = geo.attributes.normal;
      for (let i = 0; i < n; i++) { ca[i * 3] = tmpC.r; ca[i * 3 + 1] = tmpC.g; ca[i * 3 + 2] = tmpC.b; const ny = Math.abs(nn.getY(i)), nx = Math.abs(nn.getX(i));
        ua[i * 2] = (ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i)) / uvs; ua[i * 2 + 1] = (ny > 0.5 ? p.getZ(i) : p.getY(i)) / uvs; }
      geo.setAttribute('color', new T.BufferAttribute(ca, 3)); geo.setAttribute('uv', new T.BufferAttribute(ua, 2)); list.push(geo.index ? geo.toNonIndexed() : geo); return geo; };
    return { list,
      box: (w, h, d, c, x, y, z, ry, uvs) => push(new T.BoxGeometry(w, h, d), c, x, y, z, ry, uvs),
      cyl: (rt, rb, h, c, x, y, z, seg = 8) => push(new T.CylinderGeometry(rt, rb, h, seg), c, x, y, z),
      quad: (w, d, c, x, y, z, ry, uvs) => push(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), c, x, y, z, ry, uvs),
      geo: (g, c, x, y, z, ry, uvs) => push(g, c, x, y, z, ry, uvs),
      mesh(mat, parent = root) { if (!list.length) return null; for (const g of list) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        const m = new T.Mesh(mergeGeometries(list), mat); list.forEach(g => g.dispose()); list.length = 0; m.userData.noCollide = 1; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); return m; } }; }
  const flat = (geo, mat, y, parent = root) => { const m = new T.Mesh(geo, mat); m.position.y = y; m.userData.noCollide = 1; parent.add(m); return m; };

  /* ---------- sky dome, stars, hills (follow the camera: drawn first, never clipped by the 120 m far plane) ---------- */
  { const sg = new T.SphereGeometry(100, 32, 16), sm = new T.ShaderMaterial({ uniforms: U, depthWrite: false, depthTest: false, side: T.BackSide, fog: false,
      defines: tier > 0 ? { CLOUDS: 1 } : {},
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uSkyT, uSkyH, uHazeC, uSunDir, uSunC; uniform float uNight, uTime; varying vec3 vD;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec3 d = normalize(vD); float y = d.y;
          vec3 c = mix(uSkyH, uSkyT, pow(clamp(y, 0.0, 1.0), 0.55)); c = mix(c, uHazeC, smoothstep(0.12, -0.02, y));
          float sd = dot(d, uSunDir); float up = smoothstep(-0.12, 0.05, uSunDir.y);
          c += uSunC * (smoothstep(0.9993, 0.9997, sd) * 2.0 + pow(max(sd, 0.0), 24.0) * 0.35) * up;
          float md = dot(d, -uSunDir); c += vec3(0.85, 0.88, 1.0) * smoothstep(0.9994, 0.9997, md) * uNight;
          #ifdef CLOUDS
          if (y > 0.0) { vec2 p = d.xz / (y + 0.18) * 1.6 + vec2(uTime * 0.004, 0.0); float n = vn(p) * 0.6 + vn(p * 2.3) * 0.3 + vn(p * 5.1) * 0.1;
            float cl = smoothstep(0.55, 0.8, n) * smoothstep(0.0, 0.25, y); vec3 cc = mix(vec3(1.0, 0.98, 0.95), uSkyH * 0.9, 0.35) * (1.0 - 0.93 * uNight); c = mix(c, cc, cl * (0.75 - 0.4 * uNight)); }
          #endif
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    const dome = new T.Mesh(sg, sm); dome.renderOrder = -100; dome.frustumCulled = false; sky.add(dome);
    const sp = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * r * 95, y * 95, Math.sin(a) * r * 95], i * 3); }
    const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(sp, 3)), new T.PointsMaterial({ color: 0xfff8e8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false }));   /* depthTest on: as a transparent Points object it draws AFTER the opaque pass, so with depthTest off the stars speckled the indoor walls and ceilings (walkthrough REPORT item 9) */
    stars.renderOrder = -99; stars.frustumCulled = false; sky.add(stars); sky.userData.stars = stars;
    // distant hills: 3 rings, pre-hazed by layer
    const hillMat = (col, hz) => new T.ShaderMaterial({ uniforms: { uHazeC: U.uHazeC, uLit: U.uLit, uCol: { value: new T.Color(col) }, uHz: { value: hz } }, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'attribute float aH; varying float vH; void main(){ vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uHazeC, uCol; uniform float uHz, uLit; varying float vH; void main(){ vec3 c = uCol * (0.72 + 0.28 * vH) * uLit; c = mix(c, uHazeC, clamp(uHz + (1.0 - vH) * 0.45, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}' });
    [[97, '#6f8796', 0.62, 9, 3.1], [93, '#5f7a5c', 0.4, 6.5, 7.7], [89, '#4f6a46', 0.22, 4.2, 1.3]].forEach(([r, c, hz, amp, ph], li) => {
      const N = 160, pos = [], ah = [], idx = [];
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, h = amp * (0.55 + 0.45 * Math.sin(a * 3 + ph)) * (0.6 + 0.4 * Math.sin(a * 7.3 + ph * 2)) + amp * 0.35 * Math.abs(Math.sin(a * 13.1 + ph)) + 1.5;
        const x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, -12, z, x, h, z); ah.push(0, 1); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aH', new T.Float32BufferAttribute(ah, 1)); g.setIndex(idx);
      const hm = new T.Mesh(g, hillMat(c, hz)); hm.material.side = T.DoubleSide; hm.renderOrder = -98 + li; hm.frustumCulled = false; sky.add(hm); });
  }

  /* ---------- ground: one lawn mesh with baked macro variation + AO near the building ---------- */
  { const W = BOUNDS[1] - BOUNDS[0] + 40, D = BOUNDS[3] - BOUNDS[2] + 40, g = new T.PlaneGeometry(W, D, 96, 110).rotateX(-Math.PI / 2); g.translate((BOUNDS[0] + BOUNDS[1]) / 2, 0, (BOUNDS[2] + BOUNDS[3]) / 2);
    const p = g.attributes.position, c = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), A1 = new T.Color('#5d7f3e'), A2 = new T.Color('#7a9448'), A3 = new T.Color('#4e6e3a'), tc = new T.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), n = 0.5 + 0.25 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) + 0.25 * Math.sin(z * 0.11 - x * 0.03);
      tc.copy(A1).lerp(A2, n); if (Math.sin(x * 0.31) * Math.sin(z * 0.27) > 0.6) tc.lerp(A3, 0.5);
      const dx = Math.max(fx - x, 0, x - fX), dz = Math.max(fz - z, 0, z - Z0), dB = Math.hypot(dx, dz); if (dB < 3) tc.multiplyScalar(0.72 + 0.28 * dB / 3);   // baked AO at the facade base
      c.set([tc.r, tc.g, tc.b], i * 3); uv.set([x / 2.5, z / 2.5], i * 2); }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); flat(g, mats.lawn, -0.012); }

  /* ---------- campus hardscape (one merged mesh): plaza, canopy, paths, parking, driveway, planters, benches ---------- */
  const lake = { x: X0 - 28, z: Z0 + 34, rx: 20, rz: 12 }; const lakeR = a => 1 + 0.1 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2.2);
  const AVE = Z0 + 62;   // the campus avenue = first street of the town grid
  { const B = Batch(), P = Batch(), conc = '#c4beb2', curb = '#9d978c', dark = '#2f3136', brass = '#b08d3c';
    P.quad(22, 16, 0xffffff, X0, 0.012, Z0 + 8);                                         // plaza pavers (own textured material)
    B.quad(5, AVE - 6 - (Z0 + 16), conc, X0, 0.016, (Z0 + 16 + AVE - 6) / 2);             // main walk to the avenue
    B.quad(14, 2.4, conc, X0 - 17, 0.016, Z0 + 12);                                       // plaza -> lake loop connector
    // lake loop path (ribbon at ~4 m from the shore)
    { const pts = [], N = 96; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = lakeR(a); pts.push([lake.x + Math.cos(a) * (lake.rx * r + 4.5), lake.z + Math.sin(a) * (lake.rz * r + 4.5)]); }
      const pos = [], idx = []; for (let i = 0; i <= N; i++) { const [x, z] = pts[i], [x2, z2] = pts[(i + 1) % N], dx = x2 - x, dz = z2 - z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 1.2, nz = dx / l * 1.2; pos.push(x + nx, 0.017, z + nz, x - nx, 0.017, z - nz); if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.setAttribute('normal', new T.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); B.geo(g, '#cfc6b4', 0, 0, 0); }
    // parking (east), driveway to the avenue, stall lines
    const PX0 = Math.max(X0 + 14, 14), PX1 = PX0 + 34, PZ0 = Z0 + 8, PZ1 = Z0 + 42;
    B.quad(PX1 - PX0, PZ1 - PZ0, dark, (PX0 + PX1) / 2, 0.02, (PZ0 + PZ1) / 2); B.quad(6, AVE - 6 - PZ1, dark, PX0 + 22, 0.02, (PZ1 + AVE - 6) / 2);
    for (const row of [PZ0 + 5.5, PZ1 - 5.5]) for (let x = PX0 + 1; x <= PX1 - 1; x += 2.7) B.quad(0.12, 5, '#e8e4da', x, 0.026, row);
    for (const [x0, x1, z] of [[PX0, PX1, PZ0], [PX0, PX1, PZ1]]) B.box(x1 - x0, 0.15, 0.3, curb, (x0 + x1) / 2, 0.075, z);
    // entrance canopy (cantilever, brass edge) + downlights handled with the lamp heads
    B.box(15, 0.28, 4.6, '#26252b', X0, 4.5, Z0 + 2.3); B.box(15.1, 0.08, 0.08, brass, X0, 4.38, Z0 + 4.6);
    // planters either side of the plaza, benches facing the lake
    for (const sx of [-1, 1]) { B.box(4.2, 0.55, 1.6, '#6a645a', X0 + sx * 8.2, 0.275, Z0 + 6); B.box(4.2, 0.55, 1.6, '#6a645a', X0 + sx * 8.2, 0.275, Z0 + 12); col(X0 + sx * 8.2 - 2.1, Z0 + 5.2, X0 + sx * 8.2 + 2.1, Z0 + 6.8); col(X0 + sx * 8.2 - 2.1, Z0 + 11.2, X0 + sx * 8.2 + 2.1, Z0 + 12.8);
      B.quad(3.9, 1.3, '#3b2c20', X0 + sx * 8.2, 0.555, Z0 + 6); B.quad(3.9, 1.3, '#3b2c20', X0 + sx * 8.2, 0.555, Z0 + 12); }
    for (const [x, z, ry] of [[X0 - 14, Z0 + 18, 0.5], [X0 - 22, Z0 + 18.5, 0.2], [X0 + 4.5, Z0 + 26, -Math.PI / 2], [X0 + 4.5, Z0 + 36, -Math.PI / 2]]) {
      B.box(1.8, 0.07, 0.5, '#7a5634', x, 0.46, z, ry); for (const s of [-0.75, 0.75]) B.box(0.08, 0.44, 0.45, '#2a2a2e', x + Math.cos(ry) * s, 0.22, z - Math.sin(ry) * s, ry); col(x - 0.9, z - 0.9, x + 0.9, z + 0.9); }
    // monument sign by the main walk (two-sided text panel added below)
    B.box(7.4, 1.9, 0.7, '#2c2b31', X0 + 9, 0.95, AVE - 9); B.box(7.8, 0.25, 1.1, '#5d5a62', X0 + 9, 0.125, AVE - 9); col(X0 + 5.2, AVE - 9.6, X0 + 12.8, AVE - 8.4);
    B.mesh(mats.vc); P.mesh(mats.pav);
    const st = canvas(1024, 256, (g, w, h) => { g.fillStyle = '#1d1c22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b45a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      crest(g, 128, 128, 92); g.fillStyle = '#e9dcc0'; g.font = '600 78px Cinzel, Georgia, serif'; g.textBaseline = 'middle'; g.fillText('ELDER WORLD STUDIO', 250, 112); g.font = '500 40px Inter, system-ui, sans-serif'; g.fillStyle = '#d9b45a'; g.fillText('INC  ·  CAMPUS', 252, 184); });
    st.wrapS = st.wrapT = T.ClampToEdgeWrapping; const sm = LM({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.1 }); mats.sign = sm;
    for (const s of [1, -1]) { const pl = new T.Mesh(new T.PlaneGeometry(6.8, 1.7), sm); pl.position.set(X0 + 9, 1.0, AVE - 9 + s * 0.36); pl.rotation.y = s > 0 ? 0 : Math.PI; pl.userData.noCollide = 1; root.add(pl); }
  }
  function crest(g, cx, cy, r) {   // tree crest emblem: ringed tree (the campus vision board mark)
    g.save(); g.strokeStyle = '#e9dcc0'; g.fillStyle = '#e9dcc0'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.lineCap = 'round'; const br = (x, y, a, l, w, d) => { if (d === 0 || l < 2) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - 0.42, l * 0.72, w * 0.68, d - 1); br(x2, y2, a + 0.42, l * 0.72, w * 0.68, d - 1); };
    br(cx, cy + r * 0.62, -Math.PI / 2, r * 0.42, r * 0.11, 7); g.lineWidth = r * 0.05; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy + r * 0.62); g.quadraticCurveTo(cx + s * r * 0.3, cy + r * 0.66, cx + s * r * 0.55, cy + r * 0.72); g.stroke(); }
    g.restore(); }

  /* ---------- building facade, roof, tree-crest tower, glass dome ---------- */
  { const FH = 21, facade = canvas(1024, 512, (g, w, h) => { const cw = w / 8, ch = h / 5; g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const x = c * cw, y = r * ch, gr = g.createLinearGradient(x, y, x, y + ch); gr.addColorStop(0, '#3a4c60'); gr.addColorStop(0.7, '#223040'); gr.addColorStop(1, '#1a2430'); g.fillStyle = gr; g.fillRect(x + 4, y + 4, cw - 8, ch * 0.8); g.fillStyle = '#2b2d33'; g.fillRect(x, y + ch * 0.84, cw, ch * 0.16); }
        g.fillStyle = '#5b5f68'; for (let c = 0; c <= 8; c++) g.fillRect(c * cw - 3, 0, 6, h); }),
      lit = canvas(1024, 512, (g, w, h) => { const cw = w / 8, ch = h / 5; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const on = rnd(); if (on < 0.35) continue; g.fillStyle = on > 0.85 ? '#ffe9c4' : '#ffc77a'; g.globalAlpha = 0.35 + rnd() * 0.55; g.fillRect(c * cw + 6, r * ch + 6, cw - 12, ch * 0.78); } g.globalAlpha = 1; });
    const fm = LM({ map: facade, emissive: 0xffffff, emissiveMap: lit, emissiveIntensity: 0.06 }); mats.facade = fm;
    const plane = (w, h, x, y, z, ry, u0, v0) => { const g = new T.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * w / 24, v0 + uv.getY(i) * h / FH);
      const m = new T.Mesh(g, fm); m.position.set(x, y, z); m.rotation.y = ry; m.userData.noCollide = 1; root.add(m); return m; };
    const o = 0.2, ex0 = X0 - EN.w / 2, ex1 = X0 + EN.w / 2;
    plane(ex0 - fx, FH, (fx + ex0) / 2, FH / 2, Z0 + o, 0, 0, 0); plane(fX - ex1, FH, (ex1 + fX) / 2, FH / 2, Z0 + o, 0, 0.3, 0);
    plane(EN.w, FH - 4.0, X0, 4.0 + (FH - 4) / 2, Z0 + o, 0, 0.1, 4 / FH);
    plane(fX - fx, FH, (fx + fX) / 2, FH / 2, fz - o, Math.PI, 0, 0); plane(Z0 - fz, FH, fx - o, FH / 2, (fz + Z0) / 2, -Math.PI / 2, 0.5, 0); plane(Z0 - fz, FH, fX + o, FH / 2, (fz + Z0) / 2, Math.PI / 2, 0.2, 0);
    const B = Batch(); B.box(fX - fx + 0.8, 0.5, Z0 - fz + 0.8, '#2a2b30', (fx + fX) / 2, FH + 0.25, (fz + Z0) / 2);                        // roof slab
    B.box(fX - fx - 4, 0.6, 2.4, '#4f6a3e', (fx + fX) / 2, FH + 0.8, Z0 - 1.6);                                                            // rooftop garden strip
    B.box(fX - fx + 0.9, 0.35, 0.5, '#8a7a5a', (fx + fX) / 2, 4.25, Z0 + 0.45);                                                            // brass-tone storey band over the ground floor
    // tree-crest tower (massing): proud of the facade right of the entrance, 38 m
    const tx0 = Math.min(X0 + 9, fX - 14), tx1 = tx0 + 12, TH = 38; B.box(tx1 - tx0, TH - 4.3, 11, '#1f2026', (tx0 + tx1) / 2, 4.3 + (TH - 4.3) / 2, Z0 - 4.3);
    B.box(tx1 - tx0, 4.3, 1.0, '#1f2026', (tx0 + tx1) / 2, 2.15, Z0 + 0.7); col(tx0, Z0, tx1, Z0 + 1.3);
    for (let i = 0; i <= 6; i++) B.box(0.18, TH - 1, 0.5, '#33353d', tx0 + i * (tx1 - tx0) / 6, TH / 2, Z0 + 1.35);                              // vertical fins
    B.mesh(mats.vc);
    const ct = canvas(512, 768, (g, w, h) => { g.fillStyle = '#16171c'; g.fillRect(0, 0, w, h); crest(g, w / 2, 250, 175); g.fillStyle = '#e9dcc0'; g.textAlign = 'center'; g.font = '600 66px Cinzel, Georgia, serif';
      ['ELDER', 'WORLD', 'STUDIO', 'INC'].forEach((s, i) => g.fillText(s, w / 2, 520 + i * 66)); }); ct.wrapS = ct.wrapT = T.ClampToEdgeWrapping;
    const cm = LM({ map: ct, emissive: 0xffffff, emissiveMap: ct, emissiveIntensity: 0.1 }); mats.crest = cm;
    { const pl = new T.Mesh(new T.PlaneGeometry(8, 12), cm); pl.position.set((tx0 + tx1) / 2, TH - 9, Z0 + 1.62); pl.userData.noCollide = 1; root.add(pl); }
    // glass dome west of the building: stone drum, ribbed glass hemisphere, a few trees inside
    const dx = fx - 22, dz = Z0 - 16, DR = 15; const db = Batch(); db.cyl(DR + 0.3, DR + 0.5, 1.4, '#77736b', dx, 0.7, dz, 48);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, g = new T.TorusGeometry(DR, 0.09, 4, 32, Math.PI / 2); g.rotateY(-a); db.geo(g, '#3a3c42', dx, 1.4, dz); }
    for (const k of [0.3, 0.55, 0.78]) { const g = new T.TorusGeometry(DR * Math.cos(k * Math.PI / 2), 0.08, 4, 64).rotateX(Math.PI / 2); db.geo(g, '#3a3c42', dx, 1.4 + DR * Math.sin(k * Math.PI / 2), dz); }
    db.mesh(mats.vc);
    const gm = LM({ color: 0x9fc4d8, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide, emissive: 0xffc77a, emissiveIntensity: 0 }); mats.domeGlass = gm;
    const dome = new T.Mesh(new T.SphereGeometry(DR, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), gm); dome.position.set(dx, 1.4, dz); dome.userData.noCollide = 1; dome.renderOrder = 2; root.add(dome);
    for (let zz = -DR; zz < DR; zz += 2) { const hw = Math.sqrt(Math.max(0, DR * DR - (zz + 1) * (zz + 1))) ; col(dx - hw, dz + zz, dx + hw, dz + zz + 2); }
    shell.dome = { x: dx, z: dz, r: DR }; shell.tower = [tx0, tx1];
  }

  /* ---------- lake: cheap water shader (4 sines, fresnel to the sky, sun glint), shore band, rocks ---------- */
  { const rings = [0, 0.35, 0.6, 0.78, 0.9, 0.96, 1], N = 72, pos = [], ed = [], idx = [];
    for (let r = 0; r < rings.length; r++) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = lakeR(a) * rings[r]; pos.push(lake.x + Math.cos(a) * lake.rx * k, 0, lake.z + Math.sin(a) * lake.rz * k); ed.push(1 - rings[r]); }
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = r * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new T.Float32BufferAttribute(ed, 1)); g.setIndex(idx);
    const wm = new T.ShaderMaterial({ uniforms: U, fog: false, side: T.DoubleSide, defines: tier > 0 ? { WAVES4: 1 } : {},
      vertexShader: 'attribute float aEdge; varying vec3 vW; varying float vE; void main(){ vE = aEdge; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: glsl.haze + `uniform vec3 uSkyT, uSkyH, uSunDir, uSunC, uLakeT, uLakeB; uniform float uTime, uNight, uLights; varying vec3 vW; varying float vE;
        void main(){ vec2 p = vW.xz; float t = uTime;
          vec2 gr = vec2(cos(p.x * 0.9 + t * 1.1), 0.0) * 0.05 + vec2(0.0, cos(p.y * 1.3 - t * 0.8)) * 0.04;
          #ifdef WAVES4
          gr += vec2(cos(dot(p, vec2(2.1, 1.7)) + t * 1.7)) * vec2(2.1, 1.7) * 0.012 + vec2(cos(dot(p, vec2(-3.3, 2.9)) - t * 2.3)) * vec2(-3.3, 2.9) * 0.007;
          #endif
          vec3 n = normalize(vec3(-gr.x, 1.0, -gr.y)), V = normalize(cameraPosition - vW); float fr = 0.05 + 0.55 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 R = reflect(-V, n); vec3 refl = mix(mix(uSkyH, uSkyT, 0.45) * 0.85, uSkyT, clamp(R.y * 1.6, 0.0, 1.0));
          vec3 deep = mix(uLakeT, uLakeB, smoothstep(0.05, 0.7, vE)); vec3 c = mix(deep, refl, fr);
          c += uSunC * pow(max(dot(R, uSunDir), 0.0), 180.0) * 2.5 * smoothstep(-0.05, 0.1, uSunDir.y);
          c = mix(c, vec3(0.62, 0.66, 0.6) * (1.0 - 0.75 * uNight), smoothstep(0.035, 0.0, vE) * 0.55);   // shoreline lap
          c = hazeIt(c, length(cameraPosition - vW)); gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    const wmesh = flat(g, wm, 0.035); wmesh.renderOrder = 1;
    // shore band
    const sp = [], sc = [], si = [], sand = new T.Color('#b5a888'), grass = new T.Color('#5d7f3e');
    for (let r = 0; r < 2; r++) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = lakeR(a) * (r ? 1.16 : 0.985); sp.push(lake.x + Math.cos(a) * lake.rx * k, 0, lake.z + Math.sin(a) * lake.rz * k); const c = r ? grass : sand; sc.push(c.r, c.g, c.b); }
    for (let i = 0; i < N; i++) { const a = i, b = (i + 1) % N; si.push(a, b, a + N, b, b + N, a + N); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(sc, 3)); sg.setAttribute('normal', new T.Float32BufferAttribute(sp.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(sp.flatMap((v, i) => (i % 3 === 1 ? [] : [v / 2.5])), 2)); sg.setIndex(si);
    mats.shore = LM({ vertexColors: true, map: tex.grain }); flat(sg, mats.shore, 0.008);
    const RB = Batch(); for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, k = lakeR(a) * (0.97 + rnd() * 0.08), s = 0.35 + rnd() * 0.9, gg = new T.IcosahedronGeometry(s, 1), pp = gg.attributes.position;
      for (let j = 0; j < pp.count; j++) { const f = 0.75 + rnd() * 0.4; pp.setXYZ(j, pp.getX(j) * f * 1.3, pp.getY(j) * f * 0.7, pp.getZ(j) * f); } gg.computeVertexNormals(); const gv = 0.42 + rnd() * 0.2;
      RB.geo(gg, new T.Color(gv, gv * 0.98, gv * 0.93).getHex(), lake.x + Math.cos(a) * lake.rx * k, s * 0.15, lake.z + Math.sin(a) * lake.rz * k, rnd() * 6); }
    RB.mesh(mats.vc);
    for (let zz = -lake.rz; zz < lake.rz; zz += 1.5) { const cz = zz + 0.75, f = Math.sqrt(Math.max(0, 1 - (cz / lake.rz) ** 2)) * 0.9; if (f > 0) col(lake.x - lake.rx * f, lake.z + zz, lake.x + lake.rx * f, lake.z + zz + 1.5); }
  }

  /* ---------- street lamps: merged poles + glowing heads + baked light pools; campus set now, town sets per chunk ---------- */
  function lamps(list, parent = root) { const P = Batch(), H = Batch(), G = Batch();
    for (const [x, z, ry, kind] of list) { if (kind === 'bollard') { P.cyl(0.09, 0.11, 0.9, '#2b2c31', x, 0.45, z); H.cyl(0.1, 0.1, 0.12, 0xffffff, x, 0.84, z); G.quad(3.2, 3.2, 0xffffff, x, 0.03, z); continue; }
      P.cyl(0.07, 0.11, 6, '#2b2c31', x, 3, z); P.box(1.3, 0.08, 0.1, '#2b2c31', x + Math.sin(ry) * 0.6, 5.95, z + Math.cos(ry) * 0.6, ry + Math.PI / 2); P.box(0.4, 0.3, 0.4, '#2b2c31', x, 0.15, z);
      H.box(0.55, 0.1, 0.28, 0xffffff, x + Math.sin(ry) * 1.15, 5.88, z + Math.cos(ry) * 1.15, ry + Math.PI / 2); G.quad(9, 9, 0xffffff, x + Math.sin(ry) * 1.1, 0.04, z + Math.cos(ry) * 1.1);
      col(x - 0.2, z - 0.2, x + 0.2, z + 0.2); }
    for (const g of G.list) { const uv = g.attributes.uv, p = g.attributes.position; let mnx = 1e9, mnz = 1e9; for (let i = 0; i < p.count; i++) { mnx = Math.min(mnx, p.getX(i)); mnz = Math.min(mnz, p.getZ(i)); }
      let mxx = -1e9, mxz = -1e9; for (let i = 0; i < p.count; i++) { mxx = Math.max(mxx, p.getX(i)); mxz = Math.max(mxz, p.getZ(i)); } for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - mnx) / (mxx - mnx), (p.getZ(i) - mnz) / (mxz - mnz)); }
    const a = P.mesh(mats.vc, parent), b = H.mesh(mats.head, parent), c = G.mesh(mats.pool, parent); if (c) c.renderOrder = 3; return [a, b, c]; }
  { const L = []; for (let z = Z0 + 20; z < AVE - 8; z += 9) for (const s of [-1, 1]) L.push([X0 + s * 3.1, z, 0, 'bollard']);
    for (const [x, z, ry] of [[X0 - 11.5, Z0 + 15.5, Math.PI / 2], [X0 + 11.5, Z0 + 15.5, -Math.PI / 2], [X0 - 11.5, Z0 + 2.5, Math.PI / 2], [X0 + 11.5, Z0 + 2.5, -Math.PI / 2]]) L.push([x, z, ry]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, r = lakeR(a); L.push([lake.x + Math.cos(a) * (lake.rx * r + 6.2), lake.z + Math.sin(a) * (lake.rz * r + 6.2), 0, 'bollard']); }
    const PX0 = Math.max(X0 + 14, 14); for (const x of [PX0 + 4, PX0 + 17, PX0 + 30]) L.push([x, Z0 + 25, 0]);
    for (const a of [0, 1, 2, 3, 4, 5]) L.push([X0 - 7 + (a % 3) * 7, Z0 + 3.6, Math.PI, 'bollard']);
    lamps(L); }

  /* ---------- trees: 8-angle impostors baked from Poly Haven models (one instanced draw call) + blob shadows ---------- */
  const trees = []; const tree = (sp, x, z, k = rnd()) => { const S = SPECIES[sp], h = S.h[0] + (S.h[1] - S.h[0]) * k, sc = h / S.H; trees.push([x, z, sp, S.S * sc, rnd() * 6.283, 0.88 + rnd() * 0.2, S]); };
  { // around the lake (mixed), far shore fir stands, along the main walk + avenue, parking islands, campus edges, inside the dome
    for (let i = 0; i < 22; i++) { const a = rnd() * Math.PI * 2, r = lakeR(a), d = 8 + rnd() * 10; tree([0, 1, 2, 3, 5][i % 5], lake.x + Math.cos(a) * (lake.rx * r + d), lake.z + Math.sin(a) * (lake.rz * r + d)); }
    for (let i = 0; i < 16; i++) tree(4, X0 - 70 + rnd() * 60, Z0 + 50 + rnd() * 6);
    for (let z = Z0 + 22; z < AVE - 8; z += 10) { tree(2, X0 - 6.5, z); tree(3, X0 + 6.5, z + 5); }
    for (let x = -165; x <= 165; x += 15) { if (Math.abs(x - X0) < 6) continue; tree(x % 2 ? 0 : 1, x, AVE - 7.5); }
    const PX0 = Math.max(X0 + 14, 14); for (const x of [PX0 + 10, PX0 + 24]) tree(1, x, Z0 + 25);
    for (const [x, z] of [[X0 - 10.5, Z0 + 21], [X0 + 10.5, Z0 + 21]]) tree(5, x, z, 0.8);
    for (let i = 0; i < 26; i++) tree([4, 0, 3][i % 3], fx - 8 - rnd() * 40, fz - 30 + rnd() * (Z0 - fz + 20));
    for (let i = 0; i < 26; i++) tree([4, 2, 3, 0][i % 4], fX + 46 + rnd() * 60, fz - 30 + rnd() * (Z0 - fz + 70));
    for (let i = 0; i < 20; i++) tree([4, 0][i % 2], fx + rnd() * (fX - fx), fz - 12 - rnd() * 20);
    if (shell.dome) for (let i = 0; i < 5; i++) { const a = i * 1.3, r = 3 + (i % 3) * 3; tree([1, 2, 5][i % 3], shell.dome.x + Math.cos(a) * r, shell.dome.z + Math.sin(a) * r, 0.3); } }
  const treeMesh = { mesh: null, n: trees.length, blob: null };
  { const base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const ip = new Float32Array(trees.length * 3), id = new Float32Array(trees.length * 4);
    trees.forEach(([x, z, sp, S, rot, tv], i) => { ip.set([x, 0, z], i * 3); id.set([S, sp, rot, tv], i * 4); });
    g.setAttribute('iPos', new T.InstancedBufferAttribute(ip, 3)); g.setAttribute('iData', new T.InstancedBufferAttribute(id, 4)); g.instanceCount = trees.length;
    const tm = new T.ShaderMaterial({ uniforms: { ...U, uMap: { value: null }, uFlip: { value: 0 }, uFar: { value: tier > 0 ? 125 : 90 } }, fog: false, side: T.DoubleSide,
      vertexShader: `attribute vec3 iPos; attribute vec4 iData; uniform float uFar; varying vec2 vA, vB; varying float vW, vD, vT;
        void main(){ float S = iData.x; vec2 d = cameraPosition.xz - iPos.xz; float dist = length(d); d /= max(dist, 1e-3); vD = dist; vT = iData.w;
          vec3 right = vec3(d.y, 0.0, -d.x); vec3 w = iPos + right * (position.x * S) + vec3(0.0, (position.y + 0.5 - ${BASE.toFixed(2)}) * S, 0.0);
          float f = mod((atan(d.x, d.y) - iData.z) / 6.2831853 * ${FR}.0 + ${FR * 4}.0, ${FR}.0); float f0 = floor(f); vW = f - f0; float f1 = mod(f0 + 1.0, ${FR}.0);
          vec2 uv = position.xy + 0.5; float row = iData.y;
          vA = vec2((f0 + uv.x) / ${FR}.0, (row + 1.0 - uv.y) / ${SPECIES.length}.0); vB = vec2((f1 + uv.x) / ${FR}.0, vA.y);
          gl_Position = dist > uFar ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: glsl.haze + `uniform sampler2D uMap; uniform float uFlip; uniform vec3 uTint; varying vec2 vA, vB; varying float vW, vD, vT;
        void main(){ vec2 a = vA, b = vB; if (uFlip > 0.5) { a.y = 1.0 - a.y; b.y = 1.0 - b.y; }
          vec4 c = mix(texture2D(uMap, a), texture2D(uMap, b), vW); if (c.a < 0.45) discard;
          vec3 col = c.rgb * uTint * vT * 1.08; col = hazeIt(col, vD); gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }` });
    const mesh = new T.Mesh(g, tm); mesh.frustumCulled = false; mesh.userData.noCollide = 1; mesh.visible = false; root.add(mesh); treeMesh.mesh = mesh;
    const loadAtlas = lo => { const ktx = ktxL(ctx.renderer);
      ktx.load(A + (lo ? 'trees_atlas_lo.ktx2' : 'trees_atlas.ktx2'), t => { t.colorSpace = T.SRGBColorSpace; t.flipY = false; tm.uniforms.uMap.value = t; tm.uniforms.uFlip.value = 0; mesh.visible = true; ctx.extInfo.atlas = lo ? 'ktx2-lo' : 'ktx2'; },
        undefined, () => new T.TextureLoader().load(A + 'trees_atlas_lo.webp', t => { t.colorSpace = T.SRGBColorSpace; tm.uniforms.uMap.value = t; tm.uniforms.uFlip.value = 1; mesh.visible = true; ctx.extInfo.atlas = 'webp-lo'; })); };
    treeMesh.load = loadAtlas; treeMesh.mat = tm;
    const bl = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.blob, trees.length); trees.forEach(([x, z, sp, S, , , Sp], i) => { const r = Math.min(S * 0.5, Sp.h[1] * 0.45); bl.setMatrixAt(i, m4.compose(v3.set(x, 0.03, z), q4.identity(), s3.set(r, 1, r))); });
    bl.userData.noCollide = 1; bl.renderOrder = 2; root.add(bl); treeMesh.blob = bl;
    for (const [x, z, sp] of trees) if (sp !== 5 || true) col(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }

  /* ---------- shrubs: real Poly Haven GLBs (decimated, KTX2 + Draco), instanced in the plaza planters + along the facade ---------- */
  const shrubSpots = [];
  for (const sx of [-1, 1]) for (const zz of [6, 12]) for (const k of [-1.4, 0, 1.4]) shrubSpots.push([X0 + sx * 8.2 + k, Z0 + zz, 0.55, ['shrub_04', 'shrub_03', 'shrub_04'][(k + 1.4) / 1.4 | 0]]);
  for (let x = fx + 2; x < fX - 2; x += 3.2) { if (Math.abs(x - X0) < EN.w / 2 + 2 || (shell.tower && x > shell.tower[0] - 1 && x < shell.tower[1] + 1)) continue; shrubSpots.push([x, Z0 + 1.1, 0, ['shrub_04', 'shrub_03'][Math.abs(Math.round(x)) % 2]]); }
  function loadShrubs() { const L = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(ktxL(ctx.renderer));
    for (const id of ['shrub_03', 'shrub_04']) { const spots = shrubSpots.filter(s => s[3] === id); if (!spots.length) continue;
      L.load(A + id + '.glb?v=1', gl => { gl.animations.length = 0; gl.scene.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(gl.scene), sz = bb.getSize(new T.Vector3()), want = id === 'shrub_03' ? 0.7 : 1.1, k = want / Math.max(sz.y, 0.01);
        gl.scene.traverse(o => { if (!o.isMesh) return; const M0 = o.material, mat = LM({ map: M0.map, color: M0.color, alphaTest: 0.5, side: T.DoubleSide });
          const im = new T.InstancedMesh(o.geometry, mat, spots.length); spots.forEach(([x, z, y], i) => { const s = k * (0.85 + rnd() * 0.3); im.setMatrixAt(i, new T.Matrix4().compose(v3.set(x, y - bb.min.y * s, z), q4.setFromEuler(e3.set(0, rnd() * 6.28, 0)), s3.set(s, s, s)).multiply(o.matrixWorld)); });
          im.userData.noCollide = 1; im.computeBoundingSphere(); root.add(im); }); ctx.extInfo.shrubs = (ctx.extInfo.shrubs || 0) + spots.length; }); } }

  /* ---------- town reserve: road grid + empty numbered lot pads, built lazily per block chunk ---------- */
  const XS = [-162.5, -97.5, -32.5, 32.5, 97.5, 162.5], ZS = [0, 1, 2, 3, 4].map(k => AVE + k * 65), RW = 10, SW = 2.5;
  const lotTex = canvas(1024, 1024, (g) => { g.fillStyle = '#1d1c22'; g.fillRect(0, 0, 1024, 1024); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let n = 0; n < 128; n++) { const cx = (n % 8) * 128, cy = (n / 8 | 0) * 64; g.strokeStyle = '#d9b45a'; g.lineWidth = 3; g.strokeRect(cx + 3, cy + 3, 122, 58); g.fillStyle = '#e9dcc0'; g.font = '700 26px Inter, system-ui, sans-serif'; g.fillText('LOT ' + String(n + 1).padStart(2, '0'), cx + 64, cy + 24); g.fillStyle = '#d9b45a'; g.font = '600 13px Inter, system-ui, sans-serif'; g.fillText('ELDERVERSE TOWN', cx + 64, cy + 47); } });
  lotTex.wrapS = lotTex.wrapT = T.ClampToEdgeWrapping; mats.lot = LM({ map: lotTex, emissive: 0xffffff, emissiveMap: lotTex, emissiveIntensity: 0.05 });
  const chunks = [];
  for (let k = 0; k < ZS.length - 1; k++) for (let j = 0; j < XS.length - 1; j++) chunks.push({ k, j, x0: XS[j], x1: XS[j + 1], z0: ZS[k], z1: ZS[k + 1], built: false, g: null });
  /* town layout for the live world (modules/world-live): lot n (1-based, same as the plates) -> centre, size, street side */
  ctx.town = { AVE, XS, ZS, RW, SW, X0, Z0, lots: [] };
  for (const c of chunks) { const h = RW / 2, bx0 = c.x0 + h, bx1 = c.x1 - h, bz0 = c.z0 + h, bz1 = c.z1 - h, iw = (bx1 - bx0) - 2 * SW, idp = (bz1 - bz0) - 2 * SW, lw = (iw - 3) / 2, ld = (idp - 3) / 2;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const n = (c.k * (XS.length - 1) + c.j) * 4 + a * 2 + b; ctx.town.lots[n] = { n: n + 1, cx: bx0 + SW + 1 + lw / 2 + a * (lw + 1), cz: bz0 + SW + 1 + ld / 2 + b * (ld + 1), w: lw, d: ld, face: b === 0 ? -1 : 1, chunk: c }; } }
  function buildChunk(c) { const g = new T.Group(); g.userData.keep = 1; root.add(g); c.g = g; c.built = true; const B = Batch(), S = Batch(), L = [], asph = '#34363b', walk = '#bdb7ab', curb = '#8f8a80';
    const road = (x0, z0, x1, z1, horiz) => { B.quad(x1 - x0, z1 - z0, asph, (x0 + x1) / 2, 0.022, (z0 + z1) / 2);
      if (horiz) { for (let x = x0 + 2; x < x1 - 2; x += 6) B.quad(2.6, 0.16, '#e6dfcc', x + 1.3, 0.03, (z0 + z1) / 2); }
      else { for (let z = z0 + 2; z < z1 - 2; z += 6) B.quad(0.16, 2.6, '#e6dfcc', (x0 + x1) / 2, 0.03, z + 1.3); } };
    const { x0, x1, z0, z1 } = c, h = RW / 2;
    road(x0 - h, z0 - h, x1 + h, z0 + h, true); road(x0 - h, z0 + h, x0 + h, z1 - h, false);
    if (c.j === XS.length - 2) road(x1 - h, z0 + h, x1 + h, z1 - h, false); if (c.k === ZS.length - 2) road(x0 - h, z1 - h, x1 + h, z1 + h, true);
    // sidewalk ring with curbs, inner block lawn stays the campus lawn
    const bx0 = x0 + h, bx1 = x1 - h, bz0 = z0 + h, bz1 = z1 - h;
    for (const [a, b, cc, d] of [[bx0, bz0, bx1, bz0 + SW], [bx0, bz1 - SW, bx1, bz1], [bx0, bz0 + SW, bx0 + SW, bz1 - SW], [bx1 - SW, bz0 + SW, bx1, bz1 - SW]]) B.box(cc - a, 0.12, d - b, walk, (a + cc) / 2, 0.06, (b + d) / 2);
    for (const [a, b, cc, d] of [[bx0, bz0, bx1, bz0 + 0.25], [bx0, bz1 - 0.25, bx1, bz1], [bx0, bz0, bx0 + 0.25, bz1], [bx1 - 0.25, bz0, bx1, bz1]]) B.box(cc - a, 0.14, d - b, curb, (a + cc) / 2, 0.07, (b + d) / 2);
    // 2 x 2 empty lot pads, marked borders + corner stakes + a numbered plate facing the nearest street
    const iw = (bx1 - bx0) - 2 * SW, idp = (bz1 - bz0) - 2 * SW, lw = (iw - 3) / 2, ld = (idp - 3) / 2;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const n = ((c.k * (XS.length - 1) + c.j) * 4 + a * 2 + b), cx = bx0 + SW + 1 + lw / 2 + a * (lw + 1), cz = bz0 + SW + 1 + ld / 2 + b * (ld + 1);
      B.box(lw, 0.08, ld, '#a9a395', cx, 0.04, cz); const bw = 0.25, gold = '#c9a24e';
      B.quad(lw - 0.6, bw, gold, cx, 0.085, cz - ld / 2 + 0.5); B.quad(lw - 0.6, bw, gold, cx, 0.085, cz + ld / 2 - 0.5); B.quad(bw, ld - 0.6, gold, cx - lw / 2 + 0.5, 0.085, cz); B.quad(bw, ld - 0.6, gold, cx + lw / 2 - 0.5, 0.085, cz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.12, 0.6, 0.12, '#e9e4d6', cx + sx * (lw / 2 - 0.3), 0.3, cz + sz * (ld / 2 - 0.3));
      const face = b === 0 ? -1 : 1, px = cx, pz = cz + face * (ld / 2 - 0.2); B.cyl(0.05, 0.05, 1.4, '#2b2c31', px - 0.5, 0.7, pz); B.cyl(0.05, 0.05, 1.4, '#2b2c31', px + 0.5, 0.7, pz);
      const pg = new T.PlaneGeometry(1.3, 0.65), uv = pg.attributes.uv, u0 = (n % 8) / 8, v0 = 1 - ((n / 8 | 0) + 1) / 16; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) / 16);
      const plate = new T.Mesh(pg, mats.lot); plate.position.set(px, 1.2, pz + face * 0.03); plate.rotation.y = face < 0 ? Math.PI : 0; plate.userData.noCollide = 1; g.add(plate) }
    // street lamps on EWS-owned streets: both sides, staggered every 22 m
    for (let x = x0 + 8; x < x1 - 6; x += 22) { L.push([x, z0 + h + 1.2, Math.PI]); L.push([x + 11, z0 - h - 1.2, 0]); }
    for (let z = z0 + 14; z < z1 - 6; z += 22) L.push([x0 + h + 1.2, z, -Math.PI / 2]);
    B.mesh(mats.vc, g); lamps(L, g); c.cx = (x0 + x1) / 2; c.cz = (z0 + z1) / 2; c.r = Math.hypot(x1 - x0, z1 - z0) / 2;
    ctx.extInfo.chunksBuilt = chunks.filter(q => q.built).length; }

  /* ---------- runtime: tiers, visibility, doors, fog swap, chunk streaming ---------- */
  const VIEW = [85, 110, 125]; let viewD = VIEW[tier] ?? 110, acc = 1, outdoors = false, doorOpen = 0; const indoorFog = new T.Color(), fogN = scene.fog ? scene.fog.near : 25, fogF = scene.fog ? scene.fog.far : 70;
  ctx.extInfo = { trees: trees.length, chunks: chunks.length, chunksBuilt: 0, chunksVisible: 0, tier };
  const setTier = t => { tier = t; viewD = VIEW[t] ?? 110; treeMesh.mat.uniforms.uFar.value = t > 0 ? 125 : 90; treeMesh.mesh.geometry.instanceCount = t > 0 ? trees.length : Math.ceil(trees.length * 0.6); ctx.extInfo.tier = t; };
  treeMesh.load(tier === 0); if (tier > 0) loadShrubs(); setTier(tier);
  const prevTier = ctx.tierChanged; ctx.tierChanged = t => { prevTier?.(t); setTier(t); };
  function dayNight(P, el, d) {
    const N = P.stars, Lt = P.lights; U.uSkyT.value.set(P.st); U.uSkyH.value.set(P.sh); U.uHazeC.value.set(P.sh).lerp(new T.Color(P.st), 0.3); U.uLakeT.value.set(P.lt); U.uLakeB.value.set(P.lb); U.uSunC.value.set(P.sc);
    U.uNight.value = N; U.uLights.value = Lt; U.uLit.value = Math.max(0.2, Math.min(1, 1 - 0.8 * N - (P.sun < 0.5 ? 0.12 * (1 - P.sun * 2) : 0)));
    U.uTint.value.setRGB(1, 1, 1).lerp(new T.Color(0.55, 0.65, 1.0), N * 0.6).multiplyScalar(U.uLit.value);
    const sol = ((d.getUTCHours() + d.getUTCMinutes() / 60 - 6) + 24) % 24, az = (180 + (sol - 12) * 15) * Math.PI / 180, e = el * Math.PI / 180;   // Memphis: solar time ~ UTC-6
    U.uSunDir.value.set(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)).normalize();
    mats.head.color.set(Lt > 0.3 ? '#ffd38c' : '#d6d0c2'); mats.pool.opacity = Lt * 0.85; mats.blob.opacity = 0.8 * (1 - N * 0.7);
    mats.facade.emissiveIntensity = 0.04 + Lt * 0.45; mats.crest.emissiveIntensity = 0.1 + Lt * 0.9; mats.sign.emissiveIntensity = 0.1 + Lt * 0.8; mats.lot.emissiveIntensity = 0.05 + Lt * 0.5; mats.domeGlass.emissiveIntensity = Lt * 0.35;
    sky.userData.stars.material.opacity = N; if (scene.fog) indoorFog.copy(scene.fog.color); ctx.extInfo.look = P.name; }
  const pDoor = new T.Vector3();
  function frame(dt, t, pos, cam) {
    U.uTime.value = t; sky.position.copy(cam.getWorldPosition(pDoor));
    const onG = !ctx.curFloor || ctx.curFloor === 'G'; outdoors = onG && (pos.z > Z0 + 0.2 || pos.x < fx - 0.2 || pos.x > fX + 0.2 || pos.z < fz - 0.2);
    const seen = onG && (outdoors || (Math.abs(pos.x - X0) < 34 && pos.z > Z0 - 26)); root.visible = seen; sky.visible = seen;
    if (scene.fog) { if (outdoors) { scene.fog.color.copy(U.uHazeC.value); scene.fog.near = 34; scene.fog.far = 118; } else if (scene.fog.near !== fogN) { scene.fog.color.copy(indoorFog); scene.fog.near = fogN; scene.fog.far = fogF; } }
    if (ctx.entranceDoors) { const near = onG && Math.abs(pos.x - X0) < 2.4 && Math.abs(pos.z - Z0) < 3.4; doorOpen += ((near ? 1 : 0) - doorOpen) * Math.min(1, dt * 5); for (const d of ctx.entranceDoors) d.g.position.x = d.sx * doorOpen * (d.w - 0.08); }
    acc += dt; if (acc < 0.3 || !seen) return; acc = 0; let nb = 0, nv = 0;
    for (const c of chunks) { const dx = Math.max(c.x0 - pos.x, 0, pos.x - c.x1), dz = Math.max(c.z0 - pos.z, 0, pos.z - c.z1), dd = Math.hypot(dx, dz);
      if (!c.built && dd < viewD + 25 && nb < 1) { buildChunk(c); nb++; } if (c.g) { c.g.visible = dd < viewD; if (c.g.visible) nv++; } }
    ctx.extInfo.chunksVisible = nv; ctx.extInfo.outdoors = outdoors; }
  return { bounds: BOUNDS, frame, dayNight, setTier, root, sky, info: () => ctx.extInfo, get outdoors() { return outdoors; } };
}
