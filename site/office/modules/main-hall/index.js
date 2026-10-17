// Main hall + open floor dressing (Joshua 2026-10-16: "big blank gray box rooms on an empty open floor"). Runs after team-halls
// and furnishes the open space between the lobby's back wall and the team rooms, and the open floor down both sides of the
// room block: runner rugs, lounge clusters (sofas, low table, floor lamp, rug, halo pendant), long greenery planters and
// hanging wayfinding boards. Plain boxes/cylinders on shared materials (batched) + a few sign panels. Remove from modules.json to undo.
export default {
  setup(ctx) {
    const { THREE: T, box, M, mat } = ctx, spots = Object.fromEntries(Object.entries(ctx.teamSpot || {}).filter(([, p]) => Math.abs(p[0]) < 150)), pts = Object.values(spots);   /* G rooms only: the teams moved upstairs (team-halls cfg.floors) */
    const W = 10, D = 9, rx0 = Math.min(...pts.map(p => p[0])) - W / 2, rx1 = Math.max(...pts.map(p => p[0])) + W / 2;
    const rzF = Math.max(...pts.map(p => p[1])) + D / 2, rzB = Math.min(...pts.map(p => p[1])) - D / 2;   // room block: front (doors) / back
    const S = (c, r = 0.7) => (ctx.M.standard ? new T.MeshStandardMaterial({ color: c, roughness: r }) : new T.MeshLambertMaterial({ color: c }));
    const fab = mat.fabric || mat.dark, leafM = [S(0x3f7a3a, 0.8), S(0x2f6630, 0.8), S(0x5a8f45, 0.8)], LG = [new T.IcosahedronGeometry(0.15, 0), new T.IcosahedronGeometry(0.11, 0)];
    const lamp = new T.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), ring = new T.MeshBasicMaterial({ color: 0xffe6b8, toneMapped: false });
    let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const add = (geo, m, x, y, z, ry = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; ctx.scene.add(o); return o; };
    const rug = (w, d, x, z, col, ry = 0) => { const a = box(w, 0.03, d, ctx.rug ? ctx.rug(col) : M(col), x, 0.03, z); a.rotation.y = ry; const b = box(w + 0.1, 0.02, d + 0.1, mat.trim, x, 0.02, z); b.rotation.y = ry; };
    const sofa = (x, z, ry, w = 2.0) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
      box(w, 0.42, 0.85, fab, 0, 0.21, 0, g); box(w, 0.5, 0.2, fab, 0, 0.62, -0.33, g); for (const s of [-1, 1]) box(0.2, 0.6, 0.85, fab, s * (w / 2 - 0.1), 0.3, 0, g);
      for (const s of [-1, 1]) box(0.06, 0.06, 0.06, mat.dark, s * (w / 2 - 0.12), 0.03, 0.3, g); };
    const planter = (x, z, len, rot = 0) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; ctx.scene.add(g);
      box(len, 0.62, 0.42, mat.wood, 0, 0.31, 0, g); box(len + 0.04, 0.04, 0.46, mat.trim, 0, 0.64, 0, g);
      for (let k = 0; k < len / 0.15; k++) { const o = new T.Mesh(LG[k % 2], leafM[Math.floor(r() * 3)]); o.position.set(-len / 2 + 0.1 + k * 0.15, 0.72 + r() * 0.2, (r() - 0.5) * 0.25); o.rotation.set(r() * 3, r() * 6, 0); o.scale.setScalar(0.9 + r() * 0.6); o.userData.noCollide = 1; g.add(o); } };
    const halo = (x, z, rad = 1.1, y = 3.2) => { const o = add(new T.TorusGeometry(rad, 0.045, 8, 48).rotateX(Math.PI / 2), ring, x, y, z); o.userData.noCollide = 1;
      for (let k = 0; k < 3; k++) { const a = k * 2.094; box(0.008, 4 - y, 0.008, mat.dark, x + Math.cos(a) * rad, (4 + y) / 2, z + Math.sin(a) * rad).userData.noCollide = 1; } };
    const lounge = (x, z, ry = 0) => {   // rug, two sofas facing over a low table, floor lamp, halo pendant
      const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
      rug(3.6, 3.0, x, z, 0x5f5a52, ry); let [a, b] = at(0, -1.0); sofa(a, b, ry); [a, b] = at(0, 1.0); sofa(a, b, ry + Math.PI);
      add(new T.CylinderGeometry(0.5, 0.5, 0.05, 28), mat.wood, x, 0.4, z); add(new T.CylinderGeometry(0.08, 0.12, 0.36, 12), mat.dark, x, 0.19, z);
      [a, b] = at(1.55, -1.0); add(new T.CylinderGeometry(0.015, 0.015, 1.5, 8), mat.dark, a, 0.75, b); add(new T.CylinderGeometry(0.18, 0.24, 0.26, 16, 1, true), lamp, a, 1.55, b); add(new T.CylinderGeometry(0.16, 0.18, 0.03, 16), mat.dark, a, 0.015, b);
      halo(x, z); };
    const board = (x, z, ry, lines) => {   // hanging wayfinding board: brass rod + cords + navy/gold panel
      const g = new T.Group(); g.position.set(x, 2.75, z); g.rotation.y = ry; ctx.scene.add(g);
      const cv = ctx.textCanvas(lines, { w: 900, h: 400, size: 62, body: 40 }), p = ctx.panel(cv, 2.2, 0.98, 0, 0, 0.012, 0, g); p.userData.plate = lines[0];
      box(2.24, 1.02, 0.02, mat.dark, 0, 0, 0, g); ctx.panel(cv, 2.2, 0.98, 0, 0, -0.012, Math.PI, g);   /* two-sided: a readable face each way (a DoubleSide panel read mirrored from behind) */
      box(2.3, 0.05, 0.05, mat.trim, 0, 0.53, 0, g); for (const sx of [-1, 1]) box(0.01, 4 - 3.3, 0.01, mat.dark, sx * 1.0, 0.53 + (4 - 3.3) / 2, 0, g); return p; };
    /* 2026-10-16 (Joshua): the team rooms moved to their own floors. G keeps only the lobby; the hall behind the crest wall
       gets a lounge either side of the elevator core and a board pointing upstairs. Each upper floor gets the same family of
       dressing: a runner rug along the room fronts, boards at the elevator exit naming the rooms left/right, lounges and
       window planters, kept clear of the arcade (Floor 2) and the architecture studio (Floor 3, front left). */
    if (!pts.length) {
      const core = ctx.core || { x: 0, fz: -7.7, W: 4.6 }, up = ctx.upperTeams || {};
      lounge(-7.4, -9.6, Math.PI / 2); planter(-7.2, -5.6, 4.6); planter(7.2, -5.6, 4.6); planter(-4.6, -12.6, 2.2); halo(-7.4, -9.6);
      const fl = ['2 · Games', '3 · Architecture, Design & Marketing', '4 · Client Sites & Call Center', '5 · Ops & Leadership'];
      /* building directory (Joshua 11:51 PM: the old board crammed every floor into two wrapped lines): one row per floor,
         number column + name, each row shrunk to fit its own width; two-sided, hung high enough to clear heads (bottom 2.3 m) */
      const directory = (x, z, ry) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 720; const g2 = c.getContext('2d'), Tt = k => (ctx.t ? ctx.t(k) : k);
        const rows = [['G', Tt('Lobby · Reception · Merch')], ['2', Tt('Games')], ['3', Tt('Architecture, Design & Marketing')], ['4', Tt('Client Sites & Call Center')], ['5', Tt('Ops & Leadership')]];
        const draw = () => { g2.fillStyle = '#140c22'; g2.fillRect(0, 0, 1024, 720); g2.strokeStyle = '#d9b45a'; g2.lineWidth = 8; g2.strokeRect(8, 8, 1008, 704);
          g2.fillStyle = '#d9b45a'; g2.font = '700 64px Cinzel, Georgia, serif'; g2.textBaseline = 'middle'; g2.fillText(Tt('Directory'), 44, 70);
          g2.fillStyle = '#f3ead7'; g2.font = '500 34px Inter, system-ui, sans-serif'; g2.fillText(Tt('Elevator and stairs to the right of the crest wall'), 44, 128);
          rows.forEach(([n, name], i) => { const y = 212 + i * 96; g2.fillStyle = 'rgba(217,180,90,.25)'; g2.fillRect(44, y + 44, 936, 2);
            g2.fillStyle = '#d9b45a'; g2.font = '700 60px Cinzel, Georgia, serif'; g2.fillText(n, 60, y); let s = 50; g2.font = `500 ${s}px Inter, system-ui, sans-serif`;
            while (g2.measureText(name).width > 820 && s > 30) { s -= 2; g2.font = `500 ${s}px Inter, system-ui, sans-serif`; } g2.fillStyle = '#f3ead7'; g2.fillText(name, 150, y); }); };
        draw(); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; tx.userData.text = 'Directory ' + rows.map(r => r.join(' ')).join(' '); document.fonts?.ready.then(() => { draw(); tx.needsUpdate = true; });
        const gr = new T.Group(); gr.position.set(x, 2.95, z); gr.rotation.y = ry; ctx.scene.add(gr); const w = 1.8, h = w * 720 / 1024;
        const p = ctx.panel(tx, w, h, 0, 0, 0.012, 0, gr); p.userData.plate = 'Directory'; p.material.toneMapped = false; ctx.panel(tx, w, h, 0, 0, -0.012, Math.PI, gr).material.toneMapped = false;
        box(w + 0.04, h + 0.04, 0.02, mat.dark, 0, 0, 0, gr); box(w + 0.1, 0.05, 0.05, mat.trim, 0, h / 2 + 0.03, 0, gr); for (const sx of [-1, 1]) box(0.01, 4.05 - 2.95 - h / 2, 0.01, mat.dark, sx * w * 0.42, (4.05 - 2.95 + h / 2) / 2, 0, gr); return p; };
      directory(-4.0, -6.9, 0);
      board(4.0, -6.6, 0, ['Elevator · Stairs', 'Floors 2 to 5', 'Stairs: door on the right']);
      for (const n of ['2', '3', '4', '5']) { const cx = core.x + (+n - 1) * 400, fz = core.fz, rooms = up[n] || [];
        const L = rooms.filter(r => r.x < cx).map(r => r.name), R = rooms.filter(r => r.x > cx).map(r => r.name);
        rug(26.4, 2.0, cx, fz + 2.7, 0x7a2f3a);   // runner along the room fronts, crossing the elevator exit
        if (n === '3' && ctx.archStudio) L.push('Architecture studio ↙');
        board(cx - 4.6, fz + 3.4, Math.PI, [L.length ? '← ' + L.join(' · ') : 'Lounge ←', 'Floor ' + n]);
        board(cx + 4.6, fz + 3.4, Math.PI, [R.length ? R.join(' · ') + ' →' : 'Lounge →', 'Floor ' + n]);
        const lx = n === '2' ? 12.6 : 10.5, lz = fz + 12;
        if (!(n === '3' && ctx.archStudio)) lounge(cx - lx, lz, n === '2' ? Math.PI / 2 : 0);
        lounge(cx + lx, lz, n === '2' ? Math.PI / 2 : 0);
        planter(cx - 6.5, fz + 20.9, 4.4); planter(cx + 6.5, fz + 20.9, 4.4);
        if (n !== '2') { planter(cx, fz + 13.5, 3.2); halo(cx, fz + 13.5, 1.3); } }
      return;
    }
    const names = (ctx.roster?.teams || []).filter(t => spots[t.key || t.id]).map(t => [t.name, spots[t.key || t.id][0]]);
    const left = names.filter(n => n[1] < -0.5).map(n => n[0]), mid = names.filter(n => Math.abs(n[1]) <= 0.5).map(n => n[0]), right = names.filter(n => n[1] > 0.5).map(n => n[0]);
    const zH = (rzF + -5.2) / 2;   // middle of the main hall (lobby back wall at z = -5.2)
    // runner rug along the room fronts + up the middle to the elevator core
    rug(rx1 - rx0 - 1, 2.0, (rx0 + rx1) / 2, rzF + 1.5, 0x7a2f3a);
    // lounges either side of the elevator core, clear of the release gate (x +6.4..9.6 at z -10)
    lounge(-9.5, zH, 0); lounge(12.6, zH + 0.6, Math.PI / 2);
    // planters on the back face of the lobby wall, and between lounge and core
    planter(-7.2, -5.6, 4.6); planter(7.2, -5.6, 4.6); planter(-5.2, zH + 2.2, 1.8, Math.PI / 2);
    // wayfinding boards at the two lobby doorways (facing visitors coming from the lobby) + one at each side of the room block
    board(-4.0, -6.6, 0, ['Team rooms', `← ${left.join(' · ')}`, `${mid.join(' · ')} ↓`]);
    board(4.0, -6.6, 0, ['Team rooms', `${right.join(' · ')} →`, 'Elevator: Floors 2 to 5']);
    // open floor down both sides of the room block: alternating lounge / planter rows with runner rugs
    for (const side of [-1, 1]) { const x = side < 0 ? rx0 - 3.2 : rx1 + 3.2; rug(2.0, rzF - rzB - 2, x + side * 0.6, (rzF + rzB) / 2, 0x6b4a3a);
      for (let zz = rzF - 4, k = 0; zz > rzB + 3; zz -= 7, k++) { if (k % 2 === 0) lounge(x + side * 0.4, zz, Math.PI / 2); else { planter(x - side * 1.0, zz, 2.6, Math.PI / 2); halo(x, zz, 0.9); } }
      board(x, rzF - 0.6, 0, ['Team rooms', side < 0 ? left.join(' · ') : right.join(' · '), 'Lobby ↑']); }
    ctx.extend(rx0 - 6, rzB, rx1 + 6, -5);
  },
};
