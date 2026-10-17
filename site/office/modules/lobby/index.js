// Lobby (Fólkvangr), ground floor v2 (approved isometric layout, Joshua 2026-10-16): one walled room, 20 x 15 m.
//   front: full glass wall with the sliding doors (engine builds it over ctx.entrance) + planters either side of the doors
//   centre: red carpet from the doors straight to Freyja's curved desk; wood-slat logo wall behind her (receptionist module)
//   left: Collaboration Hub (sofas round a coffee table, area rug, whiteboard, hanging ring planter)
//   back right: Coders (two rows of three desks; lobby-stations seats the coding agents there)
//   front right: Hermod's Merch Store (checkout screen + counter, glass display cases from merch-display, wall shelves)
//   overhead: halo ring pendants, wood-slat ceiling canopies over the hub and the coders. Plants in the corners (unique species).
// No red-carpet kiosks (removed by Joshua; their content is Freyja's quick options). Everything static is plain boxes /
// cylinders on shared materials, so the engine's batcher folds it into a handful of draw calls (cheap-device safe).
const X0 = -10, X1 = 10, ZB = -5.2, ZF = 10, H = 4;   // room extents (anchor-relative), wall height = ceiling
export default {
  setup(ctx, cfg, [x, z]) {
    const { THREE: T, box, M, mat, kit } = ctx, wood = mat.wood, trim = mat.trim, wallM = mat.wall, fab = mat.fabric || mat.dark;
    const S = (c, r = 0.7, mt = 0) => (ctx.M.standard ? new T.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }) : new T.MeshLambertMaterial({ color: c }));
    const leafA = S(0x3f7a3a, 0.8), leafB = S(0x2f6630, 0.8), leafC = S(0x5a8f45, 0.8), leaves = [leafA, leafB, leafC];
    const LG = [new T.IcosahedronGeometry(0.13, 0), new T.IcosahedronGeometry(0.18, 0), new T.IcosahedronGeometry(0.1, 0)];
    const put = (geo, m, px, py, pz, ry = 0) => { const o = new T.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.y = ry; ctx.scene.add(o); return o; };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const leaf = (px, py, pz, s = 1) => { const o = put(LG[Math.floor(rnd() * 3)], leaves[Math.floor(rnd() * 3)], px, py, pz, rnd() * 6); o.scale.setScalar(s * (0.8 + rnd() * 0.5)); o.rotation.x = rnd() * 3; o.userData.noCollide = 1; return o; };
    const X = v => x + v, Z = v => z + v;

    /* ---- red carpet: doors -> Freyja's desk (brass edging) ---- */
    box(2.6, 0.04, 9.8, ctx.rug ? ctx.rug(0x8a3040) : M(0x5a1f2c), x, 0.02, z + 4.5); box(2.8, 0.02, 10, trim, x, 0.01, z + 4.5);
    ctx.lobbyAt = { x, z };
    /* glass front across the whole lobby (engine: glass panes + mullions + sliding doors centred on the carpet) */
    ctx.entrance = { x, w: X1 - X0 };

    /* ---- room walls (to the ceiling), wood wainscot + brass skirting on the inside faces ---- */
    /* warm wood-plank cladding, floor to ceiling, on every inside face of the lobby walls (layout v2: the mock-up's rooms are
       wood-lined, not plaster). One canvas texture (1 m = 7 planks with grooves), UVs scaled per wall, one shared material -> batched. */
    const cladM = (() => { const c = document.createElement('canvas'); c.width = 448; c.height = 512; const g = c.getContext('2d');
      const tones = ['#7a5434', '#8a603b', '#6f4b2e', '#94683f', '#805837', '#74502f', '#8c633c'];
      for (let i = 0; i < 7; i++) { const x0 = i * 64; g.fillStyle = tones[i]; g.fillRect(x0, 0, 64, 512); g.globalAlpha = 0.18; g.fillStyle = '#3e2614';
        for (let k = 0; k < 9; k++) g.fillRect(x0 + 6 + (k * 13 + i * 7) % 50, (k * 113 + i * 59) % 512, 1.5, 60 + (k * 37) % 120); g.globalAlpha = 1; g.fillStyle = '#2a1a0e'; g.fillRect(x0, 0, 3, 512); }
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
      return ctx.M.standard ? new T.MeshStandardMaterial({ map: t, roughness: 0.75 }) : new T.MeshLambertMaterial({ map: t }); })();
    const clad = (len, h, px, py, pz, ry) => { const g = new T.PlaneGeometry(len, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * h / 2.2);
      const o = new T.Mesh(g, cladM); o.position.set(px, py, pz); o.rotation.y = ry; o.userData.noCollide = 1; ctx.scene.add(o); return o; };
    const wallX = (wx, z1, z2, inner) => { const l = z2 - z1, c = (z1 + z2) / 2; box(0.2, H, l, wallM, X(wx), H / 2, Z(c)); clad(l, H, X(wx + inner * 0.102), H / 2, Z(c), inner > 0 ? Math.PI / 2 : -Math.PI / 2); const o = box(0.03, 1.1, l, wood, X(wx + inner * 0.115), 0.55, Z(c)); o.userData.noCollide = 1; box(0.04, 0.08, l, trim, X(wx + inner * 0.13), 1.12, Z(c)).userData.noCollide = 1; };
    const wallZ = (wz, x1, x2, inner) => { const l = x2 - x1, c = (x1 + x2) / 2; box(l, H, 0.2, wallM, X(c), H / 2, Z(wz)); clad(l, H, X(c), H / 2, Z(wz + inner * 0.102), inner > 0 ? 0 : Math.PI); const o = box(l, 1.1, 0.03, wood, X(c), 0.55, Z(wz + inner * 0.115)); o.userData.noCollide = 1; box(l, 0.08, 0.04, trim, X(c), 1.12, Z(wz + inner * 0.13)).userData.noCollide = 1; };
    const lintelX = (wx, z1, z2) => { box(0.2, H - 2.6, z2 - z1, wallM, X(wx), 2.6 + (H - 2.6) / 2, Z((z1 + z2) / 2)); for (const zz of [z1, z2]) box(0.26, 2.6, 0.06, trim, X(wx), 1.3, Z(zz)); box(0.26, 0.06, z2 - z1 + 0.06, trim, X(wx), 2.6, Z((z1 + z2) / 2)); };
    const lintelZ = (wz, x1, x2) => { box(x2 - x1, H - 2.6, 0.2, wallM, X((x1 + x2) / 2), 2.6 + (H - 2.6) / 2, Z(wz)); for (const xx of [x1, x2]) box(0.06, 2.6, 0.26, trim, X(xx), 1.3, Z(wz)); box(x2 - x1 + 0.06, 0.06, 0.26, trim, X((x1 + x2) / 2), 2.6, Z(wz)); };
    // left wall: solid (the Arcade moves out of the campus to its own lot, Joshua 2026-10-16: its doorway is closed)
    wallX(X0, ZB, ZF, 1);
    // right wall: doorway to the services / devlog hall between the coders and the store (z 0.7..2.4)
    wallX(X1, ZB, 0.7, -1); wallX(X1, 2.4, ZF, -1); lintelX(X1, 0.7, 2.4);
    // back wall: logo wall in the middle (receptionist builds it, x -3.2..3.2); doorways to the stairs (left) and elevator / main hall (right)
    wallZ(ZB, X0, -4.8, 1); wallZ(ZB, 4.8, X1, 1); lintelZ(ZB, -4.8, -3.2); lintelZ(ZB, 3.2, 4.8);
    const plate = (lines, w, h, px, py, pz, ry, opt = {}) => { const p = ctx.panel(ctx.textCanvas(lines, { w: 768, h: Math.round(768 * h / w), size: opt.size || 64, body: opt.body || 0 }), w, h, X(px), py, Z(pz), ry); p.userData.plate = lines[0]; return p; };
    plate(['Stairs', 'Main hall'], 1.4, 0.42, -4.0, 3.2, ZB + 0.12, 0, { body: 40 });
    plate(['Services', 'Devlog · Odin'], 1.4, 0.42, X1 - 0.12, 3.2, 1.55, -Math.PI / 2, { body: 40 });

    /* ---- overhead: wood-slat canopies + halo ring pendants ---- */
    const canopy = (x1, x2, z1, z2) => { const y = 3.55; for (let sx = x1 + 0.1; sx < x2; sx += 0.2) box(0.07, 0.09, z2 - z1, wood, X(sx), y, Z((z1 + z2) / 2)).userData.noCollide = 1;
      for (const zz of [z1, z2]) box(x2 - x1, 0.12, 0.08, wood, X((x1 + x2) / 2), y + 0.1, Z(zz)).userData.noCollide = 1;
      for (const [cx, cz] of [[x1 + 0.3, z1], [x2 - 0.3, z1], [x1 + 0.3, z2], [x2 - 0.3, z2]]) box(0.015, H - y, 0.015, mat.dark, X(cx), (H + y) / 2, Z(cz)).userData.noCollide = 1; };
    canopy(-9.7, -3.3, -1.0, 5.4); canopy(4.7, 9.8, -4.95, 0.5);
    const ringM = new T.MeshBasicMaterial({ color: 0xffe6b8, toneMapped: false }); ringM.userData = {};
    const halo = (px, pz, r, y = 3.15) => { const g = new T.Mesh(new T.TorusGeometry(r, 0.045, 8, 56).rotateX(Math.PI / 2), ringM); g.position.set(X(px), y, Z(pz)); g.userData.noCollide = 1; ctx.scene.add(g);
      box(r * 2 + 0.06, 0.03, 0.03, trim, X(px), y + 0.04, Z(pz)).userData.noCollide = 1;
      for (let k = 0; k < 3; k++) { const a = k * 2.094; box(0.008, H - y, 0.008, mat.dark, X(px + Math.cos(a) * r), (H + y) / 2, Z(pz + Math.sin(a) * r)).userData.noCollide = 1; } return g; };
    halo(-5.8, -2.8, 1.0); halo(7.25, -2.2, 1.15, 3.2);

    /* ---- Collaboration Hub (left) ---- */
    const HX = -6.4, HZ = 2.2;
    box(5.6, 0.03, 4.8, ctx.rug ? ctx.rug(0x6b6358) : M(0x4a443c), X(HX), 0.03, Z(HZ)); box(5.7, 0.02, 4.9, trim, X(HX), 0.02, Z(HZ));
    // round coffee table: wood top, brass ring, pedestal
    { const top = put(new T.CylinderGeometry(0.62, 0.62, 0.05, 32), wood, X(HX), 0.44, Z(HZ)); top.name = 'hub table';
      put(new T.CylinderGeometry(0.635, 0.635, 0.02, 32), trim, X(HX), 0.41, Z(HZ)); put(new T.CylinderGeometry(0.1, 0.14, 0.38, 16), mat.dark, X(HX), 0.2, Z(HZ)); put(new T.CylinderGeometry(0.34, 0.36, 0.03, 24), mat.dark, X(HX), 0.015, Z(HZ));
      put(new T.CylinderGeometry(0.05, 0.045, 0.1, 14), S(0xf0ece4, 0.35), X(HX + 0.2), 0.515, Z(HZ - 0.1)); put(new T.BoxGeometry(0.3, 0.03, 0.22), S(0x1d2a44, 0.7), X(HX - 0.18), 0.48, Z(HZ + 0.12), 0.4); }
    // sofas: GLB Sofa_01 x3 + an arm chair on tiers 1-2 (props module, see PLACE); tier 0 gets these simple sofas instead
    const sofas = [[HX, HZ - 1.95, 0, 2.2], [HX - 2.35, HZ, Math.PI / 2, 2.2], [HX, HZ + 1.95, Math.PI, 2.2]];
    ctx.hubSofas = sofas.map(([sx, sz, ry]) => [X(sx), Z(sz), ry]);
    if (ctx.tier === 0) for (const [sx, sz, ry, w] of sofas) { const g = new T.Group(); g.position.set(X(sx), 0, Z(sz)); g.rotation.y = ry; ctx.scene.add(g);
      box(w, 0.42, 0.85, fab, 0, 0.21, 0, g); box(w, 0.5, 0.2, fab, 0, 0.62, -0.33, g); for (const s of [-1, 1]) box(0.2, 0.6, 0.85, fab, s * (w / 2 - 0.1), 0.3, 0, g); }
    // wall-mounted whiteboard (aluminium frame + marker tray) on the left wall
    { const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const g = c.getContext('2d'); g.fillStyle = '#f5f7f9'; g.fillRect(0, 0, 1024, 576);
      g.fillStyle = '#1d2a44'; g.font = '700 54px Inter, system-ui, sans-serif'; g.fillText('Collaboration Hub', 40, 80); g.fillStyle = '#c9ced6'; g.fillRect(40, 100, 944, 4);
      g.strokeStyle = '#2b5fa8'; g.lineWidth = 6; for (const [bx, by, t] of [[60, 160, 'Idea'], [380, 160, 'Build'], [700, 160, 'Ship']]) { g.strokeRect(bx, by, 260, 110); g.fillStyle = '#2b5fa8'; g.font = '600 40px Inter, sans-serif'; g.fillText(t, bx + 70, by + 70); }
      g.beginPath(); g.moveTo(320, 215); g.lineTo(380, 215); g.moveTo(640, 215); g.lineTo(700, 215); g.stroke();
      const notes = [['#ffe27a', 'Elderverse town lots'], ['#9fe0b5', 'Merch replicas'], ['#ffb3c1', 'Devlog clips'], ['#a9d1ff', 'Voice chat']];
      notes.forEach(([col, t], i) => { const nx = 60 + i * 235, ny = 330; g.fillStyle = col; g.fillRect(nx, ny, 210, 170); g.fillStyle = '#1d2a44'; g.font = '500 28px Inter, sans-serif'; let ln = '', y = ny + 50; for (const w of t.split(' ')) { if (g.measureText(ln + w).width > 180 && ln) { g.fillText(ln, nx + 14, y); y += 34; ln = ''; } ln += w + ' '; } g.fillText(ln, nx + 14, y); });
      const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
      const alu = S(0xb8bcc4, 0.35, 0.6), wz = -0.7, wx = X0 + 0.13;
      box(0.03, 1.12, 2.0, alu, X(wx - 0.01), 1.5, Z(wz)).userData.noCollide = 1; box(0.07, 0.04, 1.6, alu, X(wx + 0.03), 0.92, Z(wz)).userData.noCollide = 1;
      const wb = new T.Mesh(new T.PlaneGeometry(1.9, 1.02), new T.MeshBasicMaterial({ map: tx, toneMapped: false })); wb.position.set(X(wx + 0.01), 1.5, Z(wz)); wb.rotation.y = Math.PI / 2; wb.userData.label = 'Collaboration Hub whiteboard'; wb.userData.keep = 1; ctx.scene.add(wb); }
    // hanging ring planter over the coffee table: brass hoop wrapped in trailing greenery, warm light ring inside, three cables
    { const y = 3.0, r = 1.15; put(new T.TorusGeometry(r, 0.035, 8, 64).rotateX(Math.PI / 2), trim, X(HX), y, Z(HZ)).userData.noCollide = 1;
      const lr = put(new T.TorusGeometry(r - 0.12, 0.03, 6, 56).rotateX(Math.PI / 2), ringM, X(HX), y - 0.04, Z(HZ)); lr.userData.noCollide = 1;
      for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; box(0.008, H - y, 0.008, mat.dark, X(HX + Math.cos(a) * r), (H + y) / 2, Z(HZ + Math.sin(a) * r)).userData.noCollide = 1; }
      for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2 + rnd() * 0.08, rr = r + (rnd() - 0.5) * 0.16; leaf(X(HX + Math.cos(a) * rr), y + 0.04 + (rnd() - 0.3) * 0.16, Z(HZ + Math.sin(a) * rr), 1.05);
        if (k % 4 === 0) for (let d = 1; d <= 2; d++) leaf(X(HX + Math.cos(a) * (r + 0.05)), y - 0.13 * d, Z(HZ + Math.sin(a) * (r + 0.05)), 0.7); } }
    plate(['Collaboration Hub', 'Meet, plan and pair up'], 2.2, 0.55, HX, 2.95, 5.45, 0, { body: 34 });
    /* bookcase on the back wall of the hub (Joshua 11:29 PM: the thin moving pole 'shelf' here was the live-construction rolling
       scaffold, now gone indoors). Solid walnut carcass with real thickness: plinth on the floor, 0.04 m sides, 0.05 m top with
       a crown, full back panel, four shelves; books in rows (a few leaning), bookends, a vase, a framed photo, a small potted
       plant, a box file. All plain boxes/cylinders on shared materials, so static batching folds it into existing draw calls. */
    { const BX = -6.6, BW = 1.8, BD = 0.38, BH = 2.05, bz = ZB + 0.13 + BD / 2, walnut = S(0x4a2f1f, 0.6), back = S(0x2c1d14, 0.8);
      const bk = [S(0x7a2a2a), S(0x2a4a6a), S(0x3d5a3a), S(0xc9b07a), S(0x5a3a5e), S(0x1f2a36), S(0xb8642e)], paper = S(0xece4d2, 0.9), ceramic = S(0xd8d2c6, 0.35), terra = S(0xa8583a, 0.8);
      box(BW - 0.06, 0.1, BD - 0.05, mat.dark, X(BX), 0.05, Z(bz + 0.02));                                  // recessed plinth on the floor
      for (const sx of [-1, 1]) box(0.04, BH - 0.1, BD, walnut, X(BX + sx * (BW / 2 - 0.02)), 0.1 + (BH - 0.1) / 2, Z(bz));   // sides
      box(BW + 0.04, 0.05, BD + 0.03, walnut, X(BX), BH + 0.025, Z(bz + 0.005)); box(BW + 0.08, 0.025, BD + 0.05, trim, X(BX), BH + 0.0625, Z(bz + 0.01));   // top + brass crown
      box(BW - 0.08, BH - 0.1, 0.02, back, X(BX), 0.1 + (BH - 0.1) / 2, Z(bz - BD / 2 + 0.01));               // back panel
      const shelfY = [0.1, 0.55, 0.98, 1.4, 1.78];
      shelfY.forEach(y => box(BW - 0.08, 0.035, BD - 0.02, walnut, X(BX), y + 0.0175, Z(bz + 0.01)));
      box(BW - 0.08, 0.02, 0.012, trim, X(BX), 0.98 + 0.0175, Z(bz + BD / 2 - 0.004));                      // brass lip on the middle shelf
      const t0 = y => y + 0.035, inner = BW / 2 - 0.06, fz = Z(bz + 0.02);
      const row = (y, xa, xb, maxH, lean) => { let px = xa, k = 0; while (px < xb - 0.03) { const w = 0.025 + rnd() * 0.035, h = maxH * (0.72 + rnd() * 0.28), d = 0.17 + rnd() * 0.08;
          if (px + w > xb) break; const o = box(w, h, d, bk[Math.floor(rnd() * bk.length)], X(BX + px + w / 2), t0(y) + h / 2, fz);
          if (lean && k === 0) { o.rotation.z = -0.22; o.position.x += 0.04; } px += w + 0.004; k++; } return px; };
      const bookend = (px, y) => { box(0.012, 0.14, 0.12, trim, X(BX + px), t0(y) + 0.07, fz); box(0.08, 0.008, 0.12, trim, X(BX + px + 0.04), t0(y) + 0.004, fz); };
      // shelf 1 (bottom): two box files + a stack of large books lying flat
      for (const q of [0, 1]) box(0.09, 0.32, 0.26, q ? bk[5] : bk[1], X(BX - inner + 0.06 + q * 0.1), t0(0.1) + 0.16, fz);
      for (let i = 0; i < 4; i++) box(0.34 - i * 0.02, 0.045, 0.24, bk[(i + 2) % bk.length], X(BX + 0.45), t0(0.1) + 0.0225 + i * 0.047, fz);
      row(0.1, -0.1, 0.18, 0.36, false);
      // shelf 2: a row of books with a bookend, a ceramic vase
      row(0.55, -inner + 0.02, 0.1, 0.33, true); bookend(0.12, 0.55);
      put(new T.CylinderGeometry(0.06, 0.08, 0.26, 16), ceramic, X(BX + 0.55), t0(0.55) + 0.13, fz);
      put(new T.CylinderGeometry(0.035, 0.06, 0.06, 16), ceramic, X(BX + 0.55), t0(0.55) + 0.29, fz);
      // shelf 3: framed photo (crest print) leaning, books
      { const fr = box(0.3, 0.38, 0.025, mat.dark, X(BX - 0.5), t0(0.98) + 0.19, Z(bz - 0.06)); fr.rotation.x = -0.12; const pic = box(0.24, 0.31, 0.006, paper, X(BX - 0.5), t0(0.98) + 0.19, Z(bz - 0.045)); pic.rotation.x = -0.12; }
      row(0.98, -0.25, inner - 0.02, 0.3, false);
      // shelf 4: small potted plant + a few books + a brass object
      put(new T.CylinderGeometry(0.09, 0.07, 0.15, 14), terra, X(BX - 0.55), t0(1.4) + 0.075, fz);
      for (let k = 0; k < 9; k++) leaf(X(BX - 0.55 + (rnd() - 0.5) * 0.16), t0(1.4) + 0.2 + rnd() * 0.12, fz + (rnd() - 0.5) * 0.14, 0.6);
      row(1.4, -0.2, 0.35, 0.28, true);
      put(new T.SphereGeometry(0.07, 16, 12), trim, X(BX + 0.6), t0(1.4) + 0.07, fz);
      // top shelf: books + stacked boxes
      row(1.78, -inner + 0.02, 0.2, 0.2, false);
      box(0.3, 0.12, 0.22, paper, X(BX + 0.5), t0(1.78) + 0.06, fz); box(0.24, 0.08, 0.18, bk[3], X(BX + 0.5), t0(1.78) + 0.16, fz);
      (ctx.extraCols ||= []).push([X(BX - BW / 2 - 0.03), Z(bz - BD / 2), X(BX + BW / 2 + 0.03), Z(bz + BD / 2 + 0.03)]); }

    /* ---- Coders (back right): two rows of three desks; lobby-stations seats the agents (Games coders) ---- */
    ctx.lobbyStations = { coders: [], store: [[8.75 + x, 3.85 + z]] };
    for (const dz of [-3.4, -0.9]) for (const dx of [5.6, 7.3, 9.0]) ctx.lobbyStations.coders.push([X(dx), Z(dz)]);
    box(5.15, 0.03, 5.6, ctx.rug ? ctx.rug(0x5d6470) : M(0x3a3f48), X(7.3), 0.03, Z(-2.2));
    // low planter partition between the coders and the carpet (gap at the back for the elevator doorway path)
    { const px = 4.5, z1 = -3.2, z2 = 0.3; box(0.38, 0.62, z2 - z1, wood, X(px), 0.31, Z((z1 + z2) / 2)); box(0.42, 0.04, z2 - z1 + 0.04, trim, X(px), 0.64, Z((z1 + z2) / 2));
      for (let zz = z1 + 0.15; zz < z2; zz += 0.16) { leaf(X(px + (rnd() - 0.5) * 0.2), 0.72 + rnd() * 0.12, Z(zz), 1.1); if (rnd() < 0.5) leaf(X(px + (rnd() - 0.5) * 0.2), 0.88 + rnd() * 0.12, Z(zz + 0.05), 0.9); } }
    if (cfg?.coders) plate(['Coders', 'Building our games live'], 2.0, 0.5, 7.3, 2.95, 0.55, 0, { body: 34 });   /* 2026-10-16: the Games builders sit at their own Games room desks again (Joshua); the bay sign only shows when lobby-stations seats coders here (lobby config coders:true) */

    /* ---- Hermod's Merch Store (front right) ---- */
    const SX0 = 4.8, SZ0 = 2.6;
    box(X1 - SX0 - 0.1, 0.03, ZF - SZ0 - 0.3, ctx.rug ? ctx.rug(0xb89a72) : M(0x8a7050), X((SX0 + X1) / 2), 0.03, Z((SZ0 + ZF - 0.3) / 2));
    wallZ(SZ0, SX0, X1 - 0.1, 1);                                                             // back wall of the store (faces the store)
    box(0.2, 1.1, 2.2, wood, X(SX0), 0.55, Z(SZ0 + 1.2)); box(0.26, 0.05, 2.24, trim, X(SX0), 1.12, Z(SZ0 + 1.2));   // low side wall by the checkout
    // checkout screen (tall stand facing the carpet) + counter with a card reader
    ctx.merchStore = { cases: [], sign: [X(SX0 - 0.06), 2.95, Z(6.6), -Math.PI / 2], spot: [[X(2.6), 1.6, Z(7.8)], [X(7.4), 1.2, Z(5.4)]] };
    { const kx = X(5.45), kz = Z(3.4), ry = Math.atan2(X(0) - kx, Z(8) - kz), K = new T.Group(); K.position.set(kx, 0, kz); K.rotation.y = ry; ctx.scene.add(K);
      box(0.5, 0.06, 0.4, mat.dark, 0, 0.03, 0, K); box(0.12, 1.1, 0.08, mat.dark, 0, 0.6, -0.05, K); box(0.9, 1.35, 0.06, mat.dark, 0, 1.75, 0, K);
      const c = document.createElement('canvas'); c.width = 512; c.height = 768; const g = c.getContext('2d'); g.fillStyle = '#0b1626'; g.fillRect(0, 0, 512, 768); g.strokeStyle = '#d9b45a'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 748);
      g.fillStyle = '#f3ead7'; g.font = '700 70px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('CHECKOUT', 256, 120);
      g.strokeStyle = '#9fe8ff'; g.lineWidth = 12; g.strokeRect(166, 240, 180, 170); g.beginPath(); g.arc(256, 240, 50, Math.PI, 0); g.stroke();
      g.fillStyle = '#c9bfae'; g.font = '500 38px Inter, sans-serif'; g.fillText('Tees · Hoodies', 256, 510); g.fillText('Mugs · Stickers', 256, 560); g.fillStyle = '#d9b45a'; g.font = '600 36px Inter, sans-serif'; g.fillText(ctx.touch ? 'Tap to shop' : 'Click to shop', 256, 680);
      const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; const scr = new T.Mesh(new T.PlaneGeometry(0.82, 1.24), new T.MeshBasicMaterial({ map: tx, toneMapped: false })); scr.position.set(0, 1.75, 0.035); K.add(scr); scr.userData.label = 'Checkout';
      ctx.onClick(scr, () => (ctx.use('lobbyInfo') || (() => {}))('merch')); }
    { const cx = 6.45, cz = 4.35; box(2.1, 1.0, 0.62, wood, X(cx), 0.5, Z(cz)); box(2.16, 0.05, 0.68, trim, X(cx), 1.02, Z(cz)); box(2.12, 0.06, 0.02, trim, X(cx), 0.1, Z(cz + 0.32)).userData.noCollide = 1;
      box(0.09, 0.02, 0.14, mat.dark, X(cx + 0.5), 1.055, Z(cz)); box(0.34, 0.24, 0.02, mat.dark, X(cx - 0.4), 1.17, Z(cz - 0.05)).rotation.x = -0.3; box(0.18, 0.04, 0.12, M(0xd9b45a), X(cx + 0.05), 1.065, Z(cz + 0.1)); }
    // glass display cases (merch-display fills them with the products): 2 rows of 3
    for (const cz of [5.9, 7.9]) for (const cx of [6.05, 7.4, 8.75]) ctx.merchStore.cases.push([X(cx), Z(cz)]);
    // wall shelving on the right wall: uprights, four shelves, folded tees, mugs, sticker boxes
    { const sx = X1 - 0.3, z1 = 4.9, z2 = 9.2; for (const zz of [z1, (z1 + z2) / 2, z2]) box(0.36, 2.2, 0.04, wood, X(sx), 1.1, Z(zz));
      const tee = [0x15151a, 0x2a3550, 0x7a1f2b, 0x3c5a3a, 0xd9cdb8], mug = S(0xf0ece4, 0.35);
      [0.45, 0.95, 1.45, 1.95].forEach((y, k) => { box(0.38, 0.03, z2 - z1, wood, X(sx), y, Z((z1 + z2) / 2));
        for (let zz = z1 + 0.3; zz < z2 - 0.2; zz += 0.42) { if (k === 2) { put(new T.CylinderGeometry(0.05, 0.045, 0.11, 14), mug, X(sx), y + 0.07, Z(zz)); continue; }
          const c = M(tee[(Math.round(zz * 3) + k) % tee.length]); for (let s = 0; s < 3; s++) box(0.3, 0.05, 0.3, c, X(sx), y + 0.04 + s * 0.052, Z(zz)); } }); }
    // the store's clickable 'Merch Store' sign is placed by merch-display (ctx.merchStore.sign); Hermod's desk sits behind the counter (lobby-stations)

    /* ---- entrance planters either side of the doors (1 m clear of the glass) ---- */
    for (const s of [-1, 1]) { const px = s * 2.35, pz = 8.75; box(1.1, 0.5, 0.5, wood, X(px), 0.25, Z(pz)); box(1.14, 0.04, 0.54, trim, X(px), 0.52, Z(pz));
      for (let k = 0; k < 18; k++) leaf(X(px + (rnd() - 0.5) * 0.95), 0.62 + rnd() * 0.3, Z(pz + (rnd() - 0.5) * 0.35), 1.2); }

    /* ---- plants (every one a different species; core/plants.js hands out the next unused one) ---- */
    for (const [px, pz, s] of [[-3.4, 6.4, 1.1], [4.2, 8.6, 1.1], [-9.3, -4.55, 1.15], [-9.3, 8.9, 1.1], [-3.75, -4.6, 0.9], [9.4, 0.15, 1.0], [5.25, 9.0, 0.9]]) kit.plant(ctx, X(px), Z(pz), s);
    ctx.directoryAt = { x: X(X0 + 0.14), y: 1.5, z: Z(6.6), ry: Math.PI / 2 };   /* 'Switch to Classic' plaque on the left wall by the glass */

    ctx.extend(X(X0), Z(ZB), X(X1), Z(ZF));
    ctx.spot('lobby', [x, 1.65, z + 8.6], [x, 1.45, z - 2], 'Lobby');   // spawn just inside the entrance, looking down the carpet at Freyja
    ctx.spot('hub', [X(-2.6), 1.6, Z(6.8)], [X(HX), 1.0, Z(HZ)], 'Collaboration Hub');
    if (cfg?.coders) ctx.spot('coders', [X(3.4), 1.6, Z(1.6)], [X(7.3), 1.0, Z(-2.4)], 'Coders');
    this.ctx = ctx;
  },
  /* QA helper: __ewsOffice.iso(x, y, z, lookX, lookY, lookZ, cutY) = isometric-style cutaway camera (walls/ceiling above cutY
     are clipped away); __ewsOffice.iso() = back to the walking camera. Debug only: nothing runs unless it is called. */
  onFrame() {
    const c = this.ctx, O = window.__ewsOffice; if (!c || !O) return;
    if (!O.iso) O.iso = (...a) => { if (!a.length) { this.iso = null; c.renderer.clippingPlanes = []; return 'off'; } const [px, py, pz, lx, ly, lz, cut = 3.0] = a; this.iso = { p: [px, py, pz], l: [lx, ly, lz] };
      c.renderer.clippingPlanes = [new c.THREE.Plane(new c.THREE.Vector3(0, -1, 0), cut)]; return 'on'; };
    /* QA helper: __ewsOffice.meshesIn(x0, z0, x1, z1) = meshes whose world box overlaps that floor rect (name, owner chain, box);
       __ewsOffice.movers(x0, z0, x1, z1, ms) resolves to the ones that moved/rotated/scaled within ms (default 1500) */
    if (!O.movers) { const T = c.THREE, bb = new T.Box3(), path = o => { const a = []; for (let p = o; p && p !== c.scene && a.length < 5; p = p.parent) a.push(p.name || p.userData?.prop || p.userData?.label || p.type); return a.join('<'); };
      const hit = (x0, z0, x1, z1) => { const out = []; c.scene.traverse(o => { if (!o.isMesh && !o.isInstancedMesh) return; bb.setFromObject(o); if (bb.isEmpty() || bb.max.x < x0 || bb.min.x > x1 || bb.max.z < z0 || bb.min.z > z1) return; const sz = bb.getSize(new T.Vector3()); if (sz.x > 6 || sz.z > 6) return; out.push(o); }); return out; };
      O.meshesIn = (x0, z0, x1, z1) => hit(x0, z0, x1, z1).map(o => { bb.setFromObject(o); return { p: path(o), vis: o.visible, b: [...bb.min.toArray(), ...bb.max.toArray()].map(v => +v.toFixed(2)) }; });
      O.movers = (x0, z0, x1, z1, ms = 1500) => { const L = hit(x0, z0, x1, z1).map(o => [o, o.matrixWorld.clone()]); return new Promise(r => setTimeout(() => r(L.filter(([o, m]) => !o.matrixWorld.equals(m)).map(([o]) => { bb.setFromObject(o); return { p: path(o), b: [...bb.min.toArray(), ...bb.max.toArray()].map(v => +v.toFixed(2)) }; })), ms)); }; }
    if (this.iso) { c.cam.position.set(...this.iso.p); c.cam.lookAt(...this.iso.l); if (c.scene.fog) { c.scene.fog.near = 200; c.scene.fog.far = 400; } }
  },
};
