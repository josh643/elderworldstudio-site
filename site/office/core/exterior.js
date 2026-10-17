// Elderverse exterior v2 (campus grounds + town reserve). Replaces the painted backdrop behind the lobby glass with real,
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
import { buildFacade } from './facade.js?v=2';

const A = '/office/assets/exterior/';
const SPECIES = [   // atlas row order (assets/exterior/trees_atlas.*): id, frame side S in model metres, model height H, target height range
  { id: 'jacaranda_tree', S: 25.394, H: 19.469, h: [9, 12] }, { id: 'island_tree_02', S: 4.376, H: 3.407, h: [5.5, 7.5] },
  { id: 'tree_small_02', S: 4.739, H: 4.557, h: [6, 8.5] }, { id: 'island_tree_01', S: 5.229, H: 5.027, h: [7, 9.5] },
  { id: 'fir_tree_01', S: 19.696, H: 18.939, h: [12, 16] }, { id: 'quiver_tree_02', S: 1.528, H: 1.469, h: [3.2, 4.4] }];
const FR = 8, BASE = 0.02;
let KTX = null; const ktxL = R => (KTX ||= new KTX2Loader().setTranscoderPath('/office/vendor/basis/').detectSupport(R));

export function build(ctx, shell) {
  const T = ctx.THREE, { scene } = ctx, { fx, fX, fz, fZ, EN } = shell, Z0 = fZ, X0 = EN ? EN.x : 0;
  const q = new URLSearchParams(location.search), XT = q.has('xtier') && !/elderworldstudio\.com$/.test(location.hostname) ? +q.get('xtier') : null; let tier = XT ?? ctx.tier;   /* ?xtier=N: QA-only exterior quality override (not on the public host) */
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const root = new T.Group(); root.name = 'exterior'; root.userData.keep = 1; root.userData.noFarCull = 1; scene.add(root);
  const sky = new T.Group(); sky.name = 'exterior-sky'; sky.userData.keep = 1; sky.userData.noFarCull = 1; scene.add(sky);
  const cols = (ctx.extraCols ||= []); const col = (x0, z0, x1, z1) => { const r = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]; cols.push(r); ctx.colliders?.push?.(r); };
  const BOUNDS = [-175, 175, fz - 36, Z0 + 330];
  if (XT != null) window.__ewsExt = { scene, root, sky, T, ctx };   /* QA hook, only with ?xtier */

  /* ---------- shared uniforms + material helpers ---------- */
  const U = { uHazeC: { value: new T.Color('#c9d6e2') }, uHazeN: { value: 55 }, uHazeF: { value: 118 }, uLit: { value: 1 }, uTime: { value: 0 },
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

  /* ---------- sky dome, stars, terrain hills (follow the camera; drawn late at the far plane: walls occlude them, open sky and real window openings show them) ---------- */
  { const sg = new T.SphereGeometry(100, 48, 24), sm = new T.ShaderMaterial({ uniforms: U, depthWrite: false, depthTest: true, side: T.BackSide, fog: false,
      defines: tier > 0 ? { CLOUDS: 1 } : {},
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.9999995; }',
      fragmentShader: `uniform vec3 uSkyT, uSkyH, uHazeC, uSunDir, uSunC; uniform float uNight, uTime; varying vec3 vD;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
        void main(){ vec3 d = normalize(vD); float y = d.y, yc = clamp(y, 0.0, 1.0);
          vec3 c = mix(uSkyH, uSkyT, 1.0 - pow(1.0 - yc, 3.0));                       // smooth zenith-horizon curve
          vec3 glow = mix(vec3(0.95, 0.82, 0.66), vec3(0.32, 0.22, 0.30), uNight);      // horizon glow: haze by day, warm town glow at night
          c += glow * exp(-max(y, 0.0) * 9.0) * mix(0.12, 0.16, uNight);
          float sd = dot(d, uSunDir), up = smoothstep(-0.12, 0.05, uSunDir.y);
          c += uSunC * (smoothstep(0.9993, 0.9997, sd) * 2.0 + pow(max(sd, 0.0), 32.0) * 0.4 + pow(max(sd, 0.0), 4.0) * 0.12) * up;
          float md = dot(d, -uSunDir); c += vec3(0.85, 0.88, 1.0) * (smoothstep(0.9992, 0.9996, md) * 1.4 + pow(max(md, 0.0), 60.0) * 0.12) * uNight;
          #ifdef CLOUDS
          if (y > 0.0) { vec2 p = d.xz / (y + 0.12) * 0.9 + vec2(uTime * 0.003, uTime * 0.001); float n = fbm(p);
            float cl = smoothstep(0.5, 0.82, n) * smoothstep(0.0, 0.3, y); float lit = clamp(0.55 + 0.45 * dot(normalize(vec3(d.x, 0.3, d.z)), uSunDir), 0.0, 1.0);
            vec3 cc = mix(uSkyH * 0.85, vec3(1.0, 0.97, 0.93), lit) * (1.0 - 0.9 * uNight) + vec3(0.07, 0.08, 0.11) * uNight;
            float gold = (1.0 - smoothstep(0.05, 0.45, uSunDir.y)) * smoothstep(-0.2, 0.0, uSunDir.y); cc = mix(cc, uSunC * vec3(1.1, 0.8, 0.66) + vec3(0.1, 0.04, 0.07), gold * (0.35 + 0.5 * lit));
            c = mix(c, cc, cl * mix(0.7, 0.45, uNight)); }
          #endif
          c = mix(c, uHazeC, smoothstep(0.06, -0.04, y));
          c += (h2(gl_FragCoord.xy + fract(uTime)) - 0.5) / 160.0;                      // dither: no gradient banding
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    const dome = new T.Mesh(sg, sm); dome.renderOrder = 12; dome.frustumCulled = false; sky.add(dome);
    const N = tier > 0 ? 900 : 450, sp = new Float32Array(N * 3), sb = new Float32Array(N); for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, y = 0.06 + Math.pow(rnd(), 0.7) * 0.94, r = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * r * 95, y * 95, Math.sin(a) * r * 95], i * 3); sb[i] = Math.pow(rnd(), 3); }
    const stg = new T.BufferGeometry(); stg.setAttribute('position', new T.BufferAttribute(sp, 3)); stg.setAttribute('aB', new T.BufferAttribute(sb, 1));
    const stars = new T.Points(stg, new T.ShaderMaterial({ uniforms: U, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false,
      vertexShader: 'attribute float aB; uniform float uTime; varying float vB; void main(){ vB = aB * (0.75 + 0.25 * sin(uTime * (1.0 + aB * 3.0) + position.x)); gl_PointSize = 1.0 + aB * 2.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999995; }',
      fragmentShader: 'uniform float uNight; varying float vB; void main(){ vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(q)); gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * (0.25 + vB) * a * uNight, 1.0); }' }));
    stars.renderOrder = 12.5; stars.frustumCulled = false; sky.add(stars); sky.userData.stars = stars;
    // terrain hills: two ring bands of real height-field geometry (forest + meadow texture in the shader, sun/hemisphere lit, aerial perspective)
    const hm = new T.ShaderMaterial({ uniforms: U, fog: false, depthWrite: false, depthTest: true,
      vertexShader: 'attribute float aF; varying vec3 vP, vN; varying float vF; void main(){ vP = position; vN = normal; vF = aF; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999995; }',
      fragmentShader: `uniform vec3 uHazeC, uSunDir, uSunC, uSkyT; uniform float uLit, uNight; varying vec3 vP, vN; varying float vF;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec3 n = normalize(vN); vec2 q = vec2(atan(vP.z, vP.x) * 60.0, vP.y * 0.9);
          float forest = smoothstep(0.42, 0.62, vn(q * 0.35) * 0.65 + vn(q * 1.3) * 0.35), speck = vn(q * 6.0);
          vec3 meadow = mix(vec3(0.36, 0.45, 0.22), vec3(0.47, 0.52, 0.27), vn(q * 0.8)), trees = mix(vec3(0.12, 0.2, 0.1), vec3(0.18, 0.27, 0.13), speck);
          vec3 alb = mix(meadow, trees, forest); float rock = smoothstep(0.75, 0.95, 1.0 - n.y) ; alb = mix(alb, vec3(0.38, 0.36, 0.33), rock * 0.6);
          float dif = max(dot(n, normalize(vec3(uSunDir.x, max(uSunDir.y, 0.15), uSunDir.z))), 0.0);
          vec3 c = alb * (uSunC * dif * 0.75 * smoothstep(-0.1, 0.1, uSunDir.y) + mix(vec3(0.42, 0.46, 0.5), vec3(0.16, 0.2, 0.32), uNight) * (0.55 + 0.45 * n.y)) * uLit * 1.25;
          c = mix(c, uHazeC, clamp(vF + (1.0 - smoothstep(0.0, 10.0, vP.y + 12.0)) * 0.1, 0.0, 0.95));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    const band = (r0, r1, amp, ph, fog, ord, segA = tier > 0 ? 360 : 200, rows = tier > 0 ? 14 : 8) => { const pos = [], af = [], idx = [];
      const H = (a, t) => { const ridge = (0.55 + 0.45 * Math.sin(a * 3 + ph)) * (0.6 + 0.4 * Math.sin(a * 7.3 + ph * 2)) + 0.35 * Math.abs(Math.sin(a * 13.1 + ph)) + 0.12 * Math.sin(a * 41 + ph * 3) + 0.05 * Math.sin(a * 97);
        return -12 + (amp * ridge + 12) * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) * (1 - 0.35 * t); };
      for (let i = 0; i <= segA; i++) for (let j = 0; j <= rows; j++) { const a = i / segA * Math.PI * 2, t = j / rows, r = r0 + (r1 - r0) * t; pos.push(Math.cos(a) * r, H(a, t), Math.sin(a) * r); af.push(fog + t * 0.12); }
      for (let j = rows - 1; j >= 0; j--) for (let i = 0; i < segA; i++) { const k = i * (rows + 1) + j, k2 = k + rows + 1; idx.push(k, k2, k + 1, k + 1, k2, k2 + 1); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aF', new T.Float32BufferAttribute(af, 1)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, hm); m.material.side = T.DoubleSide; m.renderOrder = ord; m.frustumCulled = false; sky.add(m); return m; };
    band(96, 99.5, 15, 3.1, 0.62, 13); band(84, 93, 7, 7.7, 0.3, 14);   /* drawn after the sky, before the grounds (renderOrder 20+), behind everything */
  }
  /* window openings: wherever a kit.windowPane hole marked the stencil, reset depth to the far plane so sky + grounds draw through it */
  { const q = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ colorWrite: false, depthWrite: true, depthTest: true, depthFunc: T.AlwaysDepth,
      stencilWrite: true, stencilRef: 1, stencilFunc: T.EqualStencilFunc, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }' }));
    q.frustumCulled = false; q.renderOrder = 11; q.userData.noCollide = 1; q.userData.keep = 1; scene.add(q); }

  /* ---------- ground: one lawn mesh with baked macro variation + AO near the building ---------- */
  { const W = BOUNDS[1] - BOUNDS[0] + 40, D = BOUNDS[3] - BOUNDS[2] + 40, g = new T.PlaneGeometry(W, D, 96, 110).rotateX(-Math.PI / 2); g.translate((BOUNDS[0] + BOUNDS[1]) / 2, 0, (BOUNDS[2] + BOUNDS[3]) / 2);
    const p = g.attributes.position, c = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), A1 = new T.Color('#5d7f3e'), A2 = new T.Color('#7a9448'), A3 = new T.Color('#4e6e3a'), tc = new T.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), n = 0.5 + 0.25 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) + 0.25 * Math.sin(z * 0.11 - x * 0.03);
      tc.copy(A1).lerp(A2, n); if (Math.sin(x * 0.31) * Math.sin(z * 0.27) > 0.6) tc.lerp(A3, 0.5);
      const dx = Math.max(fx - x, 0, x - fX), dz = Math.max(fz - z, 0, z - Z0), dB = Math.hypot(dx, dz); if (dB < 3) tc.multiplyScalar(0.72 + 0.28 * dB / 3);   // baked AO at the facade base
      c.set([tc.r, tc.g, tc.b], i * 3); uv.set([x / 2.5, z / 2.5], i * 2); }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); flat(g, mats.lawn, -0.012); }

  /* ---------- campus hardscape (one merged mesh): plaza, paths, parking, driveway, planters, benches, monument sign ---------- */
  const lake = { x: X0 - 12, z: Z0 + 38, rx: 26, rz: 11 }; const lakeR = a => 1 + 0.1 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2.2);
  const lakeK = (x, z) => { const dx = (x - lake.x) / lake.rx, dz = (z - lake.z) / lake.rz; return Math.hypot(dx, dz) / lakeR(Math.atan2(dz, dx)); };   // <1 = water, 1.16 = shore edge
  const AVE = Z0 + 62;   // the campus avenue = first street of the town grid
  const XS = [-162.5, -97.5, -32.5, 32.5, 97.5, 162.5], ZS = [0, 1, 2, 3, 4].map(k => AVE + k * 65), RW = 10, SW = 2.5;
  const PX0 = X0 + 29, PX1 = PX0 + 34, PZ0 = Z0 + 8, PZ1 = Z0 + 42;
  const BR = { x0: X0 - 1.9, x1: X0 + 1.9 }; { let a = Z0 + 16, b = AVE - 6; for (let z = Z0 + 16; z < AVE - 6; z += 0.25) if (lakeK(X0 - 2, z) < 1.2 || lakeK(X0 + 2, z) < 1.2) { a = Math.max(a, z); break; } BR.z0 = a - 1.5;
    for (let z = AVE - 6; z > Z0 + 16; z -= 0.25) if (lakeK(X0 - 2, z) < 1.2 || lakeK(X0 + 2, z) < 1.2) { b = z; break; } BR.z1 = b + 1.5; }
  /* paving + clearance: no tree may stand on (or within 2.5 m of) any of these */
  const PAVE = [[X0 - 11.5, Z0 - 0.5, X0 + 11.5, Z0 + 16.5], [X0 - 2.5, Z0 + 16, X0 + 2.5, AVE - 5], [PX0 - 0.5, PZ0 - 0.5, PX1 + 0.5, PZ1 + 0.5], [PX0 + 19, PZ1, PX0 + 25, AVE - 5],
    [fx - 1.5, fz - 1.5, fX + 1.5, Z0 + 1.6], [fX + 1, Z0 - 25, fX + 30, Z0 - 5], [X0 + 5, AVE - 10, X0 + 13, AVE - 8]];
  const clearOf = (x, z, r = 2.5) => { for (const [a, b, c, d] of PAVE) if (x > a - r && x < c + r && z > b - r && z < d + r) return false;
    const lk = lakeK(x, z); if (lk < 1.25 + r / 20) return false; const ring = (() => { const dx = (x - lake.x), dz = (z - lake.z), a = Math.atan2(dz / lake.rz, dx / lake.rx), R = lakeR(a); const px = lake.x + Math.cos(a) * (lake.rx * R + 4.5), pz = lake.z + Math.sin(a) * (lake.rz * R + 4.5); return Math.hypot(x - px, z - pz); })();
    if (ring < 1.2 + r) return false; if (shell.dome && Math.hypot(x - shell.dome.x, z - shell.dome.z) < shell.dome.r + r) return false;
    if (z > AVE - 5 - r) { for (const xr of XS) if (Math.abs(x - xr) < RW / 2 + SW + r) return false; for (const zr of ZS) if (Math.abs(z - zr) < RW / 2 + SW + r) return false; }
    return x > BOUNDS[0] + 3 && x < BOUNDS[1] - 3 && z > BOUNDS[2] + 3 && z < BOUNDS[3] - 3; };
  { const B = Batch(), P = Batch(), conc = '#c4beb2', curb = '#9d978c', dark = '#2f3136', brass = '#b08d3c', wood = '#7b5a3c', woodD = '#5a4030';
    P.quad(22, 16, 0xffffff, X0, 0.012, Z0 + 8);                                                          // plaza pavers (own textured material)
    B.quad(5, BR.z0 - (Z0 + 16), conc, X0, 0.016, (Z0 + 16 + BR.z0) / 2); B.quad(5, AVE - 6 - BR.z1, conc, X0, 0.016, (BR.z1 + AVE - 6) / 2);   // main walk, split by the bridge
    for (const sx of [-1, 1]) { B.box(0.18, 0.12, BR.z0 - (Z0 + 16), curb, X0 + sx * 2.55, 0.06, (Z0 + 16 + BR.z0) / 2); B.box(0.18, 0.12, AVE - 6 - BR.z1, curb, X0 + sx * 2.55, 0.06, (BR.z1 + AVE - 6) / 2); }
    // timber boardwalk bridge over the lake on the main axis: planks, stringers, posts, handrails
    { const L = BR.z1 - BR.z0, cz = (BR.z0 + BR.z1) / 2; for (let z = BR.z0 + 0.16; z < BR.z1; z += 0.31) B.box(3.8, 0.06, 0.27, ((z * 7) | 0) % 3 ? wood : '#86644a', X0, 0.15, z);
      for (const sx of [-1, 1]) { B.box(0.16, 0.22, L, woodD, X0 + sx * 1.82, 0.08, cz); B.box(0.1, 0.06, L, woodD, X0 + sx * 1.86, 1.02, cz); B.box(0.05, 0.05, L, woodD, X0 + sx * 1.86, 0.55, cz);
        for (let z = BR.z0 + 0.2; z <= BR.z1; z += 2.1) B.box(0.12, 1.0, 0.12, woodD, X0 + sx * 1.86, 0.52, z); col(X0 + sx * 1.86 - 0.08, BR.z0, X0 + sx * 1.86 + 0.08, BR.z1); }
      for (let z = BR.z0 + 3; z < BR.z1 - 2; z += 4.2) for (const sx of [-1, 1]) B.cyl(0.12, 0.12, 0.9, woodD, X0 + sx * 1.6, -0.3, z, 8); }   // piles into the water
    // lake loop path (ribbon ~4.5 m out from the shore) with a soft edge strip
    { const pts = [], N = 120; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = lakeR(a); pts.push([lake.x + Math.cos(a) * (lake.rx * r + 4.5), lake.z + Math.sin(a) * (lake.rz * r + 4.5)]); }
      const pos = [], idx = []; for (let i = 0; i <= N; i++) { const [x, z] = pts[i % N], [x2, z2] = pts[(i + 1) % N], dx = x2 - x, dz = z2 - z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 1.2, nz = dx / l * 1.2; pos.push(x + nx, 0.017, z + nz, x - nx, 0.017, z - nz); if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.setAttribute('normal', new T.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); B.geo(g, '#cbbfa8', 0, 0, 0); }
    // parking (east), driveway to the avenue, stall lines, kerbs, two tree islands
    B.quad(PX1 - PX0, PZ1 - PZ0, dark, (PX0 + PX1) / 2, 0.02, (PZ0 + PZ1) / 2); B.quad(6, AVE - 5 - PZ1, dark, PX0 + 22, 0.02, (PZ1 + AVE - 5) / 2);
    for (const row of [PZ0 + 5.5, PZ1 - 5.5]) for (let x = PX0 + 1; x <= PX1 - 1; x += 2.7) B.quad(0.12, 5, '#e8e4da', x, 0.026, row);
    for (const [x0, x1, z] of [[PX0, PX1, PZ0], [PX0, PX1, PZ1]]) B.box(x1 - x0, 0.15, 0.3, curb, (x0 + x1) / 2, 0.075, z);
    for (const x of [PX0, PX1]) B.box(0.3, 0.15, PZ1 - PZ0, curb, x, 0.075, (PZ0 + PZ1) / 2);
    for (const x of [PX0 + 10, PX0 + 24]) { B.box(4, 0.16, 3, curb, x, 0.08, Z0 + 25); B.quad(3.6, 2.6, '#4f6e38', x, 0.165, Z0 + 25); }
    // plaza edge kerb + planters either side, benches by the lake path
    for (const sx of [-1, 1]) B.box(0.2, 0.14, 16.5, curb, X0 + sx * 11.1, 0.07, Z0 + 8.25);
    for (const sx of [-1, 1]) B.box(8.6, 0.14, 0.2, curb, X0 + sx * 6.8, 0.07, Z0 + 16.1);
    for (const sx of [-1, 1]) { for (const zz of [6, 12]) { B.box(4.2, 0.55, 1.6, '#6a645a', X0 + sx * 8.2, 0.275, Z0 + zz); B.box(4.3, 0.06, 1.7, '#8a847a', X0 + sx * 8.2, 0.58, Z0 + zz); B.quad(3.9, 1.3, '#3b2c20', X0 + sx * 8.2, 0.6, Z0 + zz); col(X0 + sx * 8.2 - 2.1, Z0 + zz - 0.8, X0 + sx * 8.2 + 2.1, Z0 + zz + 0.8); } }
    for (const [x, z, ry] of [[X0 - 9, Z0 + 21.5, 0.15], [X0 + 9, Z0 + 21.5, -0.15], [X0 - 30, Z0 + 22, 0.35]]) {
      B.box(1.8, 0.07, 0.5, '#7a5634', x, 0.46, z, ry); B.box(1.8, 0.4, 0.06, '#7a5634', x - Math.sin(ry) * 0.22, 0.7, z - Math.cos(ry) * 0.22, ry); for (const s of [-0.75, 0.75]) B.box(0.08, 0.44, 0.45, '#2a2a2e', x + Math.cos(ry) * s, 0.22, z - Math.sin(ry) * s, ry); col(x - 0.9, z - 0.5, x + 0.9, z + 0.5); }
    // monument sign by the main walk (two-sided text panel added below)
    B.box(7.4, 1.9, 0.7, '#2c2b31', X0 + 9, 0.95, AVE - 9); B.box(7.8, 0.25, 1.1, '#5d5a62', X0 + 9, 0.125, AVE - 9); col(X0 + 5.2, AVE - 9.6, X0 + 12.8, AVE - 8.4);
    B.mesh(mats.vc); P.mesh(mats.pav);
    const st = canvas(1024, 256, (g, w, h) => { g.fillStyle = '#1d1c22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b45a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      crest(g, 128, 128, 92); g.fillStyle = '#e9dcc0'; g.font = '600 78px Cinzel, Georgia, serif'; g.textBaseline = 'middle'; fitText(g, 'ELDER WORLD STUDIO', 250, 112, w - 290); g.font = '500 40px Inter, system-ui, sans-serif'; g.fillStyle = '#d9b45a'; fitText(g, 'INC  ·  CAMPUS', 252, 184, w - 290); });
    st.wrapS = st.wrapT = T.ClampToEdgeWrapping; const sm = LM({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.1 }); mats.sign = sm;
    for (const s of [1, -1]) { const pl = new T.Mesh(new T.PlaneGeometry(6.8, 1.7), sm); pl.position.set(X0 + 9, 1.0, AVE - 9 + s * 0.36); pl.rotation.y = s > 0 ? 0 : Math.PI; pl.userData.noCollide = 1; root.add(pl); }
  }
  function fitText(g, s, x, y, maxW) { const w = g.measureText(s).width; if (w <= maxW) { g.fillText(s, x, y); return; } g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(s, 0, 0); g.restore(); }
  function crest(g, cx, cy, r) {   // tree crest emblem: ringed tree (the campus vision board mark)
    g.save(); g.strokeStyle = '#e9dcc0'; g.fillStyle = '#e9dcc0'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.lineCap = 'round'; const br = (x, y, a, l, w, d) => { if (d === 0 || l < 2) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); br(x2, y2, a - 0.42, l * 0.72, w * 0.68, d - 1); br(x2, y2, a + 0.42, l * 0.72, w * 0.68, d - 1); };
    br(cx, cy + r * 0.62, -Math.PI / 2, r * 0.42, r * 0.11, 7); g.lineWidth = r * 0.05; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy + r * 0.62); g.quadraticCurveTo(cx + s * r * 0.3, cy + r * 0.66, cx + s * r * 0.55, cy + r * 0.72); g.stroke(); }
    g.restore(); }

  /* ---------- building facade, tree-crest tower, media wall, geodesic dome (core/facade.js) ---------- */
  buildFacade(ctx, { root, U, LM, Batch, canvas, crest, col, shell, rnd, tier, mats });

  /* ---------- lake: water shader (layered moving ripples, fresnel sky reflection, sun/moon glint, warm lamp + building
     glints at night, shoreline lap), sand/grass shore band, rocks, reed clumps; colliders keep you out except on the bridge ---------- */
  { const rings = [0, 0.3, 0.55, 0.72, 0.84, 0.92, 0.97, 1], N = 96, pos = [], ed = [], idx = [];
    for (let r = 0; r < rings.length; r++) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = lakeR(a) * rings[r]; pos.push(lake.x + Math.cos(a) * lake.rx * k, 0, lake.z + Math.sin(a) * lake.rz * k); ed.push(1 - rings[r]); }
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = r * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new T.Float32BufferAttribute(ed, 1)); g.setIndex(idx);
    const wm = new T.ShaderMaterial({ uniforms: { ...U, uBld: { value: new T.Vector3(X0, 6, Z0) } }, fog: false, side: T.DoubleSide, defines: tier > 0 ? { WAVES4: 1 } : {},
      vertexShader: 'attribute float aEdge; varying vec3 vW; varying float vE; void main(){ vE = aEdge; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: glsl.haze + `uniform vec3 uSkyT, uSkyH, uSunDir, uSunC, uLakeT, uLakeB, uBld; uniform float uTime, uNight, uLights; varying vec3 vW; varying float vE;
        void main(){ vec2 p = vW.xz; float t = uTime;
          vec2 gr = vec2(cos(p.x * 0.9 + p.y * 0.3 + t * 0.9), 0.0) * 0.045 + vec2(0.0, cos(p.y * 1.3 - p.x * 0.2 - t * 0.7)) * 0.035;
          #ifdef WAVES4
          gr += vec2(cos(dot(p, vec2(2.1, 1.7)) + t * 1.5)) * vec2(2.1, 1.7) * 0.011 + vec2(cos(dot(p, vec2(-3.3, 2.9)) - t * 2.1)) * vec2(-3.3, 2.9) * 0.006
              + vec2(cos(dot(p, vec2(6.1, -4.7)) + t * 2.9)) * vec2(6.1, -4.7) * 0.0025;
          #endif
          vec3 n = normalize(vec3(-gr.x, 1.0, -gr.y)), V = normalize(cameraPosition - vW); float ndv = max(dot(n, V), 0.0), fr = 0.03 + 0.6 * pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, n); vec3 refl = mix(uSkyH, uSkyT, clamp(pow(max(R.y, 0.0), 0.6), 0.0, 1.0));
          refl = mix(refl, mix(vec3(0.1, 0.15, 0.1), vec3(0.02, 0.03, 0.04), uNight), smoothstep(0.12, 0.0, R.y) * 0.75);         // far-shore treeline darkens the low reflection
          refl = mix(refl, refl * 0.55, smoothstep(0.3, 0.0, vE) * 0.5);
          vec3 deep = mix(uLakeT, uLakeB, smoothstep(0.05, 0.6, vE)); vec3 c = mix(deep, refl, fr);
          c += uSunC * pow(max(dot(R, uSunDir), 0.0), 220.0) * 3.0 * smoothstep(-0.05, 0.1, uSunDir.y);
          c += vec3(0.8, 0.85, 1.0) * pow(max(dot(R, -uSunDir), 0.0), 260.0) * 1.6 * uNight;                                  // moon glint
          vec3 toB = normalize(uBld - vW); c += vec3(1.0, 0.78, 0.5) * pow(max(dot(R, toB), 0.0), 18.0) * 0.35 * uLights;          // lit facade shimmering on the water
          c += vec3(1.0, 0.82, 0.55) * pow(max(dot(R, normalize(vec3(uBld.x - vW.x, 2.0, uBld.z + 30.0 - vW.z))), 0.0), 60.0) * 0.18 * uLights;
          c = mix(c, vec3(0.55, 0.58, 0.52) * (1.0 - 0.8 * uNight), smoothstep(0.03, 0.0, vE) * 0.5 * (0.6 + 0.4 * sin(t * 1.3 + p.x * 0.7 + p.y * 0.5)));   // lapping shoreline
          c = hazeIt(c, length(cameraPosition - vW)); gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }` });
    const wmesh = flat(g, wm, 0.035); wmesh.renderOrder = 1; mats.water = wm;
    // shore band: wet sand -> pebbles -> grass
    const sp = [], sc = [], si = [], K = [0.985, 1.05, 1.16], C3 = [new T.Color('#8f846b'), new T.Color('#a89a7c'), new T.Color('#5d7f3e')];
    for (let r = 0; r < 3; r++) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, k = lakeR(a) * K[r]; sp.push(lake.x + Math.cos(a) * lake.rx * k, r === 1 ? 0.02 : 0, lake.z + Math.sin(a) * lake.rz * k); const c = C3[r]; sc.push(c.r, c.g, c.b); }
    for (let r = 0; r < 2; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = r * N + (i + 1) % N; si.push(a, b, a + N, b, b + N, a + N); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(sc, 3)); sg.setAttribute('normal', new T.Float32BufferAttribute(sp.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(sp.flatMap((v, i) => (i % 3 === 1 ? [] : [v / 2.5])), 2)); sg.setIndex(si);
    mats.shore = LM({ vertexColors: true, map: tex.grain }); flat(sg, mats.shore, 0.008);
    const onBridge = (x, z, m = 3) => Math.abs(x - X0) < m && z > BR.z0 - 1 && z < BR.z1 + 1;
    const RB = Batch(); for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, k = lakeR(a) * (0.96 + rnd() * 0.09), s = 0.3 + rnd() * 0.85, x = lake.x + Math.cos(a) * lake.rx * k, z = lake.z + Math.sin(a) * lake.rz * k; if (onBridge(x, z, 3.5)) continue;
      const gg = new T.IcosahedronGeometry(s, 1), pp = gg.attributes.position;
      for (let j = 0; j < pp.count; j++) { const f = 0.75 + rnd() * 0.4; pp.setXYZ(j, pp.getX(j) * f * 1.3, pp.getY(j) * f * 0.7, pp.getZ(j) * f); } gg.computeVertexNormals(); const gv = 0.4 + rnd() * 0.2;
      RB.geo(gg, new T.Color(gv, gv * 0.98, gv * 0.93).getHex(), x, s * 0.15, z, rnd() * 6); }
    RB.mesh(mats.vc);
    // reeds: clumps of tapered blades + a few cattail heads, along ~40% of the shoreline, in the shallows
    const RD = Batch(); for (let i = 0; i < (tier > 0 ? 70 : 40); i++) { const a = (i / 70) * Math.PI * 2 + rnd() * 0.08; if (Math.sin(a * 2.3 + 1.1) < -0.15) continue;
      const k = lakeR(a) * (0.93 + rnd() * 0.07), cx = lake.x + Math.cos(a) * lake.rx * k, cz = lake.z + Math.sin(a) * lake.rz * k; if (onBridge(cx, cz, 4)) continue;
      for (let b = 0; b < 9; b++) { const h = 0.8 + rnd() * 0.9, w = 0.035 + rnd() * 0.02, bx = cx + (rnd() - 0.5) * 0.9, bz = cz + (rnd() - 0.5) * 0.9, lean = (rnd() - 0.5) * 0.35, ry = rnd() * 3.14;
        const bg = new T.BufferGeometry(); const P = [-w, 0, 0, w, 0, 0, lean * 0.5 - w * 0.5, h * 0.6, 0, lean * 0.5 + w * 0.5, h * 0.6, 0, lean, h, 0];
        bg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); bg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); bg.computeVertexNormals(); bg.setAttribute('normal', new T.Float32BufferAttribute([0, .7, .7, 0, .7, .7, 0, .7, .7, 0, .7, .7, 0, .7, .7], 3));
        const gc = new T.Color().setHSL(0.2 + rnd() * 0.05, 0.35 + rnd() * 0.2, 0.26 + rnd() * 0.12); RD.geo(bg.toNonIndexed(), gc.getHex(), bx, 0.02, bz, ry);
        if (b % 4 === 0) RD.cyl(0.03, 0.03, 0.18, '#5a3a22', bx + lean * 0.8, h * 0.85, bz, 5); } }
    mats.reed = LM({ vertexColors: true, side: T.DoubleSide }); RD.mesh(mats.reed);
    for (let zz = -lake.rz * 1.15; zz < lake.rz * 1.15; zz += 1.2) { const z0 = lake.z + zz, z1 = z0 + 1.2; let xa = null;
      for (let x = lake.x - lake.rx * 1.2; x <= lake.x + lake.rx * 1.2 + 0.5; x += 0.5) { const w = (lakeK(x, z0) < 0.97 || lakeK(x, z1) < 0.97) && !(Math.abs(x - X0) < 1.75 && z0 > BR.z0 - 2); if (w && xa === null) xa = x; if ((!w || x > lake.x + lake.rx * 1.2) && xa !== null) { col(xa, z0, x, z1); xa = null; } } }
  }

  /* ---------- street lamps: one real lamp-post model (plinth, tapered pole, collars, curved arm, hanging glass lantern), instanced per
     group: metal + glowing glass + baked light pool + soft halo = 4 draw calls per group, always upright ---------- */
  const LAMP = (() => { const B = Batch(), bronze = '#24262b', trim = '#3a3a3f';
    const lathe = (pts, c, y, seg = 14) => B.geo(new T.LatheGeometry(pts.map(([r, h]) => new T.Vector2(r, h)), seg), c, 0, y, 0);
    lathe([[0.001, 0], [0.24, 0], [0.24, 0.08], [0.2, 0.12], [0.19, 0.45], [0.15, 0.52], [0.11, 0.6], [0.001, 0.62]], bronze, 0);
    B.cyl(0.055, 0.085, 4.9, bronze, 0, 0.6 + 2.45, 0, 12); for (const y of [1.6, 4.2, 5.45]) B.cyl(0.085, 0.085, 0.07, trim, 0, y, 0, 12);
    lathe([[0.001, 0], [0.07, 0], [0.04, 0.22], [0.001, 0.3]], bronze, 5.5, 10);
    const arm = new T.QuadraticBezierCurve3(new T.Vector3(0, 5.2, 0), new T.Vector3(0.05, 5.9, 0), new T.Vector3(1.05, 5.82, 0)); B.geo(new T.TubeGeometry(arm, 14, 0.032, 6), bronze, 0, 0, 0);
    B.geo(new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(0.05, 4.95, 0), new T.Vector3(0.12, 5.45, 0), new T.Vector3(0.6, 5.62, 0)), 10, 0.018, 5), bronze, 0, 0, 0);   // brace
    B.cyl(0.012, 0.012, 0.16, bronze, 1.05, 5.74, 0, 4);                                                                    // hanger
    lathe([[0.001, 0.36], [0.27, 0.12], [0.24, 0.08], [0.17, 0.06], [0.17, 0.0]], bronze, 5.28, 6);                          // lantern cap
    lathe([[0.001, 0], [0.12, 0], [0.15, 0.05]], bronze, 5.0, 6);                                                             // lantern bottom
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; B.box(0.02, 0.32, 0.02, bronze, 1.05 + Math.cos(a) * 0.165, 5.18, Math.sin(a) * 0.165); }   // frame ribs
    const metal = B.list.splice(0).map(g => g.translate(-1.05, 0, 0)), gl = Batch(); gl.geo(new T.CylinderGeometry(0.16, 0.12, 0.3, 6, 1, true), 0xffffff, 0, 5.18, 0);
    const glass = gl.list.splice(0); return { metal: mergeGeometries(metal), glass: mergeGeometries(glass), headY: 5.18 }; })();
  for (const g of [LAMP.metal, LAMP.glass]) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  mats.lampGlass = new T.MeshBasicMaterial({ color: 0xe8e2d4, toneMapped: false, fog: false, side: T.DoubleSide });
  mats.halo = new T.PointsMaterial({ map: tex.glow, size: 2.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, toneMapped: false, fog: false });
  const poolGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const lampGroups = [];
  function lamps(list, parent = root) {   // list: [x, z, ry, kind] ; the lantern hangs at (x, z) + arm offset along ry (ry = direction the arm points)
    const posts = list.filter(l => l[3] !== 'bollard'), bol = list.filter(l => l[3] === 'bollard'), n = posts.length;
    const out = [];
    if (n) { const M = new T.InstancedMesh(LAMP.metal, mats.vc, n), G = new T.InstancedMesh(LAMP.glass, mats.lampGlass, n), P = new T.InstancedMesh(poolGeo, mats.pool, n), hp = new Float32Array(n * 3);
      posts.forEach(([x, z, ry], i) => { const hx = x + Math.sin(ry) * 1.05, hz = z + Math.cos(ry) * 1.05; m4.compose(v3.set(hx, 0, hz), q4.setFromEuler(e3.set(0, ry - Math.PI / 2, 0)), s3.set(1, 1, 1));
        // model: pole at local x = -1.05, lantern at the origin; rotate so the pole sits back toward (x, z)
        M.setMatrixAt(i, m4); G.setMatrixAt(i, m4); P.setMatrixAt(i, new T.Matrix4().compose(v3.set(hx, 0.045, hz), q4.identity(), s3.set(10, 1, 10)));
        hp.set([hx, LAMP.headY, hz], i * 3); col(x - 0.25, z - 0.25, x + 0.25, z + 0.25); });
      const H = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(hp, 3)), mats.halo);
      for (const o of [M, G, P, H]) { o.userData.noCollide = 1; o.computeBoundingSphere?.(); parent.add(o); out.push(o); } P.renderOrder = 3; H.renderOrder = 5; lampGroups.push(H); }
    if (bol.length) { const BB = Batch(), BG = Batch(), BP = Batch(); for (const [x, z] of bol) { BB.cyl(0.09, 0.12, 0.85, '#24262b', x, 0.425, z, 10); BB.cyl(0.11, 0.11, 0.06, '#3a3a3f', x, 0.88, z, 10); BG.cyl(0.085, 0.085, 0.16, 0xffffff, x, 0.76, z, 10); BP.quad(3.2, 3.2, 0xffffff, x, 0.04, z); }
      for (const g of BP.list) { const uv = g.attributes.uv, p = g.attributes.position; let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < p.count; i++) { a = Math.min(a, p.getX(i)); b = Math.min(b, p.getZ(i)); c = Math.max(c, p.getX(i)); d = Math.max(d, p.getZ(i)); } for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - a) / (c - a), (p.getZ(i) - b) / (d - b)); }
      out.push(BB.mesh(mats.vc, parent), BG.mesh(mats.lampGlass, parent)); const pm = BP.mesh(mats.pool, parent); pm.renderOrder = 3; out.push(pm); }
    return out; }
  { const L = [], RTP = Math.PI / 2;
    for (const [x, z, ry] of [[X0 - 11.5, Z0 + 15.6, RTP], [X0 + 11.5, Z0 + 15.6, -RTP], [X0 - 5.6, Z0 + 16.6, RTP], [X0 + 5.6, Z0 + 16.6, -RTP]]) L.push([x, z, ry]);   // plaza front (kept clear of the floors above)
    for (let z = Z0 + 22; z < AVE - 7; z += 13) { if (z > BR.z0 - 2 && z < BR.z1 + 2) continue; L.push([X0 + ((z / 13 | 0) % 2 ? -3.3 : 3.3), z, (z / 13 | 0) % 2 ? RTP : -RTP]); }
    for (const z of [BR.z0 - 0.6, BR.z1 + 0.6]) for (const s of [-1, 1]) L.push([X0 + s * 3.1, z, -s * RTP]);   // bridge ends
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.35, r = lakeR(a), x = lake.x + Math.cos(a) * (lake.rx * r + 6.6), z = lake.z + Math.sin(a) * (lake.rz * r + 6.6); if (Math.abs(x - X0) < 5 || !clearOf(x, z, 0.3)) continue; L.push([x, z, Math.atan2(lake.x - x, lake.z - z)]); }
    for (const x of [PX0 + 4, PX0 + 17, PX0 + 30]) L.push([x, Z0 + 25.2, 0]);
    lamps(L); }

  /* ---------- trees: real 3D Poly Haven models with LOD. Near (< R0): full mesh (~50k tris); mid (< 45 m): simplified mesh (~12k);
     far mid (< 82 m): light mesh (~2.6k) where available; beyond 80 m: 8-angle baked impostors (frame-blended, never a single
     camera-facing card). Instanced per species + part + level; buckets re-sorted 4x per second. Paving clearance enforced. ---------- */
  const trees = []; let firK = 0;
  const tree = (sp, x, z, k = rnd()) => { if (sp === 4) sp = [3, 0, 2][firK++ % 3];   /* fir has no 3D LOD (Blender ran out of memory): swapped for a 3D species */
    if (!clearOf(x, z)) return; const S = SPECIES[sp], h = S.h[0] + (S.h[1] - S.h[0]) * k, sc = h / S.H; trees.push([x, z, sp, S.S * sc, rnd() * 6.283, 0.88 + rnd() * 0.2, S, 0, sc]); };
  { // lake ring (mixed), west grove, along the main walk, parking islands, avenue verge, campus edges, inside the dome
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = lakeR(a), d = 8.5 + rnd() * 11; tree([0, 1, 2, 3, 5][i % 5], lake.x + Math.cos(a) * (lake.rx * r + d), lake.z + Math.sin(a) * (lake.rz * r + d)); }
    for (let i = 0; i < 18; i++) tree([3, 0, 2][i % 3], X0 - 120 + rnd() * 55, Z0 + 18 + rnd() * 34);
    for (let z = Z0 + 21; z < AVE - 8; z += 10) { tree(2, X0 - 6.5, z); tree(3, X0 + 6.5, z + 5); }
    for (let x = -165; x <= 165; x += 15) tree(x % 2 ? 0 : 1, x + (rnd() - 0.5) * 3, AVE - 9.5);
    for (const x of [PX0 + 10, PX0 + 24]) { const S = SPECIES[1], k = 0.5, sc = (S.h[0] + (S.h[1] - S.h[0]) * k) / S.H; trees.push([x, Z0 + 25, 1, S.S * sc, rnd() * 6.283, 0.95, S, 0, sc]); }
    for (let i = 0; i < 30; i++) tree([0, 3, 2][i % 3], fx - 8 - rnd() * 40, fz - 30 + rnd() * (Z0 - fz + 20));
    for (let i = 0; i < 30; i++) tree([2, 3, 0, 1][i % 4], fX + 34 + rnd() * 70, fz - 30 + rnd() * (Z0 - fz + 10));
    for (let i = 0; i < 22; i++) tree([0, 3][i % 2], fx + rnd() * (fX - fx), fz - 6 - rnd() * 24);
    if (shell.dome) for (let i = 0; i < 5; i++) { const a = i * 1.3, r = 3 + (i % 3) * 3, S = SPECIES[[1, 2, 5][i % 3]], sc = (S.h[0] + (S.h[1] - S.h[0]) * 0.3) / S.H; trees.push([shell.dome.x + Math.cos(a) * r, shell.dome.z + Math.sin(a) * r, [1, 2, 5][i % 3], S.S * sc, rnd() * 6.283, 0.95, S, 0, sc]); }
  }
  function townTree(x, z, h) { const sp = [1, 3, 2, 1][(h + Math.round(x)) & 3], S = SPECIES[sp], sc = (S.h[0] + (S.h[1] - S.h[0]) * (0.3 + 0.4 * rnd())) / S.H; trees.push([x, z, sp, S.S * sc, rnd() * 6.283, 0.92 + rnd() * 0.12, S, 0, sc]); }
  for (const [x, z] of trees) col(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  const treeMesh = { mesh: null, n: trees.length, blob: null };
  { const base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const ip = new Float32Array(trees.length * 3), id = new Float32Array(trees.length * 4);
    trees.forEach(([x, z, sp, S, rot, tv, , y], i) => { ip.set([x, y, z], i * 3); id.set([S, sp, rot, tv], i * 4); });
    g.setAttribute('iPos', new T.InstancedBufferAttribute(ip, 3)); g.setAttribute('iData', new T.InstancedBufferAttribute(id, 4)); g.instanceCount = trees.length;
    const tm = new T.ShaderMaterial({ uniforms: { ...U, uMap: { value: null }, uFlip: { value: 0 }, uFar: { value: tier > 0 ? 125 : 95 }, uNear: { value: 0 } }, fog: false, side: T.DoubleSide,
      vertexShader: `attribute vec3 iPos; attribute vec4 iData; uniform float uFar, uNear; varying vec2 vA, vB; varying float vW, vD, vT;
        void main(){ float S = iData.x; vec3 P = (modelMatrix * vec4(iPos, 1.0)).xyz; vec2 d = cameraPosition.xz - P.xz; float dist = length(d); d /= max(dist, 1e-3); vD = dist; vT = iData.w;
          vec3 right = vec3(d.y, 0.0, -d.x); vec3 w = P + right * (position.x * S) + vec3(0.0, (position.y + 0.5 - ${BASE.toFixed(2)}) * S, 0.0);
          float f = mod((atan(d.x, d.y) - iData.z) / 6.2831853 * ${FR}.0 + ${FR * 4}.0, ${FR}.0); float f0 = floor(f); vW = f - f0; float f1 = mod(f0 + 1.0, ${FR}.0);
          vec2 uv = position.xy + 0.5; float row = iData.y;
          vA = vec2((f0 + uv.x) / ${FR}.0, (row + 1.0 - uv.y) / ${SPECIES.length}.0); vB = vec2((f1 + uv.x) / ${FR}.0, vA.y);
          gl_Position = (dist > uFar || dist < uNear) ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
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
    const bl = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.blob, trees.length); trees.forEach(([x, z, sp, S, , , Sp, y], i) => { const r = Math.min(S * 0.5, Sp.h[1] * 0.45); bl.setMatrixAt(i, m4.compose(v3.set(x, y + 0.03, z), q4.identity(), s3.set(r, 1, r))); });
    bl.userData.noCollide = 1; bl.renderOrder = 2; root.add(bl); treeMesh.blob = bl; }
  /* 3D tree LODs */
  const T3 = { R: [22, 45, 82], ready: 0, want: 0, parts: [], mats: new Map() };   // parts: { sp, lvl, im }
  const treeMat = (M0, leaf) => { const key = M0.uuid; if (T3.mats.has(key)) return T3.mats.get(key);
    const m = LM({ map: M0.map, color: M0.color, alphaTest: leaf ? 0.5 : 0, side: leaf ? T.DoubleSide : T.FrontSide }); m.onBeforeCompile = ((ob) => sh => { ob(sh); sh.uniforms.uTint = U.uTint;
      sh.fragmentShader = 'uniform vec3 uTint;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), uTint / max(uLit, 0.2), 0.5);'); })(m.onBeforeCompile);
    m.customProgramCacheKey = () => 'ews-ext-tree'; T3.mats.set(key, m); return m; };
  const tMat = trees.map(([x, z, , , rot, , , y, sc]) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, rot, 0)), new T.Vector3(sc, sc, sc)));
  function load3D() { const L = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(ktxL(ctx.renderer));
    const ids = [...new Set(trees.map(t => t[2]))];
    for (const sp of ids) { const id = SPECIES[sp].id, cnt = trees.filter(t => t[2] === sp).length, lvls = tier > 0 ? [0, 1, 2] : [1, 2];
      for (const lvl of lvls) { T3.want++; const file = lvl === 2 ? `${id}_lod2.glb` : `${id}_lod${lvl}.glb`;
        L.load(A + 'trees/' + file + '?v=1', gl => { gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if (!o.isMesh) return; const leaf = /leaf|leaves|twig/i.test(o.material.name || '');
            const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); const im = new T.InstancedMesh(geo, treeMat(o.material, leaf), cnt); im.count = 0; im.frustumCulled = false; im.userData.noCollide = 1; im.renderOrder = 20; im.instanceMatrix.setUsage(T.DynamicDrawUsage);
            root.add(im); T3.parts.push({ sp, lvl, im }); }); T3.ready++; T3.dirty = 1; },
          undefined, () => { T3.ready++; T3.missing = (T3.missing || 0) + 1; T3.miss = T3.miss || {}; T3.miss[sp + ':' + lvl] = 1; T3.dirty = 1; }); } } }
  const tLvl = new Int8Array(trees.length).fill(-1);
  function treeLOD(lp) { if (!T3.want || T3.ready < T3.want) return; const R = tier > 0 ? T3.R : [0, 30, 82], has = (sp, l) => !T3.miss?.[sp + ':' + l] && T3.parts.some(p => p.sp === sp && p.lvl === l);
    let changed = T3.dirty; T3.dirty = 0;
    for (let i = 0; i < trees.length; i++) { const t = trees[i], d = Math.hypot(t[0] - lp.x, t[1] - lp.z); let l = d < R[0] ? 0 : d < R[1] ? 1 : d < R[2] ? 2 : 3;
      if (l === 2 && !has(t[2], 2)) l = 1; if (l === 0 && !has(t[2], 0)) l = 1; if (l === 1 && !has(t[2], 1)) l = has(t[2], 2) ? 2 : 3;
      if (tLvl[i] !== l) { tLvl[i] = l; changed = 1; } }
    if (!changed) return; let n3 = 0;
    for (const p of T3.parts) { let n = 0; for (let i = 0; i < trees.length; i++) if (tLvl[i] === p.lvl && trees[i][2] === p.sp) { tMat[i].toArray(p.im.instanceMatrix.array, n * 16); n++; }
      p.im.count = n; p.im.instanceMatrix.needsUpdate = true; n3 += n; }
    treeMesh.mat.uniforms.uNear.value = R[2] - 2; ctx.extInfo.trees3d = trees.filter((_, i) => tLvl[i] < 3).length; }

  /* ---------- shrubs: real Poly Haven GLBs (decimated, KTX2 + Draco), instanced in the plaza planters + along the facade ---------- */
  const shrubSpots = [];
  for (const sx of [-1, 1]) for (const zz of [6, 12]) for (const k of [-1.4, 0, 1.4]) shrubSpots.push([X0 + sx * 8.2 + k, Z0 + zz, 0.55, ['shrub_04', 'shrub_03', 'shrub_04'][(k + 1.4) / 1.4 | 0]]);
  for (let x = fx + 2; x < fX - 2; x += 3.2) { if (Math.abs(x - X0) < EN.w / 2 + 2 || (shell.tower && x > shell.tower[0] - 1 && x < shell.tower[1] + 1)) continue; shrubSpots.push([x, Z0 + 1.1, 0, ['shrub_04', 'shrub_03'][Math.abs(Math.round(x)) % 2]]); }
  function loadShrubs() { const L = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/office/vendor/draco/')).setKTX2Loader(ktxL(ctx.renderer));
    for (const id of ['shrub_03', 'shrub_04']) { const spots = shrubSpots.filter(s => s[3] === id); if (!spots.length) continue;
      L.load(A + id + '.glb?v=1', gl => { gl.animations.length = 0; gl.scene.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(gl.scene), sz = bb.getSize(new T.Vector3()), want = id === 'shrub_03' ? 0.7 : 1.1, k = want / Math.max(sz.y, 0.01);
        gl.scene.traverse(o => { if (!o.isMesh) return; const M0 = o.material, mat = LM({ map: M0.map, color: M0.color, alphaTest: 0.5, side: T.DoubleSide });
          const im = new T.InstancedMesh(o.geometry, mat, spots.length); spots.forEach(([x, z, y], i) => { const s = k * (0.85 + rnd() * 0.3); im.setMatrixAt(i, new T.Matrix4().compose(v3.set(x, y - bb.min.y * s, z), q4.setFromEuler(e3.set(0, rnd() * 6.28, 0)), s3.set(s, s, s)).multiply(o.matrixWorld)); });
          im.userData.noCollide = 1; im.renderOrder = 20; im.computeBoundingSphere(); root.add(im); }); ctx.extInfo.shrubs = (ctx.extInfo.shrubs || 0) + spots.length; }); } }

  /* ---------- town reserve: road grid, sidewalks + curbs, lawn lot pads with low kerbs and corner
     markers, and a framed post-and-panel sign per lot (stone plinth, bronze frame, inset panel: crest, LOT nn, AVAILABLE · LEASE,
     ELDERVERSE TOWN). Built lazily per block chunk. Street + lot layout unchanged (town redesign on hold for Joshua). ---------- */
  const lotTex = canvas(2048, 2048, (g) => { g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let n = 0; n < 96; n++) { const cx = (n % 8) * 256, cy = (n / 8 | 0) * 160, W = 256, H = 160;
      const gr = g.createLinearGradient(0, cy, 0, cy + H); gr.addColorStop(0, '#1f2a26'); gr.addColorStop(1, '#141b19'); g.fillStyle = gr; g.fillRect(cx, cy, W, H);
      g.strokeStyle = '#c9a24e'; g.lineWidth = 3; g.strokeRect(cx + 9, cy + 9, W - 18, H - 18); g.lineWidth = 1; g.strokeRect(cx + 14, cy + 14, W - 28, H - 28);
      g.save(); crest(g, cx + 50, cy + 62, 26); g.restore();
      g.fillStyle = '#efe4c8'; g.font = '700 44px Cinzel, Georgia, serif'; g.textAlign = 'left'; fitText(g, 'LOT ' + String(n + 1).padStart(2, '0'), cx + 88, cy + 60, W - 108);
      g.textAlign = 'center'; g.fillStyle = '#c9a24e'; g.fillRect(cx + 26, cy + 98, W - 52, 2);
      g.font = '700 19px Inter, system-ui, sans-serif'; g.fillStyle = '#9fe0b0'; fitText(g, 'AVAILABLE  ·  LEASE', cx + W / 2, cy + 117, W - 48);
      g.font = '600 14px Inter, system-ui, sans-serif'; g.fillStyle = '#d9c9a0'; fitText(g, 'ELDERVERSE TOWN', cx + W / 2, cy + 139, W - 48); }
    g.textAlign = 'left'; });
  lotTex.wrapS = lotTex.wrapT = T.ClampToEdgeWrapping; lotTex.anisotropy = tier > 0 ? 8 : 2; mats.lot = LM({ map: lotTex, emissive: 0xffffff, emissiveMap: lotTex, emissiveIntensity: 0.05 });
  const chunks = [];
  for (let k = 0; k < ZS.length - 1; k++) for (let j = 0; j < XS.length - 1; j++) chunks.push({ k, j, x0: XS[j], x1: XS[j + 1], z0: ZS[k], z1: ZS[k + 1], built: false, g: null });
  /* town layout for the live world (modules/world-live): lot n (1-based, same as the plates) -> centre, size, street side */
  ctx.town = { AVE, XS, ZS, RW, SW, X0, Z0, lots: [] };
  for (const c of chunks) { const h = RW / 2, bx0 = c.x0 + h, bx1 = c.x1 - h, bz0 = c.z0 + h, bz1 = c.z1 - h, iw = (bx1 - bx0) - 2 * SW, idp = (bz1 - bz0) - 2 * SW, lw = (iw - 3) / 2, ld = (idp - 3) / 2;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const n = (c.k * (XS.length - 1) + c.j) * 4 + a * 2 + b; ctx.town.lots[n] = { n: n + 1, cx: bx0 + SW + 1 + lw / 2 + a * (lw + 1), cz: bz0 + SW + 1 + ld / 2 + b * (ld + 1), w: lw, d: ld, face: b === 0 ? -1 : 1, chunk: c }; } }
  function buildChunk(c) { const g = new T.Group(); g.userData.keep = 1; root.add(g); c.g = g; c.built = true; const B = Batch(), L = [], asph = '#34363b', walk = '#bdb7ab', curb = '#8f8a80', stone = '#6d6860', bronze = '#3a2f22';
    const road = (x0, z0, x1, z1, horiz) => { B.quad(x1 - x0, z1 - z0, asph, (x0 + x1) / 2, 0.022, (z0 + z1) / 2);
      if (horiz) { for (let x = x0 + 2; x < x1 - 2; x += 6) B.quad(2.6, 0.16, '#e6dfcc', x + 1.3, 0.03, (z0 + z1) / 2); }
      else { for (let z = z0 + 2; z < z1 - 2; z += 6) B.quad(0.16, 2.6, '#e6dfcc', (x0 + x1) / 2, 0.03, z + 1.3); } };
    const { x0, x1, z0, z1 } = c, h = RW / 2;
    road(x0 - h, z0 - h, x1 + h, z0 + h, true); road(x0 - h, z0 + h, x0 + h, z1 - h, false);
    if (c.j === XS.length - 2) road(x1 - h, z0 + h, x1 + h, z1 - h, false); if (c.k === ZS.length - 2) road(x0 - h, z1 - h, x1 + h, z1 + h, true);
    // sidewalk ring (raised, curbed), then the lots
    const bx0 = x0 + h, bx1 = x1 - h, bz0 = z0 + h, bz1 = z1 - h;
    for (const [a, b, cc, d] of [[bx0, bz0, bx1, bz0 + SW], [bx0, bz1 - SW, bx1, bz1], [bx0, bz0 + SW, bx0 + SW, bz1 - SW], [bx1 - SW, bz0 + SW, bx1, bz1 - SW]]) B.box(cc - a, 0.12, d - b, walk, (a + cc) / 2, 0.06, (b + d) / 2);
    for (const [a, b, cc, d] of [[bx0, bz0, bx1, bz0 + 0.25], [bx0, bz1 - 0.25, bx1, bz1], [bx0, bz0, bx0 + 0.25, bz1], [bx1 - 0.25, bz0, bx1, bz1]]) B.box(cc - a, 0.15, d - b, curb, (a + cc) / 2, 0.075, (b + d) / 2);
    // 2 x 2 lots (same rects as before: the live world builds on them): mown lawn pad, low granite kerb, corner markers
    const iw = (bx1 - bx0) - 2 * SW, idp = (bz1 - bz0) - 2 * SW, lw = (iw - 3) / 2, ld = (idp - 3) / 2;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const n = ((c.k * (XS.length - 1) + c.j) * 4 + a * 2 + b), cx = bx0 + SW + 1 + lw / 2 + a * (lw + 1), cz = bz0 + SW + 1 + ld / 2 + b * (ld + 1);
      B.quad(lw - 0.4, ld - 0.4, ['#638646', '#5b7e40', '#68894a', '#5f8244'][n & 3], cx, 0.012, cz);
      for (const [w, d2, ox, oz] of [[lw, 0.2, 0, -ld / 2], [lw, 0.2, 0, ld / 2], [0.2, ld, -lw / 2, 0], [0.2, ld, lw / 2, 0]]) B.box(w, 0.1, d2, '#b9b2a4', cx + ox, 0.05, cz + oz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { B.box(0.22, 0.45, 0.22, '#d8d2c4', cx + sx * (lw / 2 - 0.25), 0.225, cz + sz * (ld / 2 - 0.25)); B.box(0.24, 0.06, 0.24, '#c9a24e', cx + sx * (lw / 2 - 0.25), 0.47, cz + sz * (ld / 2 - 0.25)); }
      // framed sign at the street edge of the lot
      const face = b === 0 ? -1 : 1, sx = cx, sz = cz + face * (ld / 2 - 1.1), ry = face < 0 ? Math.PI : 0;
      B.box(2.3, 0.45, 0.6, stone, sx, 0.225, sz, ry); B.box(2.45, 0.08, 0.7, '#857f74', sx, 0.49, sz, ry);
      for (const p of [-1.0, 1.0]) B.box(0.14, 1.6, 0.14, bronze, sx + p, 0.53 + 0.8, sz, ry);
      B.box(2.14, 0.1, 0.18, bronze, sx, 2.15, sz, ry); B.box(2.14, 0.08, 0.16, bronze, sx, 0.78, sz, ry); B.box(2.3, 0.06, 0.26, '#c9a24e', sx, 2.23, sz, ry);
      B.box(1.88, 1.3, 0.06, '#121816', sx, 1.46, sz, ry);
      const pg = new T.PlaneGeometry(1.8, 1.125), uv = pg.attributes.uv, u0 = (n % 8) / 8, v0 = 1 - ((n / 8 | 0) + 1) * 160 / 2048; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) * 160 / 2048);
      for (const s of [1, -1]) { const plate = new T.Mesh(pg, mats.lot); plate.position.set(sx, 1.46, sz + s * face * 0.035); plate.rotation.y = (s * face) < 0 ? Math.PI : 0; plate.userData.noCollide = 1; g.add(plate); }
      col(sx - 1.2, sz - 0.35, sx + 1.2, sz + 0.35); }
    // street lamps on EWS-owned streets: both sides, staggered every 22 m, on the sidewalk, arm over the road
    for (let x = x0 + 8; x < x1 - 6; x += 22) { L.push([x, z0 + h + 1.2, Math.PI]); L.push([x + 11, z0 - h - 1.2, 0]); }
    for (let z = z0 + 14; z < z1 - 6; z += 22) L.push([x0 + h + 1.2, z, -Math.PI / 2]);
    B.mesh(mats.vc, g); lamps(L, g); for (const o of g.children) o.renderOrder = Math.max(o.renderOrder, 0) + 20; c.cx = (x0 + x1) / 2; c.cz = (z0 + z1) / 2; c.r = Math.hypot(x1 - x0, z1 - z0) / 2;
    ctx.extInfo.chunksBuilt = chunks.filter(q => q.built).length; }

  /* ---------- runtime: tiers, floors (the exterior follows you upstairs at the right height), doors, fog swap, chunk + tree LOD streaming ---------- */
  const VIEW = [85, 110, 125], FH = 4.2; let viewD = VIEW[tier] ?? 110, acc = 1, accT = 1, outdoors = false, doorOpen = 0; const indoorFog = new T.Color(), fogN = scene.fog ? scene.fog.near : 25, fogF = scene.fog ? scene.fog.far : 70;
  ctx.extInfo = { trees: trees.length, chunks: chunks.length, chunksBuilt: 0, chunksVisible: 0, tier };
  const setTier = t => { tier = t; viewD = VIEW[t] ?? 110; treeMesh.mat.uniforms.uFar.value = t > 0 ? 125 : 95; ctx.extInfo.tier = t; T3.dirty = 1; };
  treeMesh.load(tier === 0); if (tier > 0) loadShrubs(); load3D(); setTier(tier);
  const prevTier = ctx.tierChanged; ctx.tierChanged = t => { prevTier?.(t); if (XT == null) setTier(t); };
  // everything in the exterior draws after the interior (renderOrder 20+), the sky + hills at 12-14, window openings at 10-11
  root.traverse(o => { if (o !== root) o.renderOrder = (o.renderOrder || 0) + 20; });
  function dayNight(P, el, d) {
    const N = P.stars, Lt = P.lights; U.uSkyT.value.set(P.st); U.uSkyH.value.set(P.sh); U.uLakeT.value.set(P.lt).lerp(new T.Color('#35576a'), 0.6); U.uLakeB.value.set(P.lb).lerp(new T.Color('#132630'), 0.6); U.uSunC.value.set(P.sc);
    if (N > 0.5) { U.uSkyT.value.lerp(new T.Color('#060a18'), 0.5); U.uSkyH.value.lerp(new T.Color('#2a2a3c'), 0.45); }   // deep night: dark zenith, soft town glow at the horizon
    U.uNight.value = N; U.uLights.value = Lt; U.uLit.value = Math.max(0.32, Math.min(1, 1 - 0.68 * N - (P.sun < 0.5 ? 0.12 * (1 - P.sun * 2) : 0))); U.uHazeC.value.set(P.sh).lerp(new T.Color(P.st), 0.3).lerp(new T.Color('#c8cdd4').multiplyScalar(U.uLit.value), 0.35);
    if (N > 0.5) U.uHazeC.value.lerp(new T.Color('#232532'), 0.5);
    U.uTint.value.setRGB(1, 1, 1).lerp(new T.Color(0.55, 0.65, 1.0), N * 0.6).multiplyScalar(U.uLit.value);
    const sol = ((d.getUTCHours() + d.getUTCMinutes() / 60 - 6) + 24) % 24, az = (180 + (sol - 12) * 15) * Math.PI / 180, e = el * Math.PI / 180;   // Memphis: solar time ~ UTC-6
    U.uSunDir.value.set(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)).normalize();
    mats.lampGlass.color.set(Lt > 0.3 ? '#ffd9a0' : '#b9b4a8'); mats.halo.opacity = Lt * 0.9; mats.pool.opacity = Lt * 0.85; mats.blob.opacity = 0.8 * (1 - N * 0.7); if (mats.down) mats.down.color.set(Lt > 0.3 ? '#fff0d6' : '#9a978f');
    mats.crest.emissiveIntensity = 0.25 + Lt * 0.9; mats.billboard.color.setScalar(0.72 + 0.28 * Lt); mats.sign.emissiveIntensity = 0.1 + Lt * 0.8; mats.lot.emissiveIntensity = 0.05 + Lt * 0.55;
    sky.userData.stars.visible = N > 0.02; if (scene.fog) indoorFog.copy(scene.fog.color); ctx.extInfo.look = P.name; }
  const pDoor = new T.Vector3(), lp = new T.Vector3(); let lastFloor = 'G';
  function frame(dt, t, pos, cam) {
    U.uTime.value = t; sky.position.copy(cam.getWorldPosition(pDoor));
    const fl = ctx.curFloor || 'G', onG = fl === 'G';
    if (fl !== lastFloor) { lastFloor = fl; const n = onG ? 1 : +fl; root.position.set((n - 1) * 400, -(n - 1) * FH, 0); root.updateMatrixWorld(true); if (shell.facadeGroup) shell.facadeGroup.visible = onG; acc = 1; T3.dirty = 1; }
    lp.copy(pos).sub(root.position);
    outdoors = onG && (pos.z > Z0 + 0.2 || pos.x < fx - 0.2 || pos.x > fX + 0.2 || pos.z < fz - 0.2);
    root.visible = true; sky.visible = true;   // real window openings on every floor look out onto it
    if (scene.fog) { if (outdoors) { scene.fog.color.copy(U.uHazeC.value); scene.fog.near = 55; scene.fog.far = 118; } else if (scene.fog.near !== fogN) { scene.fog.color.copy(indoorFog); scene.fog.near = fogN; scene.fog.far = fogF; } }
    if (ctx.entranceDoors) { const near = onG && Math.abs(pos.x - X0) < 2.4 && Math.abs(pos.z - Z0) < 3.4; doorOpen += ((near ? 1 : 0) - doorOpen) * Math.min(1, dt * 5); for (const d of ctx.entranceDoors) d.g.position.x = d.sx * doorOpen * (d.w - 0.08); }
    accT += dt; if (accT > 0.25) { accT = 0; treeLOD(lp); }
    acc += dt; if (acc < 0.3) return; acc = 0; let nb = 0, nv = 0;
    for (const c of chunks) { const dx = Math.max(c.x0 - lp.x, 0, lp.x - c.x1), dz = Math.max(c.z0 - lp.z, 0, lp.z - c.z1), dd = Math.hypot(dx, dz);
      if (!c.built && dd < viewD + 25 && nb < 1) { buildChunk(c); nb++; } if (c.g) { c.g.visible = dd < viewD; if (c.g.visible) nv++; } }
    ctx.extInfo.chunksVisible = nv; ctx.extInfo.outdoors = outdoors; ctx.extInfo.floor = fl; }
  return { bounds: BOUNDS, frame, dayNight, setTier, root, sky, info: () => ctx.extInfo, get outdoors() { return outdoors; } };
}
