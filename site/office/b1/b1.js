// B1 Command Center (Joshua 2026-10-16 23:58 + 2026-10-17 00:17). Served ONLY to allowlisted IPs (functions/office/b1/_middleware.js);
// data from /api/office/b1/feed (also IP-locked). Dark slate + walnut, low warm baked light (emissive only, no realtime lights),
// curved wall of 7 live monitors (canvas textures, refreshed at most once per second), round command table with a small live world map,
// Ægir's raised director desk, three lead consoles, seats for Sleipnir/Sunna/Alvíss/Ívaldi, coffee bar (off-duty lounge). Built at x offset ox.
export function buildB1(ctx, core, ox) {
  const { THREE } = ctx, cx = core.x + ox, fz = core.fz, g = new THREE.Group(); g.userData.mod = 'floor-B1'; ctx.scene.add(g);
  const cols = (ctx.extraCols ||= []), L = c => new THREE.MeshLambertMaterial({ color: c }), E = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const slate = L(0x2b2f36), walnut = L(0x5a3a24), brass = L(0xb08a4a), dark = L(0x15171b), warm = E(0xffc98a), seat = L(0x3a2f2a);
  const add = (geo, m, x, y, z, ry = 0, solid = false, w = 0, d = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.matrixAutoUpdate = false; o.updateMatrix(); g.add(o);
    if (solid) cols.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]); return o; };
  const X0 = cx - 12, X1 = cx + 12, Z0 = fz - 6, Z1 = fz + 16;
  add(new THREE.BoxGeometry(24, 0.2, 22), slate, cx, -0.1, (Z0 + Z1) / 2);
  add(new THREE.BoxGeometry(24, 0.1, 22), dark, cx, 3.2, (Z0 + Z1) / 2);
  for (const [x, z, w, d] of [[cx, Z0, 24, 0.3], [cx, Z1, 24, 0.3], [X0, (Z0 + Z1) / 2, 0.3, 22], [X1, (Z0 + Z1) / 2, 0.3, 22]]) add(new THREE.BoxGeometry(w, 3.2, d), walnut, x, 1.6, z, 0, true, w, d);
  for (let x = X0 + 3; x < X1; x += 6) for (let z = Z0 + 3; z < Z1; z += 6) add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), warm, x, 3.13, z);   // warm downlight discs (emissive)
  // curved monitor wall at the far end
  const MON = ['World map', 'Agent status', 'FPS per tier', 'Deploys + hot updates', 'Security patrols', 'Construction gate', 'Budget'];
  const mons = MON.map((title, i) => { const cv = document.createElement('canvas'); cv.width = 384; cv.height = 216; const tex = new THREE.CanvasTexture(cv);
    const a = (i - 3) * 0.26, R = 11, x = cx + Math.sin(a) * R, z = Z1 - 1.4 - (1 - Math.cos(a)) * R;
    const tx = cx, tz = fz + 6, yaw = Math.atan2(tx - x, tz - z), nx = Math.sin(yaw), nz = Math.cos(yaw);   // face the command table
    add(new THREE.BoxGeometry(3.1, 1.85, 0.12), dark, x - nx * 0.08, 1.9, z - nz * 0.08, yaw);
    add(new THREE.PlaneGeometry(2.9, 1.65), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), x, 1.9, z, yaw);
    return { title, cv, tex }; });
  // round command table with the live map on top
  const mapCv = document.createElement('canvas'); mapCv.width = mapCv.height = 256; const mapTex = new THREE.CanvasTexture(mapCv);
  add(new THREE.CylinderGeometry(1.8, 1.8, 0.08, 40), walnut, cx, 0.95, fz + 6, 0, true, 3.6, 3.6);
  add(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 20), dark, cx, 0.45, fz + 6);
  const top = add(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ map: mapTex, toneMapped: false }), cx, 1.0, fz + 6); top.rotation.x = -Math.PI / 2; top.updateMatrix();
  // Ægir's raised director desk, lead consoles, specialist seats, coffee bar
  add(new THREE.BoxGeometry(5, 0.35, 3), walnut, cx, 0.17, fz + 11.5, 0, true, 5, 3);
  add(new THREE.BoxGeometry(2.6, 0.75, 0.9), walnut, cx, 0.72, fz + 11.2, 0, true, 2.6, 0.9);
  add(new THREE.BoxGeometry(2.4, 0.04, 0.05), brass, cx, 1.1, fz + 10.75);
  const consoles = [[-6, 7, 'Bestla'], [6, 7, 'Nerthus'], [-6, 10, 'Fjörgyn']];
  for (const [dx, dz] of consoles) { add(new THREE.BoxGeometry(1.8, 0.8, 0.8), slate, cx + dx, 0.4, fz + dz, 0, true, 1.8, 0.8); add(new THREE.BoxGeometry(0.9, 0.55, 0.05), E(0x274a5a), cx + dx, 1.15, fz + dz - 0.2); }
  // Sunna's lighting/visual-QA post: a compact read-only monitor, tied to the shared day/night state.
  // It uses emissive materials only (no realtime light) and refreshes at most once per second.
  const lightCanvas = document.createElement('canvas'); lightCanvas.width = 512; lightCanvas.height = 256;
  const lightTexture = new THREE.CanvasTexture(lightCanvas);
  const lightDeskX = cx - 6.35, lightDeskZ = fz + 13;
  add(new THREE.BoxGeometry(1.35, 0.72, 0.78), walnut, lightDeskX, 0.36, lightDeskZ, 0, true, 1.35, 0.78);
  add(new THREE.BoxGeometry(1.05, 0.78, 0.08), dark, cx - 7.13, 1.37, lightDeskZ, -Math.PI / 2);
  add(new THREE.BoxGeometry(0.12, 0.36, 0.12), brass, cx - 7.04, 0.88, lightDeskZ);
  const lightScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.68), new THREE.MeshBasicMaterial({ map: lightTexture, toneMapped: false, side: THREE.DoubleSide }));
  lightScreen.position.set(cx - 7.18, 1.37, lightDeskZ); lightScreen.rotation.y = -Math.PI / 2; lightScreen.userData.noCollide = 1; g.add(lightScreen);
  const drawLighting = () => {
    const state = ctx.dayNight || window.__ewsOffice?.dayNight?.() || {};
    const fps = window.__ewsOffice?.fps?.();
    const c = lightCanvas.getContext('2d'); c.fillStyle = '#111820'; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = '#9b8050'; c.lineWidth = 3; c.strokeRect(8, 8, 496, 240);
    c.fillStyle = '#d9c18f'; c.font = '600 24px system-ui, sans-serif'; c.fillText('SUNNA  ·  LIGHTING', 24, 42);
    c.fillStyle = '#f2e4c3'; c.font = '600 42px system-ui, sans-serif'; c.fillText(String(state.look || 'sync').toUpperCase(), 24, 98);
    c.fillStyle = '#b6d4df'; c.font = '20px system-ui, sans-serif';
    c.fillText(`SKY / FOG  ·  ${state.time || 'sync'}`, 24, 139);
    c.fillText(`SUN  ·  ${Number.isFinite(+state.el) ? `${(+state.el).toFixed(1)}°` : 'sync'}`, 24, 174);
    c.fillText(`VISUAL CHECK  ·  ${fps ? `${Math.round(fps)} FPS` : 'LIVE'}`, 24, 209);
    lightTexture.needsUpdate = true;
    return { look: state.look || 'sync', time: state.time || null, elevation: Number.isFinite(+state.el) ? +(+state.el).toFixed(1) : null, fps: Number.isFinite(fps) ? Math.round(fps) : null };
  };
  let lightState = drawLighting(), lightAt = performance.now();
  for (const [dx, dz] of [[-8, 11], [-8, 13], [8, 11], [8, 13]]) add(new THREE.BoxGeometry(0.6, 0.45, 0.6), seat, cx + dx, 0.23, fz + dz);
  add(new THREE.BoxGeometry(4, 1.05, 0.7), walnut, X0 + 2.6, 0.52, fz - 3.8, 0, true, 4, 0.7);
  add(new THREE.BoxGeometry(0.5, 0.45, 0.4), brass, X0 + 1.5, 1.27, fz - 3.8);
  add(new THREE.BoxGeometry(3.6, 0.05, 0.3), warm, X0 + 2.6, 2.4, fz - 5.7);
  // data -> canvases, at most once per second
  const draw = (m, lines, col = '#9fd8ff') => { const c = m.cv.getContext('2d'); c.fillStyle = '#0b0e13'; c.fillRect(0, 0, 384, 216); c.fillStyle = '#d9b45a'; c.font = '700 18px Inter,sans-serif'; c.fillText(m.title, 14, 26);
    c.fillStyle = col; c.font = '14px Inter,sans-serif'; lines.slice(0, 10).forEach((l, i) => c.fillText(String(l).slice(0, 46), 14, 52 + i * 17)); m.tex.needsUpdate = true; };
  let last = 0, busy = false, alive = true;
  async function refresh() {
    if (busy || !alive) return; busy = true;
    try { const r = await fetch('/api/office/b1/feed', { cache: 'no-store' }); if (!r.ok) throw new Error('feed ' + r.status); const d = await r.json();
      const c = mapCv.getContext('2d'); c.fillStyle = '#081018'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#1f3a4a';
      for (let i = 0; i <= 256; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
      for (const a of d.agents) if (a.zone === 'town') { c.fillStyle = '#7fe0ff'; c.fillRect(128 + a.x * 0.6, 128 - (a.z - 60) * 0.6, 3, 3); }
      for (const s of d.sites) { c.fillStyle = s.leased ? '#e0b050' : s.hold ? '#a05050' : '#50a070'; c.fillRect(20 + (s.lot % 10) * 22, 20 + Math.floor(s.lot / 10) * 22, 16, 16); }
      mapTex.needsUpdate = true;
      const town = d.agents.filter(a => a.zone === 'town').length;
      draw(mons[0], [`agents in town: ${town}`, `agents total: ${d.agents.length}`, `lots: ${d.sites.length}`, `viewers: ${d.viewers}`]);
      draw(mons[1], d.work.slice(0, 10).map(w => `${w.name || w.agent}: ${w.stage || ''} ${w.progress != null ? Math.round(w.progress * 100) + '%' : ''}`));
      const fps = window.__ewsOffice?.fps?.() ?? null; draw(mons[2], [`this device: ${fps ? Math.round(fps) + ' fps' : 'n/a'}`, 'target: 45+ fps on every tier', 'real-GPU runs: Alvíss (pve-mini-3070)']);
      draw(mons[3], [`world seq ${d.seq}`, 'hot updates: release broadcast on deploy', 'DEPLOY RULE: rebase + curl /api/office/world']);
      draw(mons[4], d.agents.filter(a => /^sec-/.test(a.id)).map(a => `${a.id}: ${a.act} (${Math.round(a.x)}, ${Math.round(a.z)})`));
      draw(mons[5], [`layout approved: ${d.layout.approved ? 'YES' : 'no (construction held)'}`, ...(d.layout.approved ? [`by ${d.layout.by} ${new Date(d.layout.at).toLocaleString()}`, `why: ${String(d.layout.why || '').slice(0, 60)}`, `revoke by ${new Date(d.layout.revokeBy || 0).toLocaleString()}`] : d.layout.revoked ? [`revoked ${d.layout.revoked} by ${d.layout.by}`] : []), ...d.sites.map(s => `lot ${s.lot}: stage ${s.si}${s.hold ? ' HOLD' : ''}${s.leased ? ' LEASED' : ''}`)], d.layout.approved ? '#9fe0a0' : '#ffb080');
      draw(mons[6], d.budget ? Object.entries(d.budget).slice(0, 8).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`) : ['budget feed: n/a']);
    } catch (e) { mons.forEach(m => draw(m, ['feed unavailable'], '#ff9a80')); }
    busy = false;
  }
  // people: the world team at their posts + off-duty (paused) agents at the coffee bar. Same avatar maker as the team halls.
  (async () => { try { const A = ctx.use?.('avatar'); let teams = ctx.roster?.teams; if (!teams?.length) teams = (await (await fetch('/office/data/roster.json', { cache: 'no-store' })).json()).teams || [];
    const posts = { 'world-ops': [0, 11.6, Math.PI], 'world-interiors': [-6, 7.6, Math.PI], 'world-exterior': [6, 7.6, Math.PI], 'world-life': [-6, 10.6, Math.PI], 'world-physics': [-8, 11, 0], 'world-light': [-8, 13, Math.PI / 2], 'world-qa': [8, 11, 0], 'world-character': [8, 13, 0] };
    const off = []; let k = 0;
    for (const t of teams) for (const m of t.members || []) {
      let p = posts[m.id]; if (!p && m.offDuty) { p = [-12 + 1.4 + (k++) * 1.1, -2.9, 0]; off.push(m.id); } if (!p || !A) continue;
      const av = A.make(m, t.floor === 'B1' ? 0x6a8fb0 : 0x8a7a6a, () => ctx.card(`<h3>${ctx.esc(m.name)}</h3><p>${ctx.esc(m.role)}${m.offDuty ? ' · off duty (paused)' : ''}</p>`));
      av.position.set(cx + p[0], 0, fz + p[1]); av.rotation.y = p[2]; av.userData.b1 = true; g.add(av); }
    window.__ewsB1 = { offDuty: off, avatars: !!A, bar: [X0 + 2.6, fz - 3.8], room: [X0, Z0, X1, Z1], lighting: () => ({ agent: 'world-light', station: [cx - 8, fz + 13], ...lightState }), at: () => ({ cam: ctx.cam ? [ctx.cam.position.x, ctx.cam.position.z].map(v => +v.toFixed(1)) : null, people: g.children.filter(o => o.userData?.b1).map(o => [o.userData?.a?.id || '', +o.position.x.toFixed(1), +o.position.z.toFixed(1)]) }) };   // read-only test probe
  } catch (e) { console.warn('b1 people', e); window.__ewsB1 = { err: String(e) }; } })();
  refresh();
  return { group: g, bounds: { x0: X0 + 0.5, z0: Z0 + 0.5, x1: X1 - 0.5, z1: Z1 - 0.5 }, onFrame() { const t = performance.now(); if (t - last > 1000) { last = t; refresh(); } if (t - lightAt > 1000) { lightAt = t; lightState = drawLighting(); } }, dispose() { alive = false; } };
}
