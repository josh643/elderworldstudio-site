// Desk monitors: every screen in the office is drawn into ONE shared canvas atlas and merged into ONE mesh (1 draw
// call for all monitors). Each cell shows that agent's live work from the public feed (stage, progress) as an
// real snapshot thumbnail (CT111) + redacted task title, stage, progress. Idle desks: 'Idle' + last job. No filler.
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
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
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.userData.keep = 1; mesh.userData.noCollide = 1; ctx.scene.add(mesh);
    const owner = new Map(); for (const av of ctx.use('avatar')?.all || []) if (av.userData.monitor) owner.set(screens.indexOf(av.userData.monitor), av);
    const thumbs = { img: null, map: {}, v: null }; let last = {};
    this.onState = st => { last = st.last || {}; const th = st.thumbs; if (th && th.v !== thumbs.v) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { thumbs.img = im; thumbs.map = th.map || {}; thumbs.v = th.v; }; im.src = '/api/office/thumbs?v=' + th.v; } };
    const draw = (i, t) => { const av = owner.get(i), u = av?.userData || {}, a = u.a || {}, s = u.state || {}, x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, f = cw / 256;
      g.save(); g.beginPath(); g.rect(x0, y0, cw, ch); g.clip(); g.translate(x0, y0); g.scale(f, f);
      const work = !!s.stage;
      if (!av) { g.fillStyle = '#07090d'; g.fillRect(0, 0, 256, 144); g.restore(); return; }          /* unowned screen: switched off, never filler */
      const STG = { waiting: 'Queued', plan: 'Planning', build: 'Building', 'self-check': 'Self-check', QA: 'In QA', review: 'Waiting for review', ready: 'Ready to ship', released: 'Released' };
      const cell = work && thumbs.img ? thumbs.map[a.id] : undefined;
      g.fillStyle = '#0f1420'; g.fillRect(0, 0, 256, 144);
      if (cell != null) { const n = 8, sw = thumbs.img.width / n; g.drawImage(thumbs.img, (cell % n) * sw, Math.floor(cell / n) * (sw * 108 / 192), sw, sw * 108 / 192, 0, 0, 256, 144);   /* real snapshot of the job (CT111, ~1/min) */
        g.fillStyle = 'rgba(8,11,18,.82)'; g.fillRect(0, 96, 256, 48); }
      g.fillStyle = 'rgba(20,28,44,.92)'; g.fillRect(0, 0, 256, 16); g.fillStyle = '#d9e2f2'; g.font = '600 10px Inter, system-ui, sans-serif'; g.fillText(a.name || '', 6, 12);
      if (!work) { g.fillStyle = '#9fb0cc'; g.font = '700 28px Inter, sans-serif'; g.fillText(ctx.t ? ctx.t('Idle') : 'Idle', 96, 70);
        const l = last[a.id]; if (l) { g.font = '11px Inter, sans-serif'; g.fillStyle = '#7f8ea8'; g.fillText(('Last: ' + l).slice(0, 44), 8, 110); } }
      else { const title = String(s.task || ''), y0 = cell != null ? 112 : 40, maxL = cell != null ? 1 : 3; g.fillStyle = '#ffffff'; g.font = '700 14px Inter, sans-serif';
        let ln = '', y = y0, L = 0; for (const w of title.split(/\s+/)) { if (g.measureText(ln + w).width > 240 && ln) { g.fillText(ln.trim(), 8, y); y += 18; ln = ''; if (++L >= maxL) break; } ln += w + ' '; } if (L < maxL && ln.trim()) g.fillText(ln.trim(), 8, y);
        g.font = '600 12px Inter, sans-serif'; g.fillStyle = s.blocked ? '#ff8a8a' : '#d9b45a'; g.fillText((STG[s.stage] || s.stage) + (s.blocked ? ' · blocked' : '') + ' · ' + Math.round((s.progress || 0) * 100) + '%', 8, cell != null ? 129 : 112);
        g.fillStyle = '#26324a'; g.fillRect(6, 136, 244, 4); g.fillStyle = '#d9b45a'; g.fillRect(6, 136, 244 * Math.max(0.03, Math.min(1, s.progress || 0)), 4); }
      g.restore(); };
    for (let i = 0; i < screens.length; i++) draw(i, 0); tex.needsUpdate = true;
    let acc = 0, next = 0; this.onFrame = (dt, t) => { acc += dt; if (acc < 0.5) return; acc = 0; for (let k = 0; k < 4; k++) { draw(next, t); next = (next + 1) % screens.length; } tex.needsUpdate = true; };
  },
};
