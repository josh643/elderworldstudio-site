// Desk monitors: every screen in the office is drawn into ONE shared canvas atlas and merged into ONE mesh (1 draw
// call for all monitors). Each cell shows that agent's live work from the public feed (stage, progress) as an
// app-like view: code editor, mail list, queue/terminal, review checklist. Idle desks show a desktop. Never blank.
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
const CODE = ['const res = await fetch(api);', 'if (!res.ok) throw new Error(res.status);', 'export function render(ctx) {', '  ctx.save(); ctx.scale(dpr, dpr);', 'for (const row of rows) total += row.qty;', 'return { ok: true, items };', '// TODO: cache by hash', 'await queue.push(job);', 'git commit -m "fix layout"', 'npm run build && npm test', 'SELECT id, name FROM leads;', 'style.gap = "12px";'];
const MAIL = ['Re: website draft v2', 'Invoice question', 'Demo link ready', 'Thanks for the update!', 'Meeting Thursday?', 'New lead: bakery site', 'QA notes attached', 'Logo files'];
export default {
  setup(ctx) {
    const { THREE } = ctx, screens = ctx.screens || []; if (!screens.length) return;
    const low = ctx.tier === 0, cw = low ? 160 : 256, ch = low ? 90 : 144, cols = 8, rows = Math.ceil(screens.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch; const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    ctx.scene.updateMatrixWorld(true);
    const geos = screens.map((m, i) => { const geo = m.geometry.clone(), uv = geo.attributes.uv, c = i % cols, r = Math.floor(i / cols);
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / cols, 1 - (r + 1 - uv.getY(k)) / rows);
      geo.applyMatrix4(m.matrixWorld); m.parent?.remove(m); return geo; });
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.userData.keep = 1; ctx.scene.add(mesh);
    const owner = new Map(); for (const av of ctx.use('avatar')?.all || []) if (av.userData.monitor) owner.set(screens.indexOf(av.userData.monitor), av);
    const draw = (i, t) => { const av = owner.get(i), u = av?.userData || {}, a = u.a || {}, s = u.state || {}, x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, f = cw / 256;
      g.save(); g.beginPath(); g.rect(x0, y0, cw, ch); g.clip(); g.translate(x0, y0); g.scale(f, f);
      const role = String(a.role || '').toLowerCase(), work = !!s.stage, seed = (i * 7 + Math.floor(t / 3)) | 0;
      g.fillStyle = work ? '#0f1420' : '#1b2a44'; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#26324a'; g.fillRect(0, 0, 256, 16); g.fillStyle = '#d9e2f2'; g.font = '600 10px Inter, system-ui, sans-serif'; g.fillText((a.name || 'Agent') + (work ? ' · ' + s.stage : ' · idle'), 6, 12);
      if (!work) { g.fillStyle = '#f2efe6'; g.font = '700 26px Inter, sans-serif'; const d = new Date(); g.fillText(d.toTimeString().slice(0, 5), 92, 78); g.font = '500 10px Inter, sans-serif'; g.fillStyle = '#9fb0cc'; g.fillText('Elder World Studio', 84, 96);
        for (let k = 0; k < 5; k++) { g.fillStyle = ['#d9b45a', '#3e8ed0', '#4caf7a', '#c05a5a', '#9b7ad0'][k]; g.fillRect(70 + k * 24, 118, 16, 16); } }
      else if (/mail|client|care|call|community|lead|support|sales|prospect/.test(role)) { g.font = '500 10px Inter, sans-serif';
        for (let k = 0; k < 7; k++) { const y = 22 + k * 17; g.fillStyle = k === 0 ? '#2b3c5e' : '#141b2b'; g.fillRect(4, y, 248, 15); g.fillStyle = k < 2 ? '#ffffff' : '#a9b6cc'; g.fillText(MAIL[(seed + k) % MAIL.length], 10, y + 11); } }
      else if (/qa|test|review|design/.test(role) || s.stage === 'QA' || s.stage === 'review') { g.font = '500 10px Inter, sans-serif';
        for (let k = 0; k < 6; k++) { const y = 26 + k * 18, ok = k < 2 + (seed % 4); g.fillStyle = ok ? '#4caf7a' : '#5a6478'; g.fillRect(8, y, 10, 10); g.fillStyle = '#d0d8e6'; g.fillText(['Layout on mobile', 'Links work', 'Forms submit', 'Spelling', 'Load time', 'Accessibility'][k], 26, y + 9); } }
      else { g.font = '10px ui-monospace, Menlo, monospace';
        for (let k = 0; k < 7; k++) { const ln = CODE[(seed + k) % CODE.length]; g.fillStyle = '#5a6478'; g.fillText(String(k + 1 + (seed % 40)), 4, 28 + k * 15); g.fillStyle = ['#c7d2fe', '#86efac', '#fcd34d', '#f9a8d4'][(seed + k) % 4]; g.fillText(ln, 24, 28 + k * 15); } }
      if (work && s.progress != null) { g.fillStyle = '#26324a'; g.fillRect(6, 134, 244, 5); g.fillStyle = '#d9b45a'; g.fillRect(6, 134, 244 * Math.max(0.03, Math.min(1, s.progress)), 5); }
      g.restore(); };
    for (let i = 0; i < screens.length; i++) draw(i, 0); tex.needsUpdate = true;
    let acc = 0, next = 0; this.onFrame = (dt, t) => { acc += dt; if (acc < 0.5) return; acc = 0; for (let k = 0; k < 4; k++) { draw(next, t); next = (next + 1) % screens.length; } tex.needsUpdate = true; };
  },
};
