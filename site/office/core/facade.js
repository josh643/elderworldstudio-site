// Elderverse exterior v2: the building itself, after the campus vision board (Joshua's reference): a modern glass curtain wall
// with thin mullions and layered floor plates, a dark stone tower carrying the tree crest + ELDER WORLD STUDIO INC, a large
// media billboard wall, a geodesic glass dome, rooftop terrace. Cheap-device glazing: ONE shader for every glass face —
// analytic sky reflection (fresnel, per-pane waviness) over an interior-mapped room behind each bay (ray vs. room box: floor,
// ceiling with light panels, side + back walls, desk band), lit per room at night. No cubemaps, no real lights, no transparency
// except the dome. Tier 0 drops the interior ray and uses a flat lit/unlit pane.
export function buildFacade(ctx, E) {
  const T = ctx.THREE, { root, U, LM, Batch, canvas, crest, col, shell, rnd, tier, mats } = E, { fx, fX, fz, fZ: Z0, EN } = shell, X0 = EN.x;
  const FH = 4.2; const FG = new T.Group(); FG.name = 'facade'; root.add(FG); shell.facadeGroup = FG;   /* the building's own massing: hidden while you're upstairs (you're inside it) */
  /* ---------- glazing shader ---------- */
  const SKY = `vec3 skyCol(vec3 d){ float y = d.y; vec3 c = mix(uSkyH, uSkyT, pow(clamp(y, 0.0, 1.0), 0.55));
      float g = smoothstep(0.02, -0.25, y); c = mix(c, mix(uHazeC, vec3(0.16, 0.2, 0.14) * uLit, 0.6), g);
      c += uSunC * pow(max(dot(d, uSunDir), 0.0), 16.0) * 0.6 * smoothstep(-0.1, 0.05, uSunDir.y); return c; }`;
  const glassMat = new T.ShaderMaterial({ uniforms: U, fog: false, defines: tier > 0 ? { INTERIOR: 1 } : {}, extensions: {},
    vertexShader: 'attribute vec3 aT; attribute float aSeed; varying vec3 vW, vN, vT; varying float vS; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = normalize(mat3(modelMatrix) * aT); vS = aSeed; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSkyT, uSkyH, uHazeC, uSunDir, uSunC; uniform float uHazeN, uHazeF, uLit, uNight, uLights; varying vec3 vW, vN, vT; varying float vS;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vS * 17.3) * 43758.5453); }
      ${SKY}
      void main(){ const float FH = ${FH.toFixed(1)}, PW = 1.5, RW = 4.5, RD = 5.5; vec3 N = normalize(vN), Tg = normalize(vT);
        float u = dot(vW, Tg) + 1000.0, y = vW.y, fl = floor(y / FH), fy = fract(y / FH) * FH, pc = floor(u / PW), fu = fract(u / PW), room = floor(u / RW);
        vec3 V = normalize(vW - cameraPosition); float dist = length(vW - cameraPosition);
        float slab = 1.0 - step(0.55, fy);                 // floor plate edge band (light stone)
        float mull = step(fu, 0.035) + step(0.965, fu);     // thin vertical mullions
        float trans = step(abs(fy - 3.15), 0.03);          // transom line
        float hp = h1(vec2(pc, fl)); vec3 n = normalize(N + Tg * (hp - 0.5) * 0.05 + vec3(0.0, (h1(vec2(fl, pc)) - 0.5) * 0.04, 0.0));
        vec3 R = reflect(V, n); vec3 env = skyCol(R);
        float fres = 0.1 + 0.9 * pow(1.0 - max(dot(-V, n), 0.0), 5.0);
        float on = step(0.32, h1(vec2(room, fl * 3.1))) * (0.5 + 0.5 * uLights); float warm = 0.75 + 0.5 * h1(vec2(room + 3.0, fl));
        vec3 inside;
        #ifdef INTERIOR
        { vec3 d = vec3(dot(V, Tg), V.y, dot(V, -N)); float px = fract(u / RW) * RW, py = fy - 0.55; float H = FH - 0.55 - 0.35;
          float tx = d.x > 0.0 ? (RW - px) / d.x : -px / min(d.x, -1e-4); float ty = d.y > 0.0 ? (H - py) / d.y : -py / min(d.y, -1e-4); float tz = RD / max(d.z, 1e-4);
          float t = min(tx, min(ty, tz)); vec3 p = vec3(px, py, 0.0) + d * t; float base = mix(0.05, 0.22, 1.0 - uNight) * uLit;
          vec3 wallC = mix(vec3(0.3, 0.27, 0.24), vec3(0.2, 0.23, 0.27), h1(vec2(room, fl + 7.0)));
          vec3 litC = vec3(1.0, 0.82, 0.58) * warm;
          if (t == ty && d.y > 0.0) { float lp = smoothstep(0.35, 0.3, abs(fract(p.z / 1.8) - 0.5)) * smoothstep(0.42, 0.38, abs(fract(p.x / 1.5) - 0.5)); inside = mix(vec3(0.32), litC * 2.4, lp) * (base + on * 0.7) + litC * lp * on * 1.2; }
          else if (t == ty) { inside = vec3(0.22, 0.18, 0.15) * (base + on * 0.8); }
          else if (t == tz) { float desk = step(p.y, 0.95) * step(0.7, p.y) ; float scr = step(abs(p.y - 1.25), 0.22) * step(0.6, fract(p.x / 1.2)) * on; inside = mix(wallC, vec3(0.12), desk) * (base + on * 0.85) * litC + vec3(0.35, 0.6, 1.0) * scr * 0.9; }
          else { inside = wallC * 0.85 * (base + on * 0.75) * litC; }
          inside *= mix(1.0, 0.55, smoothstep(2.0, RD, t)); }
        #else
        inside = mix(vec3(0.06, 0.07, 0.08) * uLit, vec3(1.0, 0.8, 0.55) * warm, on * 0.8);
        #endif
        inside *= vec3(0.6, 0.7, 0.78);
        float reflW = fres * mix(0.45, 0.8, 1.0 - uNight); env = mix(env, uSkyT, 0.35) * vec3(0.55, 0.64, 0.76); vec3 c = mix(inside, env, reflW);
        vec3 slabC = vec3(0.34, 0.35, 0.38) * uLit * (0.82 + 0.18 * smoothstep(0.0, 0.55, fy)); slabC += vec3(1.0, 0.78, 0.5) * on * 0.18 * step(fy, 0.12);
        vec3 mullC = vec3(0.13, 0.14, 0.16) * (0.6 + 0.4 * uLit) + env * 0.08;
        c = mix(c, mullC, clamp(mull + trans, 0.0, 1.0)); c = mix(c, slabC, slab);
        c *= 0.72 + 0.28 * smoothstep(0.0, 2.5, y);   // baked AO at the base
        c = mix(c, uHazeC, pow(smoothstep(uHazeN, uHazeF, dist), 1.5)); gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  mats.glass = glassMat;
  /* glass faces: quads with tangent + seed attributes, merged into one mesh */
  const gp = [], gn = [], gt = [], gs = [], gi = [];
  const face = (ax, az, bx, bz, y0, y1, nx, nz, seed = rnd()) => { const k = gp.length / 3; gp.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az); const tx = bx - ax, tz = bz - az, l = Math.hypot(tx, tz) || 1;
    for (let i = 0; i < 4; i++) { gn.push(nx, 0, nz); gt.push(tx / l, 0, tz / l); gs.push(seed); } gi.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  const vol = (x0, x1, z0, z1, y0, y1, o = {}) => {   // 4 glazed sides (front +z, right +x, back -z, left -x); o.skip = sides to leave out
    if (!o.skip?.includes('f')) face(x0, z1, x1, z1, y0, y1, 0, 1); if (!o.skip?.includes('r')) face(x1, z1, x1, z0, y0, y1, 1, 0);
    if (!o.skip?.includes('b')) face(x1, z0, x0, z0, y0, y1, 0, -1); if (!o.skip?.includes('l')) face(x0, z0, x0, z1, y0, y1, -1, 0); };
  const B = Batch(), SL = Batch(), stoneC = '#2a2a2f', slabC = '#4a4c52';
  const plates = (x0, x1, z0, z1, y0, y1, step = FH, out = 0.28) => { for (let y = y0 + step; y <= y1 + 0.01; y += step) { const w = x1 - x0 + out * 2, d = z1 - z0 + out * 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      SL.box(w, 0.32, out, slabC, cx, y, z1 + out / 2); SL.box(w, 0.32, out, slabC, cx, y, z0 - out / 2); SL.box(out, 0.32, d - out * 2, slabC, x1 + out / 2, y, cz); SL.box(out, 0.32, d - out * 2, slabC, x0 - out / 2, y, cz); } };
  const o = 0.2, ex0 = X0 - EN.w / 2, ex1 = X0 + EN.w / 2, F = Z0 + o;
  // podium (2 floors) wraps the real ground floor; the lobby opening stays real glass
  face(fx - o, F, ex0, F, 0, 2 * FH, 0, 1); face(ex1, F, fX + o, F, 0, 2 * FH, 0, 1); face(ex0, F, ex1, F, 4.0, 2 * FH, 0, 1);
  face(fX + o, F, fX + o, fz - o, 0, 2 * FH, 1, 0); face(fX + o, fz - o, fx - o, fz - o, 0, 2 * FH, 0, -1); face(fx - o, fz - o, fx - o, F, 0, 2 * FH, -1, 0);
  plates(fx - o, fX + o, fz - o, F, 0, 2 * FH);
  B.box(fX - fx + 0.6, 0.4, Z0 - fz + 0.6, '#3a3b40', (fx + fX) / 2, 2 * FH + 0.2, (fz + Z0) / 2);   // podium roof deck
  // left wing: 3 more floors, set back 4 m (rooftop terrace in front of it)
  const L = [fx + 1, -7, Z0 - 28, Z0 - 4]; vol(L[0], L[1], L[2], L[3], 2 * FH, 5 * FH); plates(L[0], L[1], L[2], L[3], 2 * FH, 5 * FH); B.box(L[1] - L[0] + 0.8, 0.5, L[3] - L[2] + 0.8, '#2c2d32', (L[0] + L[1]) / 2, 5 * FH + 0.25, (L[2] + L[3]) / 2);
  // tower block behind the stone fin: 8 floors of glass
  const TW = [Math.min(X0 + 6, fX - 16), 0, Z0 - 16, Z0 - 2]; TW[1] = TW[0] + 14; vol(TW[0], TW[1], TW[2], TW[3], 2 * FH, 8 * FH, { skip: 'f' }); plates(TW[0], TW[1], TW[2], TW[3], 2 * FH, 8 * FH);
  B.box(TW[1] - TW[0] + 0.8, 0.5, TW[3] - TW[2] + 0.8, '#2c2d32', (TW[0] + TW[1]) / 2, 8 * FH + 0.25, (TW[2] + TW[3]) / 2);
  face(TW[0], TW[3], TW[0] + 0.5, TW[3], 2 * FH, 8 * FH, 0, 1); face(TW[1] - 0.5, TW[3], TW[1], TW[3], 2 * FH, 8 * FH, 0, 1);
  // right block: 5 more floors
  const RB = [TW[1], fX, Z0 - 30, Z0 - 1]; vol(RB[0], RB[1], RB[2], RB[3], 2 * FH, 6 * FH, { skip: 'l' }); plates(RB[0], RB[1], RB[2], RB[3], 2 * FH, 6 * FH); B.box(RB[1] - RB[0] + 0.8, 0.5, RB[3] - RB[2] + 0.8, '#2c2d32', (RB[0] + RB[1]) / 2, 6 * FH + 0.25, (RB[2] + RB[3]) / 2);
  // back block: 3 more floors
  vol(fx, fX, fz, Z0 - 31, 2 * FH, 5 * FH, { skip: 'f' }); plates(fx, fX, fz, Z0 - 31, 2 * FH, 5 * FH); B.box(fX - fx + 0.8, 0.5, Z0 - 31 - fz + 0.8, '#2c2d32', (fx + fX) / 2, 5 * FH + 0.25, (fz + Z0 - 31) / 2);
  // media wing (east): glazed 2-floor base + billboard wall above (massing, not enterable)
  const MW = [fX + 1.5, fX + 29, Z0 - 24, Z0 - 6]; vol(MW[0], MW[1], MW[2], MW[3], 0, 2 * FH); plates(MW[0], MW[1], MW[2], MW[3], 0, 2 * FH); col(MW[0] - 0.3, MW[2] - 0.3, MW[1] + 0.3, MW[3] + 0.3);
  B.box(MW[1] - MW[0], 13.5, MW[3] - MW[2], '#1e1f24', (MW[0] + MW[1]) / 2, 2 * FH + 6.75, (MW[2] + MW[3]) / 2);
  // stone tower fin with the crest (front, full height); ground part only outside the building wall
  const S0 = TW[0] + 0.5, S1 = TW[1] - 0.5, TH = 8 * FH + 6, stone = canvas(256, 512, (g, w, h) => { g.fillStyle = '#2b2b30'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 128) { g.fillStyle = `rgba(${40 + rnd() * 14 | 0},${40 + rnd() * 12 | 0},${46 + rnd() * 12 | 0},1)`; g.fillRect(x + 1, y + 1, 126, 62); }
      for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.12)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
  stone.repeat.set(1, 1); const stoneM = LM({ map: stone }); mats.stone = stoneM;
  const SB = Batch(); SB.box(S1 - S0, TH - 4.3, (TW[3] + 0.9) - (Z0 - 10), stoneC, (S0 + S1) / 2, 4.3 + (TH - 4.3) / 2, ((TW[3] + 0.9) + (Z0 - 10)) / 2, 0, 3);
  SB.box(S1 - S0, 4.3, 0.85, stoneC, (S0 + S1) / 2, 2.15, Z0 + 0.6, 0, 3); col(S0, Z0, S1, Z0 + 1.1);
  for (const g of SB.list) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, 1, 1, 1); } SB.mesh(stoneM, FG);
  const cr = canvas(512, 1024, (g, w, h) => { g.clearRect(0, 0, w, h); crest(g, w / 2, 250, 160); g.fillStyle = '#ece6da'; g.textAlign = 'center'; g.font = '500 92px Cinzel, Georgia, serif';
      ['ELDER', 'WORLD', 'STUDIO', 'INC'].forEach((s, i) => g.fillText(s, w / 2, 560 + i * 118)); }); cr.wrapS = cr.wrapT = T.ClampToEdgeWrapping;
  const crM = LM({ map: cr, transparent: true, emissive: 0xffffff, emissiveMap: cr, emissiveIntensity: 0.25, depthWrite: false }); mats.crest = crM;
  { const pl = new T.Mesh(new T.PlaneGeometry((S1 - S0) * 0.78, (S1 - S0) * 0.78 * 2), crM); pl.position.set((S0 + S1) / 2, TH - 4 - (S1 - S0) * 0.78, Z0 + 0.92); pl.userData.noCollide = 1; pl.renderOrder = 3; FG.add(pl); }
  // rooftop terrace on the podium: glass rail, planters (trees added by the caller), warm deck
  B.box(L[1] - L[0], 0.06, 3.4, '#6b5440', (L[0] + L[1]) / 2, 2 * FH + 0.43, Z0 - 2);
  for (let x = L[0] + 3; x < L[1] - 2; x += 6) B.box(1.6, 0.7, 1.2, '#4a4a50', x, 2 * FH + 0.75, Z0 - 2.4);
  const rail = new T.Mesh(new T.PlaneGeometry(fX - fx, 1.1), new T.MeshBasicMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.25, depthWrite: false, side: T.DoubleSide, fog: false }));
  rail.position.set((fx + fX) / 2, 2 * FH + 0.95, Z0 + 0.25); rail.userData.noCollide = 1; FG.add(rail);
  // entrance canopy
  B.box(15, 0.3, 4.8, '#24252a', X0, 4.55, Z0 + 2.4); B.box(15.1, 0.1, 0.1, '#b08d3c', X0, 4.4, Z0 + 4.8);
  B.box(fX - fx + 0.7, 0.18, 0.5, '#b08d3c', (fx + fX) / 2, 4.22, Z0 + 0.45);   // brass band over the ground floor
  // entrance canopy (cantilever, brass edge) with recessed downlights + their light pools
  B.box(15, 0.28, 4.6, '#26252b', X0, 4.5, Z0 + 2.3); B.box(15.1, 0.08, 0.08, '#b08d3c', X0, 4.38, Z0 + 4.6);
  { mats.down = new T.MeshBasicMaterial({ color: 0xfff0d6, toneMapped: false, fog: false }); const DL = Batch(), DP = Batch();
    for (let x = -6; x <= 6; x += 3) for (const z of [1.2, 3.4]) { DL.geo(new T.CircleGeometry(0.16, 14).rotateX(Math.PI / 2), 0xffffff, X0 + x, 4.355, Z0 + z); DP.quad(4.2, 4.2, 0xffffff, X0 + x, 0.05, Z0 + z); }
    for (const g of DP.list) { const uv = g.attributes.uv, p = g.attributes.position; let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < p.count; i++) { a = Math.min(a, p.getX(i)); b = Math.min(b, p.getZ(i)); c = Math.max(c, p.getX(i)); d = Math.max(d, p.getZ(i)); } for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - a) / (c - a), (p.getZ(i) - b) / (d - b)); }
    DL.mesh(mats.down, FG); const pm = DP.mesh(mats.pool); pm.renderOrder = 3; }
  B.mesh(mats.vc, FG); SL.mesh(mats.vc, FG);
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(gn, 3)); g.setAttribute('aT', new T.Float32BufferAttribute(gt, 3)); g.setAttribute('aSeed', new T.Float32BufferAttribute(gs, 1)); g.setIndex(gi);
    const m = new T.Mesh(g, glassMat); m.userData.noCollide = 1; FG.add(m); }
  /* ---------- media billboard: painted fantasy vista + tagline (screen: emissive, a bit brighter at night) ---------- */
  { const bw = MW[1] - MW[0] - 2, bh = 11.5;
    const bt = canvas(1024, 512, (g, w, h) => { const sk = g.createLinearGradient(0, 0, 0, h * 0.7); sk.addColorStop(0, '#2c3f63'); sk.addColorStop(0.55, '#c98a5a'); sk.addColorStop(1, '#f2c48a'); g.fillStyle = sk; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,236,200,.9)'; g.beginPath(); g.arc(300, 300, 34, 0, 7); g.fill();
      const ridge = (base, amp, col, seed, snow) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); let pts = []; for (let x = 0; x <= w; x += 8) { const y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed)) * (0.6 + 0.4 * Math.sin(x * 0.037 + seed * 2)) - amp * 0.5 * Math.max(0, Math.sin(x * 0.006 + seed * 3)) ** 6; pts.push([x, y]); g.lineTo(x, y); } g.lineTo(w, h); g.fill();
        if (snow) { g.fillStyle = 'rgba(240,240,250,.55)'; for (const [x, y] of pts) if (y < base - amp * 0.95) g.fillRect(x, y, 8, 6 + (base - amp * 0.95 - y) * 0.4); } };
      ridge(330, 170, '#6d6a86', 1.3, true); ridge(380, 120, '#4c5470', 2.9, true); ridge(430, 90, '#33402f', 4.1, false);
      g.fillStyle = '#28331f'; g.fillRect(0, 430, w, 82); const rv = g.createLinearGradient(0, 440, 0, h); rv.addColorStop(0, '#e8b47a'); rv.addColorStop(1, '#6a5a6a'); g.fillStyle = rv; g.beginPath(); g.moveTo(240, h); g.quadraticCurveTo(330, 470, 300, 440); g.lineTo(320, 440); g.quadraticCurveTo(380, 480, 420, h); g.fill();
      g.fillStyle = '#1d1f2a'; g.fillRect(186, 150, 14, 70); g.beginPath(); g.moveTo(180, 152); g.lineTo(193, 118); g.lineTo(206, 152); g.fill(); g.fillRect(172, 190, 42, 34);
      g.fillStyle = 'rgba(10,12,20,.35)'; g.fillRect(600, 0, 424, h); g.fillStyle = '#f6efe2'; g.textAlign = 'center'; g.font = '600 64px Cinzel, Georgia, serif';
      ['SHAPING', 'WORLDS.', 'CREATING', 'LEGACIES.'].forEach((s, i) => g.fillText(s, 812, 150 + i * 82)); });
    bt.wrapS = bt.wrapT = T.ClampToEdgeWrapping; const bm = new T.MeshBasicMaterial({ map: bt, toneMapped: false, fog: false, color: 0xbbbbbb }); mats.billboard = bm;
    const pl = new T.Mesh(new T.PlaneGeometry(bw, bh), bm); pl.position.set((MW[0] + MW[1]) / 2, 2 * FH + 1 + bh / 2, MW[3] + 0.02); pl.userData.noCollide = 1; FG.add(pl);
    const fr = Batch(); fr.box(bw + 0.8, bh + 0.8, 0.3, '#121317', (MW[0] + MW[1]) / 2, 2 * FH + 1 + bh / 2, MW[3] - 0.13); fr.mesh(mats.vc, FG); }
  /* ---------- geodesic glass dome: icosphere top half, rib lines from barycentrics, sky reflection, warm glow at night ---------- */
  const dx = fx - 15, dz = Z0 - 1, DR = 16;
  { const ico = new T.IcosahedronGeometry(DR, 4), p = ico.attributes.position, P = [], Bc = [];
    for (let i = 0; i < p.count; i += 3) { const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; if (y < -0.2) continue; for (let k = 0; k < 3; k++) { P.push(p.getX(i + k), Math.max(0, p.getY(i + k)), p.getZ(i + k)); Bc.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aBc', new T.Float32BufferAttribute(Bc, 3)); g.computeVertexNormals();
    const dm = new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
      vertexShader: 'attribute vec3 aBc; varying vec3 vB, vW, vN; void main(){ vB = aBc; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uSkyT, uSkyH, uHazeC, uSunDir, uSunC; uniform float uHazeN, uHazeF, uLit, uNight, uLights; varying vec3 vB, vW, vN; ${SKY}
        void main(){ vec3 V = normalize(vW - cameraPosition), N = normalize(vN); if (dot(N, V) > 0.0) N = -N; float e = min(vB.x, min(vB.y, vB.z)); float wd = fwidth(e) * 1.4 + 0.012;
          float rib = 1.0 - smoothstep(0.0, wd, e); vec3 env = skyCol(reflect(V, N)); float fr = 0.25 + 0.75 * pow(1.0 - abs(dot(V, N)), 3.0);
          vec3 inner = vec3(0.32, 0.4, 0.3) * uLit + vec3(1.0, 0.8, 0.55) * uLights * 0.55;
          vec3 c = mix(inner, env, fr * 0.8); float a = mix(0.42, 0.85, fr); c = mix(c, vec3(0.12, 0.13, 0.15) + uSunC * 0.05, rib); a = mix(a, 1.0, rib);
          c = mix(c, uHazeC, pow(smoothstep(uHazeN, uHazeF, length(vW - cameraPosition)), 1.5)); gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }` });
    const dome = new T.Mesh(g, dm); dome.position.set(dx, 1.2, dz); dome.renderOrder = 4; dome.userData.noCollide = 1; root.add(dome); mats.dome = dm;
    const db = Batch(); db.cyl(DR + 0.25, DR + 0.45, 1.2, '#6f6b64', dx, 0.6, dz, 48); db.mesh(mats.vc);
    for (let zz = -DR; zz < DR; zz += 2) { const hw = Math.sqrt(Math.max(0, DR * DR - (zz + 1) * (zz + 1))); col(dx - hw, dz + zz, dx + hw, dz + zz + 2); } }
  shell.dome = { x: dx, z: dz, r: DR }; shell.tower = [S0, S1]; shell.terrace = { x0: L[0], x1: L[1], y: 2 * FH + 0.45, z: Z0 - 2.4 };
}
