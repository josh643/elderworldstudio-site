// Floor 3 holographic plan table (Anna's spec incoming/architecture/holo-table/HOLO_TABLE_SPEC.md; Joshua 2026-10-16 11:45-11:57 PM).
// Replaces the concrete block + placeholder boxes. Walnut + brass standing table (3.2 x 2.0 m, top 0.95), smoked-glass projection bed
// with a gold 10 m grid, four brass projector posts with cyan lenses, warm under-edge LED strip, brass plaque, docked tablet arm,
// two stools + a rolled-plans rack, baked contact shadow.
// Layers at 1:500, generated from real data (never hand-placed):
//   CURRENT  = physical model: approved layout (CT111 arch/specs LATEST) + town reserve grid (ctx.town) + built sites (world state)
//   PROPOSED = hologram 30 mm above the bed: the architects' LATEST-REDESIGN (via /api/office/plan), cyan fill + gold edges, tier tints
//              at 35%, scanlines, flicker only within 6 m, labels (square, Arcade, hub, arch office), phase 1/2/3 filter, banner
// A new draft id -> 0.6 s rebuild sweep. Approval (the proposed id becomes LATEST) -> the hologram solidifies into the physical layer and
// the banner reads APPROVED. Draw calls: table, table emissive, glass bed (+plan, plaque, shadow), massing, trees (instanced),
// hologram = 6. No lights, no shadows. dispose() makes it hot-swappable.
let lc_ref = null;
const FALLBACK = {"id":"20261016-233841-fix-lobby","status":"approved","created":"2026-10-16T23:38:41.743179-05:00","qa":"PASS","approved":true,"frame":{"avenue_z":62,"street_x":[-162.5,-97.5,-32.5,32.5,97.5,162.5],"street_z":[62,127,192,257,322],"road_w":10,"sidewalk_w":2.5},"buildings":[{"id":"main","name":"Main studio building","rect":[-20,-42,32,0],"h":26},{"id":"crest-tower","name":"Crest tower slab","rect":[-26,-36,-20,-4],"h":31},{"id":"billboard-wing","name":"Billboard wing","rect":[32,-40,62,-6],"h":18},{"id":"pavilion","name":"Glass pavilion","rect":[-58,-38,-30,-14],"h":13},{"id":"dome","name":"Geodesic glass dome","rect":[-86,-40,-60,-14],"h":12}],"lots":[{"id":"L01","rect":[-90.0,69.5,-78.0,89.5],"tier":"S","status":"reserved"},{"id":"L02","rect":[-77.0,69.5,-57.0,94.5],"tier":"M","status":"reserved"},{"id":"L03","rect":[-56.0,69.5,-44.0,89.5],"tier":"S","status":"reserved"},{"id":"L04","rect":[-90.0,94.5,-60.0,119.5],"tier":"L","status":"reserved"},{"id":"L05","rect":[-59.0,99.5,-47.0,119.5],"tier":"S","status":"reserved"},{"id":"L06","rect":[-25.0,69.5,-5.0,94.5],"tier":"M","status":"reserved"},{"id":"L07","rect":[-4.0,69.5,16.0,94.5],"tier":"M","status":"reserved"},{"id":"L08","rect":[-25.0,99.5,-13.0,119.5],"tier":"S","status":"reserved"},{"id":"L09","rect":[-12.0,99.5,0.0,119.5],"tier":"S","status":"reserved"},{"id":"L10","rect":[1.0,99.5,13.0,119.5],"tier":"S","status":"reserved"}],"streets":[{"id":"avenue","rect":[-167.5,57.0,167.5,67.0],"kind":"avenue","lanes":2},{"id":"s1","rect":[-167.5,122.0,167.5,132.0],"kind":"local","lanes":2}],"water":[{"rect":[-58,14,-12,38]}],"paths":[{"w":3.0,"pts":[[0,0],[2,14],[-4,30],[0,45],[0,57]]},{"w":2.0,"pts":[[-10,12],[-40,10],[-62,22],[-46,40],[-14,36]]}],"planting":[{"rect":[-90,4,-60,55]},{"rect":[12,44,60,56]}],"zones":[{"id":"campus","rect":[-60,-70,60,57.0]},{"id":"district-1","rect":[-97.5,57.0,97.5,132.0]},{"id":"reserve","rect":[-162.5,132.0,162.5,322]}]};
const K = 1 / 500, TW = 3.2, TD = 2.0, TOP = 0.95, RZ = 170;   // rel (x, z) -> world (cx - x*K? no: cx + x*K, cz + (z - RZ)*K); campus (low z) is the front (-z, arrival side)
const CX0 = -180, CX1 = 180, CZ0 = -50, CZ1 = 330;              // canvas region for the CURRENT plan (rel metres)
const TIER = { S: '#8fb9e3', M: '#9fcf8f', L: '#efbe72', X: '#e0666e' }, HT = { S: '#3f8cff', M: '#3fd07a', L: '#ffae3a', X: '#ff3b4a' };
export default {
  async setup(ctx) {
    const T = ctx.THREE, S = ctx.archStudio; if (!S) return; this.ctx = ctx;
    const cx = S.x + 2.45, cz = S.z + 2.3, by = TOP - 0.004, W = (x, z) => [cx + x * K, cz + (z - RZ) * K], rel = (wx, wz) => [(wx - cx) / K, (wz - cz) / K + RZ];
    this.c = new T.Vector3(cx, TOP, cz); this.cx = cx; this.cz = cz;
    const g0 = new T.Group(); g0.name = 'holo-table'; (ctx.scene || ctx.world).add(g0); this.g0 = g0; const geos = [], mats = []; this.geos = geos; this.mats = mats;
    /* ---------- merge helper: [geometry, colour, extra attrs] -> one BufferGeometry ---------- */
    const merge = (list, attrs = {}) => { let n = 0; for (const [g] of list) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2), X = {}; for (const k in attrs) X[k] = new Float32Array(n * attrs[k]); let o = 0;
      for (const [g, col, ex = {}] of list) { const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < p.count; i++, o++) { P[o * 3] = p.getX(i); P[o * 3 + 1] = p.getY(i); P[o * 3 + 2] = p.getZ(i); if (nn) { N[o * 3] = nn.getX(i); N[o * 3 + 1] = nn.getY(i); N[o * 3 + 2] = nn.getZ(i); } if (uv) { U[o * 2] = uv.getX(i); U[o * 2 + 1] = uv.getY(i); } C[o * 3] = col.r; C[o * 3 + 1] = col.g; C[o * 3 + 2] = col.b; for (const k in attrs) { const v = ex[k] ?? 0; if (attrs[k] === 1) X[k][o] = v; else for (let j = 0; j < attrs[k]; j++) X[k][o * attrs[k] + j] = v[j]; } } }
      const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(P, 3)); ge.setAttribute('normal', new T.BufferAttribute(N, 3)); ge.setAttribute('color', new T.BufferAttribute(C, 3)); ge.setAttribute('uv', new T.BufferAttribute(U, 2)); for (const k in attrs) ge.setAttribute(k, new T.BufferAttribute(X[k], attrs[k])); ge.computeBoundingSphere(); return ge; };
    const ni = g => g.index ? g.toNonIndexed() : g, C3 = c => c instanceof T.Color ? c : new T.Color(c);
    /* ---------- 1+2: the table (walnut, brass, dark stone) + emissive bits (LED strip, lenses) ---------- */
    const tb = [], te = [], bx = (L, w, h, d, x, y, z, col, ry = 0) => L.push([ni(new T.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z)), C3(col)]), cyl = (L, r, h, x, y, z, col, seg = 16) => L.push([ni(new T.CylinderGeometry(r, r, h, seg).translate(x, y, z)), C3(col)]);
    const WAL = '#5a3a24', WAL2 = '#4a2f1d', BR = '#b8913f', BRD = '#8a6a2a', STN = '#2b2d30';
    for (const sx of [-1, 1]) { const px = cx + sx * 0.95; bx(tb, 0.72, 0.8, 1.3, px, 0.09 + 0.4, cz, WAL); bx(tb, 0.66, 0.09, 1.24, px, 0.045, cz, BR); bx(tb, 0.76, 0.02, 1.34, px, 0.885, cz, WAL2);   // pedestal, recessed brass kick plate, cap
      for (const sz of [-1, 1]) bx(tb, 0.6, 0.012, 0.006, px, 0.5, cz + sz * 0.653, WAL2); }   // panel reveal lines
    const fw = 0.12, IW = TW - 2 * fw, ID = TD - 2 * fw;
    bx(tb, TW, 0.06, fw, cx, TOP - 0.03, cz - TD / 2 + fw / 2, WAL); bx(tb, TW, 0.06, fw, cx, TOP - 0.03, cz + TD / 2 - fw / 2, WAL); bx(tb, fw, 0.06, ID, cx - TW / 2 + fw / 2, TOP - 0.03, cz, WAL); bx(tb, fw, 0.06, ID, cx + TW / 2 - fw / 2, TOP - 0.03, cz, WAL);
    bx(tb, IW, 0.02, ID, cx, TOP - 0.05, cz, STN);   // stone tray under the glass
    for (const [w, d, x, z] of [[TW + 0.008, 0.008, cx, cz - TD / 2], [TW + 0.008, 0.008, cx, cz + TD / 2], [0.008, TD, cx - TW / 2, cz], [0.008, TD, cx + TW / 2, cz]]) bx(tb, w, 0.04, d, x, TOP - 0.02, z, BR);   // 40 mm brass edge band
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = cx + sx * (TW / 2 - 0.06), pz = cz + sz * (TD / 2 - 0.06); cyl(tb, 0.028, 0.15, px, TOP + 0.075, pz, BR); cyl(tb, 0.034, 0.012, px, TOP + 0.006, pz, BRD); cyl(te, 0.02, 0.008, px, TOP + 0.154, pz, '#5ff2ff'); }   // projector posts + cyan lenses
    for (const [w, d, x, z] of [[TW - 0.1, 0.012, cx, cz - TD / 2 + 0.03], [TW - 0.1, 0.012, cx, cz + TD / 2 - 0.03], [0.012, TD - 0.1, cx - TW / 2 + 0.03, cz], [0.012, TD - 0.1, cx + TW / 2 - 0.03, cz]]) bx(te, w, 0.006, d, x, TOP - 0.063, z, '#ffbe6a');   // warm LED strip under the edge
    // docked tablet arm (front right as you face the table from the arrival side = -z edge, -x end)
    const ax = cx - TW / 2 + 0.32, az = cz - TD / 2 - 0.02; cyl(tb, 0.012, 0.16, ax, TOP + 0.03, az - 0.08, BR, 10); bx(tb, 0.04, 0.012, 0.14, ax, TOP - 0.05, az - 0.03, BR); bx(tb, 0.2, 0.008, 0.12, ax, TOP + 0.11, az - 0.1, BRD, 0);
    // brass plaque on the long front edge (text on the bed texture), two stools, rolled-plans rack at the +x end
    for (const sx of [-0.55, 0.55]) { const sx0 = cx + sx, sz0 = cz + TD / 2 + 0.45; cyl(tb, 0.19, 0.05, sx0, 0.72, sz0, WAL, 18); cyl(tb, 0.02, 0.68, sx0, 0.36, sz0, BR, 8); L_ring(tb, sx0, 0.28, sz0); cyl(tb, 0.16, 0.012, sx0, 0.006, sz0, BRD, 18); }
    function L_ring(L, x, y, z) { L.push([ni(new T.TorusGeometry(0.13, 0.008, 4, 16).rotateX(Math.PI / 2).translate(x, y, z)), C3(BR)]); }
    { const rx = cx + TW / 2 + 0.28, rz = cz; bx(tb, 0.26, 0.9, 0.5, rx, 0.45, rz, WAL2); bx(tb, 0.27, 0.02, 0.51, rx, 0.9, rz, BR); for (let i = 0; i < 7; i++) { const a = i % 3, b = Math.floor(i / 3); tb.push([ni(new T.CylinderGeometry(0.035, 0.035, 0.62, 10).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(rx - 0.07 + a * 0.07, 0.96 + b * 0.065, rz)), C3(['#efe7d4', '#e4ecf2', '#f2e8c8'][i % 3])]); } }
    const tmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.15 }), tgeo = merge(tb); const table = new T.Mesh(tgeo, tmat); mats.push(tmat); geos.push(tgeo);
    // brass reads as metal: a per-vertex metal factor would need a 2nd attribute; walnut and brass share roughness, brass gets its look from colour + env.
    const emat = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), egeo = merge(te), emis = new T.Mesh(egeo, emat); mats.push(emat); geos.push(egeo);
    for (const m of [table, emis]) { m.userData.noCollide = 1; g0.add(m); }
    (ctx.extraCols ||= []).push([cx - TW / 2, cz - TD / 2, cx + TW / 2, cz + TD / 2], [cx + TW / 2 + 0.14, cz - 0.26, cx + TW / 2 + 0.42, cz + 0.26]); ctx.rebuildColliders?.();
    /* ---------- 3: glass bed (procedural gold grid) + CURRENT plan decal + plaque + contact shadow, one canvas ---------- */
    const hiT = ctx.tier !== 'low', CW = hiT ? 2048 : 1024, CH = CW + Math.round(CW / 12), SH = CH - CW, uP = (CW - SH) / CW, cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d'); this.canvas = cv;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; this.tex = tex;
    const bmat = new T.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0, transparent: true, side: T.DoubleSide });
    bmat.onBeforeCompile = sh => { bmat.__patched = (bmat.__patched || 0) + 1; sh.vertexShader = 'attribute float gb;\nvarying float vG;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvG = gb; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying float vG;\nvarying vec3 vWP;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float gl1 = 0.0; if (vG > 0.5) { vec2 q = vWP.xz / 0.02, fw = fwidth(q); vec2 f = abs(fract(q - 0.5) - 0.5) / fw; float l = (1.0 - min(min(f.x, f.y), 1.0)) * (1.0 - smoothstep(0.12, 0.35, max(fw.x, fw.y))); vec2 q2 = vWP.xz / 0.1, fw2 = fwidth(q2); vec2 f2 = abs(fract(q2 - 0.5) - 0.5) / fw2; float l2 = (1.0 - min(min(f2.x, f2.y), 1.0)) * (1.0 - smoothstep(0.12, 0.35, max(fw2.x, fw2.y)));
          gl1 = max(l * 0.12, l2 * 0.34); diffuseColor = vec4(mix(vec3(0.03, 0.038, 0.046), vec3(0.78, 0.6, 0.28), gl1 * 0.55), 1.0); }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vG > 0.5) roughnessFactor = 0.14;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (vG > 0.5) metalnessFactor = 0.35;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.85, 0.62, 0.25) * gl1 * 0.22;'); };
    const bedGeo = (() => { const L = [], q = (pts, uvs, gb, n = [0, 1, 0]) => { const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]], 3)); ge.setAttribute('uv', new T.Float32BufferAttribute([...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]], 2)); ge.setAttribute('normal', new T.Float32BufferAttribute([...n, ...n, ...n, ...n, ...n, ...n], 3)); L.push([ge, C3('#ffffff'), { gb }]); };
      const vP = CW / CH; // plan region v in [1 - vP, 1]; strip below
      q([[cx - IW / 2, by, cz + ID / 2], [cx + IW / 2, by, cz + ID / 2], [cx + IW / 2, by, cz - ID / 2], [cx - IW / 2, by, cz - ID / 2]], [[0, 0], [0, 0], [0, 0], [0, 0]], 1);   // glass + grid (procedural)
      // CURRENT plan: canvas left = viewer's left (+x, facing +z from the front), canvas top = far side (+z) -> text upright from the front
      const [x0, z0] = W(CX0, CZ0), [x1, z1] = W(CX1, CZ1), y = by + 0.0006;
      q([[x1, y, z0], [x0, y, z0], [x0, y, z1], [x1, y, z1]], [[0, 1 - vP], [1, 1 - vP], [1, 1], [0, 1]], 0);
      // plaque on the long front edge face (z = cz - TD/2), facing -z: left half of the strip
      const pz = cz - TD / 2 - 0.0045, pw = 0.55, h = 0.05; q([[cx + pw / 2, TOP - 0.045, pz], [cx - pw / 2, TOP - 0.045, pz], [cx - pw / 2, TOP - 0.045 + h, pz], [cx + pw / 2, TOP - 0.045 + h, pz]], [[0, 0], [uP, 0], [uP, 1 - vP], [0, 1 - vP]], 0, [0, 0, -1]);
      for (const sx of [-1, 1]) { const px = cx + sx * 0.95, w = 0.98, d = 1.6, yy = 0.023; q([[px - w / 2, yy, cz + d / 2], [px + w / 2, yy, cz + d / 2], [px + w / 2, yy, cz - d / 2], [px - w / 2, yy, cz - d / 2]], [[uP, 0], [1, 0], [1, 1 - vP], [uP, 1 - vP]], 0); }
      return merge(L, { gb: 1 }); })();
    const bed = new T.Mesh(bedGeo, bmat); bed.userData.noCollide = 1; bed.renderOrder = 1; g0.add(bed); mats.push(bmat); geos.push(bedGeo); this.bed = bed;
    /* ---------- 4+5: CURRENT massing (merged, water via wet factor) + instanced tree clusters ---------- */
    const mmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 }); mats.push(mmat);
    mmat.onBeforeCompile = sh => { sh.vertexShader = 'attribute float wet;\nvarying float vWet;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = wet;');
      sh.fragmentShader = 'varying float vWet;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, vWet);').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.35, vWet);'); };
    const mass = new T.Mesh(new T.BufferGeometry(), mmat); mass.userData.noCollide = 1; mass.name = 'holo-table-current'; g0.add(mass); this.mass = mass;
    const tc = (() => { const L = []; for (let k = 0; k < 3; k++) { const a = k * 2.1; L.push([ni(new T.IcosahedronGeometry(1, 0).scale(1, 1.15, 1).translate(Math.cos(a) * 0.7, 5.5 + k * 0.6, Math.sin(a) * 0.7)), C3(k ? '#9bb07f' : '#86a06c'), { wet: 0 }]); } return merge(L, { wet: 1 }); })();
    const MAXTREE = 400, trees = new T.InstancedMesh(tc, mmat, MAXTREE); trees.count = 0; trees.userData.noCollide = 1; trees.frustumCulled = false; g0.add(trees); this.trees = trees; geos.push(tc);
    /* ---------- 6: PROPOSED hologram: one merged mesh, additive unlit shader (+ label/banner atlas) ---------- */
    const lc = document.createElement('canvas'); lc_ref = lc; const lg = lc.getContext('2d'), ltex = new T.CanvasTexture(lc); ltex.colorSpace = T.SRGBColorSpace; ltex.anisotropy = 4; this.ltex = ltex;
    const hu = { t: { value: 0 }, op: { value: 1 }, map: { value: ltex }, ph: { value: 3 }, fk: { value: 0 }, sw: { value: -1 }, sx0: { value: cx - IW / 2 }, sx1: { value: cx + IW / 2 } };
    const hmat = new T.ShaderMaterial({ uniforms: hu, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: 'attribute vec3 hcol; attribute vec3 hedge; attribute float hk; attribute float ha; attribute float hp; varying vec3 vC; varying vec3 vE; varying vec2 vU; varying float vK; varying float vA; varying float vP; varying vec3 vW;\n' +
        'void main(){ vC = hcol; vE = hedge; vU = uv; vK = hk; vA = ha; vP = hp; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform float t; uniform float op; uniform sampler2D map; uniform float ph; uniform float fk; uniform float sw; uniform float sx0; uniform float sx1; varying vec3 vC; varying vec3 vE; varying vec2 vU; varying float vK; varying float vA; varying float vP; varying vec3 vW;\n' +
        'void main(){ if (vP > ph + 0.5) discard; float sxw = mix(sx0, sx1, sw); if (sw >= 0.0 && vK < 2.5 && vW.x > sxw) discard; vec3 c;\n' +
        ' if (vK > 2.5) { c = vec3(0.35, 0.95, 1.0) * exp(-pow((vW.x - sxw) / 0.012, 2.0)) * step(0.0, sw) * 1.4; }\n' +
        ' else if (vK > 1.5) { vec4 tx = texture2D(map, vU); c = tx.rgb * tx.a * 1.15; }\n' +
        ' else { vec2 w = fwidth(vU); vec2 e = min(vU, 1.0 - vU) / max(w, vec2(1e-5)); float ed = 1.0 - smoothstep(0.0, 1.6, min(e.x, e.y)); c = vC * vA * (1.0 - ed) + vE * ed; }\n' +
        ' float sl = 0.74 + 0.26 * sin(vW.y * 1600.0 + vW.z * 260.0 - t * 4.0); float fl = 1.0 - fk * (0.05 + 0.05 * sin(t * 13.0 + vW.x * 41.0));\n' +
        ' gl_FragColor = vec4(c * (vK > 1.5 ? 1.0 : sl) * fl * op, 1.0); }' });
    const holo = new T.Mesh(new T.BufferGeometry(), hmat); holo.userData.noCollide = 1; holo.frustumCulled = false; holo.renderOrder = 5; holo.name = 'holo-table-proposed'; g0.add(holo); this.holo = holo; mats.push(hmat);
    /* ---------- data ---------- */
    this.mode = 'overlay'; this.phase = 3; this.plan = { v: null, approved: FALLBACK, proposed: null, hist: [] }; this.src = 'built-in copy'; this.sites = []; this.lotSel = null;
    const world = () => { try { const w = window.__ewsOffice?.world?.(); return w?.ents || w || []; } catch (e) { return []; } };
    const sitesNow = () => (Array.isArray(world()) ? world() : []).filter(e => e && e.kind === 'site' && e.lot).map(e => ({ lot: e.lot, tenant: String(e.tenant || '').slice(0, 30), floors: Math.max(1, Math.min(8, e.style?.floors || 1)), p: +e.p || 0, arcade: /arcade/i.test(e.tenant || '') || /arcade/i.test(e.job || '') }));
    const relLot = l => { const X0 = ctx.town.X0, Z0 = ctx.town.Z0; return [l.cx - X0 - l.w / 2, l.cz - Z0 - l.d / 2, l.cx - X0 + l.w / 2, l.cz - Z0 + l.d / 2]; };
    const ov = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    /* CURRENT: canvas plan + massing + trees */
    const buildCurrent = () => {
      const P = this.plan.approved || FALLBACK, fr = P.frame || {}, town = ctx.town, sx = CW / (CX1 - CX0), sz = CW / (CZ1 - CZ0);
      const X = x => (CX1 - x) * sx, Z = z => (CZ1 - z) * sz, R = (r, col) => { g.fillStyle = col; g.fillRect(X(r[2]), Z(r[3]), (r[2] - r[0]) * sx, (r[3] - r[1]) * sz); };
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.fillStyle = '#d3d8c4'; g.fillRect(0, 0, CW, CW);   // lawn
      for (const zn of P.zones || []) if (zn.id === 'campus') R(zn.rect, '#dcdfcc');
      for (const p of P.planting || []) R(p.rect, '#bfcca6');
      R([-14, 0, 14, 12], '#ece8de');
      g.lineCap = 'round'; g.lineJoin = 'round'; for (const p of P.paths || []) { g.strokeStyle = '#efe9db'; g.lineWidth = Math.max(2, (p.w || 2) * sx); g.beginPath(); p.pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); }
      for (const w of P.water || []) { const r = w.rect; g.fillStyle = '#86aec6'; g.beginPath(); g.ellipse(X((r[0] + r[2]) / 2), Z((r[1] + r[3]) / 2), (r[2] - r[0]) / 2 * sx, (r[3] - r[1]) / 2 * sz, 0, 0, Math.PI * 2); g.fill(); }
      const SXs = fr.street_x || [], SZs = fr.street_z || [], RW = fr.road_w || 10, SWk = fr.sidewalk_w || 2.5, roads = [];
      if (SZs.length) { const xa = Math.min(...SXs) - RW / 2, xb = Math.max(...SXs) + RW / 2, za = Math.min(...SZs), zb = Math.max(...SZs);
        for (const z of SZs) roads.push({ r: [xa, z - RW / 2, xb, z + RW / 2], h: 1, av: z === (fr.avenue_z ?? za) });
        for (const x of SXs) roads.push({ r: [x - RW / 2, za + RW / 2, x + RW / 2, zb - RW / 2], h: 0 }); }
      else for (const s of P.streets || []) roads.push({ r: s.rect, h: (s.rect[2] - s.rect[0]) > (s.rect[3] - s.rect[1]) ? 1 : 0, av: s.kind === 'avenue' });
      for (const o of roads) { const r = o.r; R(o.h ? [r[0], r[1] - SWk, r[2], r[3] + SWk] : [r[0] - SWk, r[1], r[2] + SWk, r[3]], '#cbc6bc'); }
      for (const o of roads) R(o.r, '#3a3c41');
      const lw = Math.max(1, 0.18 * sx);
      for (const o of roads) { const r = o.r;
        if (o.h) { const zc = (r[1] + r[3]) / 2; if (o.av) { g.fillStyle = '#e6c25a'; g.fillRect(X(r[2]), Z(zc) - lw * 1.6, (r[2] - r[0]) * sx, lw); g.fillRect(X(r[2]), Z(zc) + lw * 0.6, (r[2] - r[0]) * sx, lw); }
          g.fillStyle = '#f2efe6'; for (let x = r[0] + 1; x < r[2] - 3; x += 6) for (const k of o.av ? [-0.25, 0.25] : [0]) g.fillRect(X(x + 2.8), Z(zc + k * (r[3] - r[1])) - lw / 2, 2.8 * sx, lw); }
        else { const xc = (r[0] + r[2]) / 2; g.fillStyle = '#f2efe6'; for (let z = r[1] + 1; z < r[3] - 3; z += 6) g.fillRect(X(xc) - lw / 2, Z(z + 2.8), lw, 2.8 * sz); } }
      for (const o of roads) if (o.h) for (const x of SXs) { const r = o.r; g.fillStyle = '#3a3c41'; g.fillRect(X(x + RW / 2), Z(r[3]), RW * sx, RW * sz); }
      const sites = this.sites, arc = sites.find(s => s.arcade), lots = [], specR = (P.lots || []).map(l => l.rect);
      for (const l of P.lots || []) lots.push({ r: l.rect, tier: l.tier, label: l.id, spec: 1, src: l });
      for (const l of town?.lots || []) { if (!l) continue; const r = relLot(l); if (specR.some(q => ov(q, r))) continue; const site = sites.find(s => s.lot === l.n); lots.push({ r, tier: arc && arc.lot === l.n ? 'X' : site ? 'M' : null, label: String(l.n).padStart(2, '0'), n: l.n, site }); }
      this.curLots = lots; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const L of lots) { const r = L.r, w = (r[2] - r[0]) * sx, d = (r[3] - r[1]) * sz; R(r, L.tier ? TIER[L.tier] : '#e6e3da'); g.strokeStyle = L.tier === 'X' ? '#b08d3c' : L.tier ? '#55606e' : '#a59f92'; g.lineWidth = L.tier === 'X' ? Math.max(3, 1.2 * sx) : Math.max(1, 0.35 * sx); g.strokeRect(X(r[2]), Z(r[3]), w, d);
        const fs = Math.max(8, Math.min(w, d) * 0.28); g.font = '700 ' + fs + 'px Inter, sans-serif'; g.fillStyle = L.tier === 'X' ? '#5a1830' : '#3b4350'; g.fillText((L.spec ? '' : 'LOT ') + L.label, X((r[0] + r[2]) / 2), Z((r[1] + r[3]) / 2) - (L.tier === 'X' ? fs * 0.5 : 0));
        if (L.tier === 'X') { g.font = '700 ' + (fs * 0.62) + 'px Inter, sans-serif'; g.fillText('X · ' + (arc?.tenant || 'Arcade').toUpperCase(), X((r[0] + r[2]) / 2), Z((r[1] + r[3]) / 2) + fs * 0.55); } }
      const fs = CW / 2048; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(40,46,56,.7)'; g.fillRect(0, CW - 46 * fs, CW, 46 * fs); g.fillStyle = '#f3efe4'; g.font = '700 ' + 26 * fs + 'px Inter, sans-serif'; g.fillText('CURRENT · approved layout ' + (P.id || '') + ' · 1:500', 20 * fs, CW - 15 * fs);
      ['S', 'M', 'L', 'X'].forEach((t, i) => { const x = CW - (440 - i * 105) * fs; g.fillStyle = TIER[t]; g.fillRect(x, CW - 38 * fs, 26 * fs, 26 * fs); g.fillStyle = '#f3efe4'; g.font = '600 ' + 22 * fs + 'px Inter, sans-serif'; g.fillText(t === 'X' ? 'X Arcade' : t, x + 32 * fs, CW - 16 * fs); });
      /* plaque (strip, left part): brass, EWS crest, engraved text; last square of the strip = soft contact shadow */
      { const y0 = CW, h = SH, w = CW - SH, gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#dcb862'); gr.addColorStop(0.5, '#b08d3c'); gr.addColorStop(1, '#8a6c2a'); g.fillStyle = gr; g.fillRect(0, y0, w, h);
        g.strokeStyle = '#6e5420'; g.lineWidth = h * 0.05; g.strokeRect(h * 0.06, y0 + h * 0.06, w - h * 0.12, h * 0.88);
        const cx2 = h * 0.62, cy2 = y0 + h / 2, s2 = h * 0.3; g.fillStyle = '#3a2c12'; g.beginPath(); g.moveTo(cx2 - s2, cy2 - s2); g.lineTo(cx2 + s2, cy2 - s2); g.lineTo(cx2 + s2, cy2); g.quadraticCurveTo(cx2 + s2, cy2 + s2 * 0.8, cx2, cy2 + s2 * 1.2); g.quadraticCurveTo(cx2 - s2, cy2 + s2 * 0.8, cx2 - s2, cy2); g.closePath(); g.fill();
        g.fillStyle = '#dcb862'; g.font = '800 ' + s2 * 1.1 + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('E', cx2, cy2 + s2 * 0.05);
        g.fillStyle = '#2b2110'; g.font = '700 ' + h * 0.42 + 'px Georgia, serif'; g.fillText('ELDER WORLD STUDIO · CAMPUS TOWN', w / 2 + h * 0.4, y0 + h / 2 + h * 0.03); }
      { const x0 = CW - SH, y0 = CW, h = SH, rg = g.createRadialGradient(x0 + h / 2, y0 + h / 2, 0, x0 + h / 2, y0 + h / 2, h / 2); rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(0.55, 'rgba(0,0,0,.32)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.clearRect(x0, y0, h, h); g.fillStyle = rg; g.fillRect(x0, y0, h, h); }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; tex.needsUpdate = true;
      /* massing */
      const parts = [], add = (geo, col, wet = 0) => parts.push([ni(geo), C3(col), { wet }]);
      const box = (r, h, col, y0 = by) => { const [a, b] = W(r[0], r[1]), [c, d] = W(r[2], r[3]); add(new T.BoxGeometry(Math.abs(c - a), Math.max(0.0008, h * K), Math.abs(d - b)).translate((a + c) / 2, y0 + h * K / 2, (b + d) / 2), col); };
      for (const b of P.buildings || []) { const r = b.rect, h = b.h || 10, id = String(b.id || '');
        if (/dome/i.test(id)) { const [a, c] = W(r[0], r[1]), [e, f] = W(r[2], r[3]); add(new T.CylinderGeometry(1, 1, 1, 24).scale((e - a) / 2, h * 0.35 * K, (f - c) / 2).translate((a + e) / 2, by + h * 0.175 * K, (c + f) / 2), '#f4f1ea');
          add(new T.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale((e - a) / 2 * 0.92, h * 0.65 * K, (f - c) / 2 * 0.92).translate((a + e) / 2, by + h * 0.35 * K, (c + f) / 2), '#e3cfa8'); }
        else if (/pavilion/i.test(id)) { box(r, h * 0.85, '#f4f1ea'); box([r[0] - 1.2, r[1] - 1.2, r[2] + 1.2, r[3] + 1.2], 1.2, '#dcc196', by + h * 0.85 * K); }
        else if (/tower/i.test(id)) { box(r, h, '#e6d3b0'); box([r[0] + 0.8, r[1] + 0.8, r[2] - 0.8, r[3] - 0.8], 2, '#f4f1ea', by + h * K); }
        else box(r, h, /hub|office/i.test(id) ? '#e6d3b0' : '#f4f1ea'); }
      for (const w of P.water || []) { const r = w.rect, [a, c] = W(r[0], r[1]), [e, f] = W(r[2], r[3]); add(new T.CircleGeometry(1, 28).rotateX(-Math.PI / 2).scale((e - a) / 2, 1, (f - c) / 2).translate((a + e) / 2, by + 0.0012, (c + f) / 2), '#6f9fbd', 1); }
      for (const s of this.sites) { const l = town?.lots?.[s.lot - 1]; if (!l) continue; const r = relLot(l), i = 2.5; box([r[0] + i, r[1] + i, r[2] - i, r[3] - i], s.floors * 3.6 * Math.max(0.15, Math.min(1, s.p)), s.arcade ? '#e8c9a0' : '#d6b98d'); }
      const old = mass.geometry; mass.geometry = parts.length ? merge(parts, { wet: 1 }) : new T.BufferGeometry(); old.dispose();
      seed = 7; const tp = [];
      for (const p of P.planting || []) { const r = p.rect, n = Math.min(40, Math.round((r[2] - r[0]) * (r[3] - r[1]) / 70)); for (let i = 0; i < n; i++) tp.push([r[0] + 2 + rnd() * (r[2] - r[0] - 4), r[1] + 2 + rnd() * (r[3] - r[1] - 4)]); }
      for (const o of roads) if (o.h && o.av) for (let x = o.r[0] + 6; x < o.r[2] - 4; x += 10) { if (SXs.some(q => Math.abs(q - x) < RW)) continue; tp.push([x, o.r[1] - SWk - 1.5], [x, o.r[3] + SWk + 1.5]); }
      for (const w of P.water || []) { const r = w.rect, mx = (r[0] + r[2]) / 2, mzz = (r[1] + r[3]) / 2; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.3; tp.push([mx + Math.cos(a) * ((r[2] - r[0]) / 2 + 4), mzz + Math.sin(a) * ((r[3] - r[1]) / 2 + 4)]); } }
      const m4 = new T.Matrix4(), q4 = new T.Quaternion(), e3 = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3(); let n = 0;
      for (const [x, z] of tp) { if (n >= MAXTREE) break; const [wx, wz] = W(x, z), s = (2.1 + rnd() * 0.9) * K; trees.setMatrixAt(n++, m4.compose(v3.set(wx, by, wz), q4.setFromEuler(e3.set(0, rnd() * 6.28, 0)), s3.set(s, s, s))); }
      trees.count = n; trees.instanceMatrix.needsUpdate = true;
      this.built = { id: P.id, lots: lots.length, roads: roads.length, buildings: (P.buildings || []).length, sites: this.sites.length, trees: n, tris: mass.geometry.attributes.position ? mass.geometry.attributes.position.count / 3 : 0 }; };
    /* PROPOSED hologram */
    const CY = new T.Color('#3fe6ff'), GD = new T.Color('#ffc65a'), ZERO = [0, 0, 0];
    const drawAtlas = () => { const P = this.holoP; if (!P) return; const LW = this.near8 ? 2048 : 512, LH = LW, s = LW / 1024; if (lc.width !== LW) { lc.width = LW; lc.height = LH; ltex.dispose(); }
      lg.clearRect(0, 0, LW, LH); lg.textAlign = 'center'; lg.textBaseline = 'middle'; const row = 64 * s, lrow = 96 * s;
      (this.labels || []).forEach(([, txt, col], i) => { const y = i * lrow; lg.fillStyle = 'rgba(30,120,140,.28)'; lg.fillRect(LW * 0.05, y + 8 * s, LW * 0.9, lrow - 16 * s); lg.strokeStyle = col; lg.lineWidth = 4 * s; lg.strokeRect(LW * 0.05, y + 8 * s, LW * 0.9, lrow - 16 * s); lg.font = '800 ' + 62 * s + 'px Inter, sans-serif'; { const tw = lg.measureText(txt).width; if (tw > LW * 0.84) lg.font = '800 ' + Math.floor(62 * s * LW * 0.84 / tw) + 'px Inter, sans-serif'; } lg.fillStyle = col; lg.shadowColor = col; lg.shadowBlur = 6 * s; lg.fillText(txt, LW / 2, y + lrow / 2 + 2 * s); lg.shadowBlur = 0; });
      const by0 = 8 * row, ok = this.solid; lg.fillStyle = ok ? 'rgba(90,255,150,.16)' : 'rgba(255,150,50,.16)'; lg.fillRect(0, by0, LW, row * 3); lg.strokeStyle = ok ? '#6fffa0' : '#ffb040'; lg.lineWidth = 5 * s; lg.strokeRect(4 * s, by0 + 4 * s, LW - 8 * s, row * 3 - 8 * s);
      lg.font = '800 ' + 60 * s + 'px Inter, sans-serif'; { const tw = lg.measureText(ok ? 'APPROVED · now the current layout' : 'PROPOSED · awaiting Joshua approval').width; if (tw > LW * 0.92) lg.font = '800 ' + Math.floor(60 * s * LW * 0.92 / tw) + 'px Inter, sans-serif'; } lg.fillStyle = ok ? '#b6ffd0' : '#ffd27a'; lg.shadowColor = ok ? '#30ff80' : '#ff9a30'; lg.shadowBlur = 12 * s; lg.fillText(ok ? 'APPROVED · now the current layout' : 'PROPOSED · awaiting Joshua approval', LW / 2, by0 + row * 1.05); lg.shadowBlur = 0;
      lg.font = '600 ' + 30 * s + 'px Inter, sans-serif'; lg.fillStyle = '#9ff2ff'; lg.fillText('Spec ' + (P.id || '') + (P.qa ? ' · Vé ' + P.qa : '') + ' · ' + (P.lots || []).length + ' lots', LW / 2, by0 + row * 2.2); ltex.needsUpdate = true; };
    const buildHolo = (sweep) => { const P = this.plan.proposed; this.holoP = P; if (!P) { holo.visible = false; this.holoInfo = null; return; }
      const parts = [], put = (geo, fill, edge, k, a, ph = 0) => parts.push([ni(geo), C3(fill), { hedge: edge, hk: k, ha: a, hp: ph }]);
      const flat = (r, fill, edge, y, a, ph = 0) => { const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]); put(new T.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), fill, edge, 0, a, ph); };
      const vol = (r, h, fill, edge, a, ph = 0) => { const [x0, z0] = W(r[0], r[1]), [x1, z1] = W(r[2], r[3]); put(new T.BoxGeometry(x1 - x0, h * K, z1 - z0).translate((x0 + x1) / 2, h * K / 2, (z0 + z1) / 2), fill, edge, 1, a, ph); };
      const blk = {}; for (const b of P.blocks || []) blk[b.id] = b.phase || 1;
      const zPh = z => { for (const b of P.blocks || []) if (z >= b.rect[1] && z <= b.rect[3]) return b.phase || 1; return 1; };
      const ga = GD.toArray(), ca = CY.toArray();
      for (const s of P.streets || []) { const ph = s.rect[3] - s.rect[1] > s.rect[2] - s.rect[0] ? 1 : zPh((s.rect[1] + s.rect[3]) / 2 - 1); flat(s.rect, CY, CY.clone().multiplyScalar(0.8).toArray(), 0.0002, s.kind === 'avenue' ? 0.16 : 0.1, ph); }
      for (const b of P.blocks || []) flat(b.rect, CY, CY.clone().multiplyScalar(b.phase > 1 ? 0.35 : 0.6).toArray(), 0.0004, 0.04, b.phase || 1);
      for (const x of P.sites || []) { const k = x.kind; if (k === 'arcade') continue; const col = k === 'lake' ? '#3f9cff' : k === 'park' ? '#3fd07a' : (k === 'square' || k === 'plaza') ? GD : CY; flat(x.rect, col, (k === 'square' || k === 'plaza') ? ga : C3(col).toArray(), 0.0007, k === 'lake' ? 0.3 : 0.16, 1); }
      for (const l of P.lots || []) { const ph = blk[l.block] || zPh((l.rect[1] + l.rect[3]) / 2); flat(l.rect, HT[l.tier] || HT.S, ga, 0.001, 0.35, ph); if (l.tier === 'X') vol(l.rect, 9, HT.X, ga, 0.2, ph); }
      const appB = new Set((this.plan.approved?.buildings || []).map(b => b.id));
      for (const b of P.buildings || []) { const nw = !appB.has(b.id); vol(b.rect, b.h || 8, nw ? GD : CY, nw ? ga : ca, nw ? 0.2 : 0.08); }
      // labels (atlas rows 0..5) + banner (rows 8..10)
      const site = k => (P.sites || []).find(x => x.kind === k), lotX = (P.lots || []).find(l => l.tier === 'X'), hub = (P.buildings || []).find(b => /hub/i.test(b.id)), ao = (P.buildings || []).find(b => /arch/i.test(b.id));
      const L = [[site('square')?.rect, 'TOWN SQUARE', '#ffd27a', 0], [lotX?.rect || site('arcade')?.rect, 'X · ARCADE (EWS)', '#ff8a96', 9], [hub?.rect || site('commerce-hub')?.rect, 'COMMERCE HUB', '#ffd27a', hub?.h || 7], [ao?.rect || site('arch-office')?.rect, 'ARCH OFFICE', '#ffd27a', ao?.h || 7]].filter(x => x[0]);
      this.labels = L; const rowV = 64 / 1024, lV = 96 / 1024;
      L.forEach(([r, txt, , hh], i) => { const w = 0.26, h = w * lV, [x2, z2] = W((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), y2 = hh * K + 0.035;   // small standing holo tag above the site, facing the front
        const ge = new T.PlaneGeometry(w, h).rotateY(Math.PI).translate(x2, y2, z2), uv = ge.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j), 1 - (i + 1 - uv.getY(j)) * lV); put(ge, '#ffffff', ZERO, 2, 1);
        put(new T.PlaneGeometry(0.002, y2 - hh * K - h / 2).rotateY(Math.PI).translate(x2, hh * K + (y2 - hh * K - h / 2) / 2, z2), CY, ca, 1, 0.6); });
      { const bw = 1.1, bh = bw * 3 / 16, ge = new T.PlaneGeometry(bw, bh).rotateY(Math.PI).translate(cx, 0.24 + bh / 2, cz + TD / 2 - 0.25), uv = ge.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j), 1 - (8 + (1 - uv.getY(j)) * 3) * rowV); put(ge, '#ffffff', ZERO, 2, 1); }
      put(new T.PlaneGeometry(IW, ID).rotateX(-Math.PI / 2).translate(cx, 0.0015, cz), '#000000', ZERO, 3, 0);   // sweep plane
      const ge = merge(parts, { hedge: 3, hk: 1, ha: 1, hp: 1 }); holo.geometry.dispose(); holo.geometry = ge;
      this.holoInfo = { id: P.id, qa: P.qa, lots: (P.lots || []).length, labels: L.map(x => x[1]), tris: ge.attributes.position.count / 3 }; drawAtlas(); applyMode();
      if (sweep) this.sweepT = performance.now(); };
    const applyMode = () => { const m = this.mode, hasP = !!this.plan.proposed; holo.visible = hasP && m !== 'current'; holo.position.y = by + 0.03;   // floats 30 mm above the bed
      const showCur = m !== 'proposed'; mass.visible = showCur; trees.visible = showCur; hu.op.value = m === 'overlay' ? 0.85 : 1; hu.ph.value = this.phase; bmat.color.set(showCur ? 0xffffff : 0x3a4048); };
    this.applyMode = applyMode; this.drawAtlas = drawAtlas;
    const H = o => JSON.stringify(o ?? null);
    const fetchPlan = async () => { try { const r = await fetch('/api/office/plan', { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (!j || !j.approved) return; if (j.v && j.v === this.plan.v) return; apply(j, 'live'); } catch (e) {} };
    const apply = (j, src) => { const prevP = this.plan.proposed, ca = H(j.approved) !== H(this.plan.approved), cp = H(j.proposed) !== H(prevP);
      const approvedNow = prevP && j.approved?.id === prevP.id;   // Joshua approved the draft: LATEST now points at it
      this.plan = { hist: [], ...j }; this.src = src;
      if (approvedNow) { this.solid = true; this.holoP = prevP; drawAtlas(); this.solidT = performance.now(); holo.visible = true; this.pendingCur = ca; return; }
      if (ca) buildCurrent(); if (cp) buildHolo(!!prevP || src === 'test'); applyMode(); };
    const checkSites = () => { const s = sitesNow(), h = H(s.map(x => [x.lot, x.tenant, x.floors, Math.round(x.p * 10)])); if (h !== this.sitesH) { this.sitesH = h; this.sites = s; buildCurrent(); applyMode(); } };
    this.sites = sitesNow(); this.sitesH = H(this.sites.map(x => [x.lot, x.tenant, x.floors, Math.round(x.p * 10)])); buildCurrent(); buildHolo(false); applyMode(); fetchPlan();
    this.tA = setInterval(() => { if (this.near) fetchPlan(); }, 30e3); this.tB = setInterval(() => { if (this.near) checkSites(); }, 10e3); this.tC = setInterval(fetchPlan, 300e3);
    this.finishSolid = () => { this.solid = false; this.solidT = 0; if (this.pendingCur) buildCurrent(); buildHolo(false); applyMode(); };
    /* lot info: tap a lot on the table -> the docked tablet shows tier, size, use and the size_source citation */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -(by + 0.03)), hit = new T.Vector3(), el = ctx.renderer?.domElement;
    const onDown = e => { const r = el.getBoundingClientRect(); ndc.set(document.pointerLockElement ? 0 : ((e.clientX - r.left) / r.width) * 2 - 1, document.pointerLockElement ? 0 : -((e.clientY - r.top) / r.height) * 2 + 1); };
    el?.addEventListener('pointerdown', onDown, { capture: true }); this.offDown = () => el?.removeEventListener('pointerdown', onDown, { capture: true });
    const lotAt = (x, z) => { const inR = r => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
      if (this.mode !== 'current' && this.plan.proposed) { const l = (this.plan.proposed.lots || []).find(l => inR(l.rect)); if (l) return { layer: 'Proposed', id: l.id, tier: l.tier, w: l.rect[2] - l.rect[0], d: l.rect[3] - l.rect[1], use: l.use, src: l.src || [], block: l.block }; }
      const c = (this.curLots || []).find(L => inR(L.r)); if (c) return { layer: 'Current', id: c.spec ? c.label : 'Lot ' + c.label, tier: c.tier || 'reserve', w: c.r[2] - c.r[0], d: c.r[3] - c.r[1], use: c.src?.use || (c.site ? c.site.tenant : 'reserved pad'), src: c.src?.src || [], block: c.src?.block };
      return null; };
    const tap = () => { ray.setFromCamera(ndc, ctx.cam); if (ray.ray.intersectPlane(plane, hit)) { const [x, z] = rel(hit.x, hit.z); this.lotSel = lotAt(x, z); } ctx.tablets?.openKind?.('holo'); };
    if (ctx.onClick) ctx.onClick(bed, tap);
    const api = { set: m => { this.mode = ['current', 'proposed', 'overlay'].includes(m) ? m : 'overlay'; applyMode(); return this.mode; }, phase: n => { this.phase = Math.max(1, Math.min(3, Math.round(+n) || 3)); applyMode(); return this.phase; },
      lotAt: (x, z) => (this.lotSel = lotAt(x, z)), sel: () => this.lotSel, clearSel: () => { this.lotSel = null; },
      info: () => ({ mode: this.mode, phase: this.phase, hasProposed: !!this.plan.proposed, approved: this.plan.approved?.id || '', proposed: this.plan.proposed?.id || '', qa: this.plan.proposed?.qa || '', lots: this.plan.proposed?.lots?.length || 0, hist: this.plan.hist || [], src: this.src, built: this.built, holo: this.holoInfo, solid: !!this.solid }),
      inject: j => { apply({ v: 'test-' + Date.now(), hist: [], ...j }, 'test'); return api.info(); }, tablet: { x: ax, y: TOP + 0.118, z: az - 0.1 }, canvas: cv };
    ctx.provide('townModel', api); this.api = api; this.own = [[bed, bmat], [mass, mmat], [trees, mmat], [table, tmat]];
  },
  onFrame() { if (!this.mass) return; const ctx = this.ctx, cam = ctx.cam; if (!cam) return; const d = cam.position.distanceTo(this.c); this.near = d < 30; this.g0.visible = d < 60;
    const hu = this.holo.material.uniforms, now = performance.now(); if (this.holo.visible) hu.t.value = now / 1000; hu.fk.value = d < 6 ? 1 : 0;
    /* integrated GPUs: the engine swaps PBR for Lambert (core/engine.js lowMats) -> carry the grid / water shader patch over to the swapped material */
    if (now - (this.ownT || 0) > 1000) { this.ownT = now; for (const [o, m0] of this.own) { const m = o.material; if (m !== m0 && m.onBeforeCompile !== m0.onBeforeCompile && m0.onBeforeCompile && !m.userData.tmPatched) { m.onBeforeCompile = m0.onBeforeCompile; m.userData.tmPatched = 1; m.needsUpdate = true; } } }
    const n8 = d < 8; if (n8 !== this.near8) { this.near8 = n8; this.drawAtlas?.(); }
    if (this.sweepT) { const p = (now - this.sweepT) / 600; if (p >= 1) { this.sweepT = 0; hu.sw.value = -1; } else hu.sw.value = p; }
    if (this.solidT) { const p = (now - this.solidT) / 2500; this.mass.visible = true; if (p < 1) { hu.op.value = 1 - p * 0.9; this.holo.position.y = this.c.y - 0.004 + 0.03 * (1 - p); } else if (p > 3) this.finishSolid(); }
    if (!this.hook && window.__ewsOffice) { this.hook = 1; Object.assign(window.__ewsOffice, { townModel: () => this.api.info(), townLayer: m => this.api.set(m), townPhase: n => this.api.phase(n), townInject: j => this.api.inject(j), townLot: (x, z) => this.api.lotAt(x, z), holoC: () => [this.cx, this.cz], atlasURL: () => lc_ref.toDataURL('image/png'), holoLabels: () => { const g = this.holo.geometry, k = g.attributes.hk, p = g.attributes.position, u = g.attributes.uv, o = []; for (let i = 0; i < k.count; i++) if (k.getX(i) === 2) o.push([+p.getX(i).toFixed(3), +p.getY(i).toFixed(4), +p.getZ(i).toFixed(3), +u.getX(i).toFixed(3), +u.getY(i).toFixed(3)]); return { y: this.holo.position.y, vis: this.holo.visible, o }; }, holoDbg: () => { const g = this.bed.geometry, a = g.attributes.gb; let n = 0; for (let i = 0; i < a.count; i++) n += a.getX(i); const r = this.ctx.renderer, pr = r.info.programs || []; return { gb: n, count: a.count, progs: pr.filter(p => /MeshStandard/.test(p.name)).length, patched: this.bed.material.__patched, type: this.bed.material.type, same: this.bed.material === this.mats[2], vis: this.bed.visible, mapOk: !!this.bed.material.map, pv: (() => { const p = this.ctx.renderer.properties.get(this.bed.material); const prog = p.currentProgram; if (!prog) return 'noprog'; const gl = this.ctx.renderer.getContext(); const sh = gl.getAttachedShaders(prog.program); return sh.map(x => gl.getShaderSource(x).includes('vG > 0.5')); })() }; } }); } },
  dispose() { clearInterval(this.tA); clearInterval(this.tB); clearInterval(this.tC); this.offDown?.(); this.g0?.removeFromParent(); this.mass?.geometry.dispose(); this.holo?.geometry.dispose(); this.bed?.geometry.dispose(); (this.geos || []).forEach(g => g.dispose()); (this.mats || []).forEach(m => m.dispose()); this.tex?.dispose(); this.ltex?.dispose(); }
};
