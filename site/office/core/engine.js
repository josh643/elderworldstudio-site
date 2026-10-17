// EWS 3D office engine (core). Knows nothing about games, teams or Freyja: it loads modules.json, gives each
// module a ctx (scene + helpers + service registry), then runs controls, HUD, tours, cards and the render loop.
// Module contract (modules/<id>/index.js): export default { setup(ctx, config, anchor) -> void|{bounds},
//   onState?(snapshot), onFrame?(dt, t) }. Modules share things with ctx.provide(name, v) / ctx.use(name).
import * as THREE from '../vendor/three.module.min.js?v=169';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
import * as kit from './kit.js?v=32';
import * as DN from './daynight.js?v=2';
import * as EX from './exterior.js?v=3';   /* real 3D exterior (campus + town reserve); ?ext=0 = old baked view */
const V = 30, GOLD = 0xd9b45a;
const $ = (t, a = {}, h = '') => { const e = document.createElement(t); for (const k in a) e.setAttribute(k, a[k]); e.innerHTML = h; return e; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function start(opts = {}) {
  /* i18n: English + Spanish. UI strings translated once (static JSON, flagged for review); no per-visitor cost. */
  const LANG = window.EWS_LANG === 'es' ? 'es' : 'en'; let I18N = {}; const seenStr = new Set();
  if (LANG === 'es') { try { I18N = (await (await fetch('/office/data/i18n/es.json?v=1')).json()).strings || {}; } catch {} }
  const tr = s => { if (typeof s !== 'string') return s; const k = s.trim(); if (!k) return s; seenStr.add(k); return I18N[k] ?? s; };
  const tDom = el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const k = n.nodeValue.trim(); if (k && /[A-Za-z]/.test(k)) { seenStr.add(k); if (I18N[k]) n.nodeValue = n.nodeValue.replace(k, I18N[k]); } }
    el.querySelectorAll('[placeholder],[aria-label]').forEach(e => ['placeholder', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v) { seenStr.add(v); if (I18N[v]) e.setAttribute(a, I18N[v]); } })); };
  if (!document.querySelector('link[href*="office.css"]')) document.head.append($('link', { rel: 'stylesheet', href: '/office/office.css?v=' + V }));
  const root = $('div', { class: 'office-root', role: 'application', 'aria-label': 'Elder World Studio 3D office. Use the tour buttons, or switch to the classic site.' });
  root.append($('div', { class: 'office-load' }, 'Opening the doors of Fólkvangr…'));
  // loader watchdog: if the scene isn't up in 20 s, say so and retry once, then fall back to the classic site
  const loadDog = setTimeout(() => { const l = root.querySelector('.office-load'); if (!l) return; const n = +(sessionStorage.getItem('ews-retry') || 0);
    if (n < 1) { sessionStorage.setItem('ews-retry', n + 1); l.textContent = 'Still loading… retrying.'; setTimeout(() => location.reload(), 1500); }
    else { sessionStorage.removeItem('ews-retry'); l.innerHTML = 'The 3D office didn\u2019t load. <a href="/?classic=1" style="color:#d9b45a">Open the classic site</a> or <a href="" style="color:#d9b45a">try again</a>.'; } }, 20000);
  document.body.append(root); document.documentElement.classList.add('office-on');
  const get = n => fetch(`/office/${n}?v=${V}`).then(r => r.json());
  const [site, roster, registry] = await Promise.all([get('data/site.json'), get('data/roster.json'), get('modules.json')]);

  // renderer + auto quality tiers
  // GPU class: integrated/mobile GPUs get a lower pixel-ratio cap and no MSAA
  const gpuName = (() => { try { const g = document.createElement('canvas').getContext('webgl'); const x = g.getExtension('WEBGL_debug_renderer_info'); const n = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; g.getExtension('WEBGL_lose_context')?.loseContext(); return String(n); } catch { return ''; } })();
  const igpu = /intel|uhd|iris|mali|adreno|powervr|apple gpu|llvmpipe|swiftshader|videocore/i.test(gpuName);
  const R = new THREE.WebGLRenderer({ antialias: !igpu && devicePixelRatio < 1.5, powerPreference: 'high-performance', stencil: true });   /* stencil: real window openings (kit.windowPane) */
  const lowEnd = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4, RATIOS = [0.75, 1, 1.5];   // tier base ratios; DSCALE steps below these at runtime
  let tier = lowEnd ? 0 : devicePixelRatio > 1.5 ? 1 : 2; if (tier === 2 && matchMedia('(pointer: fine)').matches) RATIOS[2] = igpu ? 1.25 : 2;   // desktop: native res up to 2x, 1.25 on integrated GPUs
  if (igpu) { RATIOS[1] = Math.min(RATIOS[1], 1.0); if (tier > 1) tier = 1; }   /* integrated GPUs start on the mid tier: no 2K maps, no MSAA */
  if (matchMedia('(pointer: fine)').matches) { RATIOS[0] = RATIOS[1] = 1; }   // desktops/kiosks never drop below native resolution; LOD and effects go first
  const DESK = !matchMedia('(pointer: coarse)').matches; const DSCALE = DESK ? [1] : [1, 0.85, 0.72]; /* desktop never renders below native size; it sheds LOD instead */ let dstep = 0; const FINE = DESK; const applyRatio = () => R.setPixelRatio(FINE ? (igpu ? 0.85 : 1) : Math.min(devicePixelRatio, RATIOS[tier]) * DSCALE[dstep]);   // desktop/kiosk: exactly 1.0 (native CSS pixels)
  applyRatio(); R.outputColorSpace = THREE.SRGBColorSpace;
  root.prepend(R.domElement);
  if (igpu && !matchMedia('(pointer: coarse)').matches && !/[?&]sharp=0/.test(location.search)) {   /* 0.85 render scale is upscaled by the compositor; a light unsharp kernel restores edge crispness */
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('width', 0); sv.setAttribute('height', 0); sv.style.position = 'absolute';
    sv.innerHTML = '<filter id="ews-sharp"><feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0"/></filter>'; document.body.append(sv); R.domElement.style.filter = 'url(#ews-sharp)'; }
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0716); scene.fog = new THREE.Fog(0x0b0716, 25, 70);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 120); const rig = new THREE.Group(); rig.add(cam); scene.add(rig);   // rig = player body (XR moves the camera inside it)
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x1a1030, 1.3); scene.add(hemi); const sun = new THREE.DirectionalLight(0xffe2b0, 1.1); sun.position.set(8, 20, 6); scene.add(sun);
  const mcache = new Map(); const M = c => { if (!mcache.has(c)) mcache.set(c, M.standard ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }) : new THREE.MeshLambertMaterial({ color: c })); return mcache.get(c); };
  const mat = { floor: M(0x2a2236), wall: M(0x3a2f4a), trim: M(GOLD), dark: M(0x15101f), wood: M(0x6b4a2e), stone: M(0x4b4458), rack: M(0x1d1d24), glow: new THREE.MeshBasicMaterial({ color: GOLD }) };
  const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  const loader = new THREE.TextureLoader(); const image = src => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.capabilities.getMaxAnisotropy(); return t; };
  function wrap(g, s, max) { const out = []; let cur = ''; for (const wd of s.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > max && cur) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  function textCanvas(lines, { w = 1024, h = 256, bg = '#140c22', fg = '#f3ead7', size = 64, body = 0, border = true } = {}) {
    lines = lines.map(tr); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const draw = () => { g.clearRect(0, 0, w, h);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } if (border) { g.strokeStyle = '#d9b45a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); }
    let y = 28; g.textBaseline = 'top';
    lines.forEach((ln, i) => { const s = i === 0 ? size : (body || Math.round(size * 0.5)); g.font = `${i ? '500' : '700'} ${s}px ${i ? 'Inter, system-ui, sans-serif' : 'Cinzel, Georgia, serif'}`; g.fillStyle = i ? fg : '#d9b45a';
      for (const part of wrap(g, String(ln), w - 64)) { if (y + s > h - 16) return; g.fillText(part, 32, y); y += s * 1.18; } }); };
    draw();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.text = lines.join(' ').trim(); t.userData.minFrac = (lines.length > 1 && String(lines[1]).trim() ? (body || Math.round(size * 0.5)) : size) / h;
    document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; }); return t;
  }
  const panel = (texture, w, h, x, y, z, ry = 0, parent = scene) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p); displays.push(p); return p; };
  const displays = [];
  function label(text, sub, col = '#f3ead7') {
    text = tr(text); sub = tr(sub);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#0d0818cc'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill(); g.textAlign = 'center';
    g.fillStyle = col; g.font = '700 26px Inter, system-ui, sans-serif'; g.fillText(text, 128, 30);
    if (sub) { g.fillStyle = '#c9bfae'; g.font = '500 17px Inter, system-ui, sans-serif'; g.fillText(String(sub).slice(0, 26), 128, 52); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(1.6, 0.4, 1); return s;
  }
  const clickables = [], spots = {}, tours = [], services = {}, bounds = { minX: -8, maxX: 8, minZ: -4, maxZ: 10 }, after = {};
  const touch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches, xr = /OculusBrowser|Quest|Pico/i.test(navigator.userAgent);
  const verb = xr ? 'Trigger' : touch ? 'Tap' : 'Click or press E';   // device-aware prompt for in-world signs
  /* PUBLIC-CONTENT-RULES: public mode on the production host (or ?public=1 for QA): roles-only nameplates, generic screens, no telemetry, no task text */
  let KIOSK = false; try { KIOSK = !!localStorage.getItem('ews-kiosk'); } catch {}
const PUBLIC = /(^|\.)elderworldstudio\.com$/.test(location.hostname) || /[?&]public=1/.test(location.search);
  const ctx = { igpu, publicMode: PUBLIC,
    verb, touch, lod: 1,
    THREE, kit, scene, cam, rig, renderer: R, mat, get tier() { return tier; }, M, box, panel, image, textCanvas, label, site, roster, esc, root,
    onClick: (obj, handler) => { obj.userData.onPick = handler; clickables.push(obj); return obj; },
    spot: (name, pos, look, tourLabel) => { spots[name] = { pos, look }; if (tourLabel) tours.push([name, tourLabel]); },
    extend: (x1, z1, x2, z2) => { bounds.minX = Math.min(bounds.minX, x1); bounds.minZ = Math.min(bounds.minZ, z1); bounds.maxX = Math.max(bounds.maxX, x2); bounds.maxZ = Math.max(bounds.maxZ, z2); },
    provide: (k, v) => { services[k] = v; }, use: k => services[k],
    goTo: n => goTo(n), card: html => cardOf(html), closeCard: () => closeCard(),
    btn: b => `<a class="ob ${b.primary !== false ? 'gold' : ''}" href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.label)}</a>`,
    t: tr, lang: LANG, hudButton: (text, fn) => { const b = $('button', { class: 'ob', type: 'button' }, esc(tr(text))); b.onclick = fn; srNav.append(b); return b; },   // a11y only; visible UI is in-world
    sign: (text, sub, x, y, z, ry, fn, w = 2.6) => { const p = panel(textCanvas([text, sub || ''], { w: 768, h: 200, size: 64 }), w, w * 0.26, x, y, z, ry); if (fn) ctx.onClick(p, fn); return p; },
    get tours() { return tours; }, spotOf: k => spots[k],
    player: { get pos() { return pos; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, teleport: (x, z) => { pos.x = x; pos.z = z; glide = null; } },
    activity: () => { lastInput = performance.now(); },
    setTitle: t => { hud.querySelector('.t').textContent = t; }, announce: t => { live.textContent = t; },
  };
  // HUD (built before modules so they can add buttons)
  const hud = $('div', { class: 'office-hud' }, `<span class="t">Elder World Studio · Fólkvangr</span>`); root.append(hud);
  const srNav = $('nav', { class: 'office-srnav', 'aria-label': 'Office navigation' }); const bClassic = $('button', { class: 'ob', type: 'button' }, tr('Switch to Classic')); srNav.append(bClassic);
  const bLang = $('button', { class: 'ob', type: 'button', lang: LANG === 'es' ? 'en' : 'es' }, LANG === 'es' ? 'English' : 'Español'); srNav.append(bLang);
  bLang.onclick = () => { try { localStorage.setItem('ews-lang', LANG === 'es' ? 'en' : 'es'); } catch {} dispatchEvent(new Event('pagehide')); location.reload(); };   /* state (position, chat) is saved on pagehide */ root.append(srNav);
  ctx.classic = () => { try { if (localStorage.getItem('ews-kiosk')) return; } catch (e) {}   /* the kiosk always stays on 3D */ try { if (localStorage.getItem('ews-view') === '3d') localStorage.setItem('ews-view', 'classic'); } catch (e) {} if (opts.overlay) { close(); if (!document.querySelector('.ews-switch')) { const a = document.createElement('a'); a.href = '/?view=3d'; a.className = 'ews-switch'; a.textContent = tr('Switch to 3D'); document.body.append(a); } } else location.href = '/?view=classic'; };
  bClassic.onclick = () => ctx.classic();
  const live = $('div', { class: 'office-sr', 'aria-live': 'polite' }); root.append(live);

  // load + set up modules in registry order
  const mods = [], byId = {};
  for (const m of registry.modules) {
    await new Promise(r => setTimeout(r, 0));   // yield between modules: no long main-thread tasks
    try {
      let anchor = m.anchor || [0, 0];
      if (typeof anchor[1] === 'string' && anchor[1].startsWith('after:')) anchor = [anchor[0], (after[anchor[1].slice(6)] ?? bounds.minZ) - 4];
      const mod = (await import(`../${m.src}?v=${V}`)).default; const r = (await mod.setup(ctx, m.config || {}, anchor)) || {};
      if (r.minZ != null) after[m.id] = r.minZ; mods.push(mod); byId[m.id] = { mod, m, anchor };
    } catch (e) { console.warn('office module failed:', m.id, e); }   // one broken module never takes the office down
  }
  // player collision: 2D boxes (XZ) auto-built from mesh bounds of anything solid between ankle and head height,
  // plus circles for the avatars. Capsule radius 0.3 m; push out along the shallow axis so you slide along walls.
  const PR = 0.3, cols = []; const tmpB = new THREE.Box3();
  let baseCols = null; function buildColliders() { cols.length = 0; if (baseCols) cols.push(...baseCols); scene.updateMatrixWorld(true);
    scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.userData.batched || m.userData.colDone || displays.includes(m) || m.material?.transparent || m.userData.noCollide) return; if (baseCols) m.userData.colDone = 1;
      let p = m.parent; while (p) { if (p.userData?.a) return; p = p.parent; }   // avatar hit-cylinders etc.
      tmpB.setFromObject(m); if (tmpB.max.y < 0.15 || tmpB.min.y > 1.8) return;
      const w = tmpB.max.x - tmpB.min.x, d = tmpB.max.z - tmpB.min.z; if (w < 0.02 && d < 0.02) return; if (w > 60 && d > 60) return;
      cols.push([tmpB.min.x, tmpB.min.z, tmpB.max.x, tmpB.max.z]); });
    /* instanced furniture (chairs, plants, stools...) used to be skipped entirely: give each instance its own cheap box */
    scene.traverse(m => { if (!m.isInstancedMesh || m.userData.noCollide || m.userData.colDone || m.material?.transparent) return; if (baseCols) m.userData.colDone = 1;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const mm = new THREE.Matrix4();
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mm); tmpB.copy(m.geometry.boundingBox).applyMatrix4(mm.premultiply(m.matrixWorld)); if (tmpB.max.y < 0.15 || tmpB.min.y > 1.8) continue;
        const w = tmpB.max.x - tmpB.min.x, d = tmpB.max.z - tmpB.min.z; if ((w < 0.02 && d < 0.02) || (w > 20 && d > 20)) continue; cols.push([tmpB.min.x, tmpB.min.z, tmpB.max.x, tmpB.max.z]); } });
    if (baseCols) baseCols = cols.slice();   /* keep lazily-added colliders (they're marked colDone, so they'd vanish on the next pass) */
    if (ctx.extraCols) for (const c of ctx.extraCols) cols.push(c);   /* explicit rects from merged floors (core/floors.js) */
    ctx.colliders = cols; }
  ctx.rebuildColliders = () => buildColliders();
  function collide(p) { for (let it = 0; it < 2; it++) {
      for (const [x0, z0, x1, z1] of cols) { if (p.x < x0 - PR || p.x > x1 + PR || p.z < z0 - PR || p.z > z1 + PR) continue;
        const l = p.x - (x0 - PR), r = (x1 + PR) - p.x, b = p.z - (z0 - PR), f = (z1 + PR) - p.z, m = Math.min(l, r, b, f);
        if (m === l) p.x = x0 - PR; else if (m === r) p.x = x1 + PR; else if (m === b) p.z = z0 - PR; else p.z = z1 + PR; }
      for (const av of ctx.use('avatar')?.all || []) { if (!av.visible) continue; const dx = p.x - av.position.x, dz = p.z - av.position.z, d2 = dx * dx + dz * dz, R2 = 0.55;
        if (d2 < R2 * R2 && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = av.position.x + dx / d * R2; p.z = av.position.z + dz / d * R2; } } } }
  ctx.collide = collide;
  // shell: floor + outer walls sized to whatever the modules built
  const { minX, maxX, minZ, maxZ } = bounds; const fx = minX - 2, fX = maxX + 2, fz = minZ - 2, fZ = maxZ;
  box(fX - fx, 0.2, fZ - fz, mat.floor, (fx + fX) / 2, -0.1, (fz + fZ) / 2);
  const wall = (x1, z1, x2, z2) => { const l = Math.hypot(x2 - x1, z2 - z1); const w = box(l, 4, 0.3, mat.wall, (x1 + x2) / 2, 2, (z1 + z2) / 2); w.rotation.y = -Math.atan2(z2 - z1, x2 - x1); };
  const EN = ctx.entrance; if (EN) { wall(fx, fZ, EN.x - EN.w / 2, fZ); wall(EN.x + EN.w / 2, fZ, fX, fZ); } else wall(fx, fZ, fX, fZ);
  wall(fx, fz, fX, fz);
  /* entrance glass front (floor_g): floor-to-ceiling glass over the shell opening, brass mullions every ~1.85 m, a baked lake view
     behind it (day/night drives that view + the glass tint), and real two-panel sliding doors centred on the red carpet. */
  const EXT = !!EN && !/[?&]ext=0/.test(location.search); ctx.extOn = EXT;
  if (EN) { const gz = fZ, gm = new THREE.MeshBasicMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    if (!EXT) { const vv = new THREE.Mesh(new THREE.PlaneGeometry(EN.w + 2, 4.2), new THREE.MeshBasicMaterial({ map: kit.viewTex(ctx), toneMapped: false })); vv.position.set(EN.x, 2.0, gz + 0.9); vv.rotation.y = Math.PI; vv.userData.noCollide = 1; scene.add(vv); }
    const pane = (cx, w, y, h) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); g.position.set(cx, y, gz); g.userData.dn = 'glass'; g.userData.noCollide = 1; scene.add(g); };
    const DW = 2.9, side = (EN.w - DW) / 2, n = 3;
    for (const sg of [-1, 1]) for (let i = 0; i < n; i++) { const w = side / n, cx = EN.x + sg * (DW / 2 + w * (i + 0.5)); pane(cx, w, 2.0, 4.0); box(0.06, 4.0, 0.1, mat.trim, EN.x + sg * (DW / 2 + w * (i + 1)), 2.0, gz); }
    box(EN.w, 0.08, 0.12, mat.trim, EN.x, 0.04, gz); box(EN.w, 0.1, 0.14, mat.trim, EN.x, 3.95, gz);   // sill + head rail
    pane(EN.x, DW, 3.35, 1.3); box(DW + 0.1, 0.12, 0.14, mat.trim, EN.x, 2.7, gz);                      // transom over the doors + door header/track
    for (const sx of [-1, 1]) box(0.08, 2.7, 0.12, mat.trim, EN.x + sx * DW / 2, 1.35, gz);              // door jambs
    ctx.entranceDoors = [];
    for (const sx of [-1, 1]) { const dx = EN.x + sx * DW / 4, dz = gz - 0.05 - (sx > 0 ? 0.04 : 0);       // two sliding leaves on offset tracks
      const lg = new THREE.Group(); lg.userData.keep = 1; scene.add(lg); ctx.entranceDoors.push({ g: lg, sx, w: DW / 2 });   /* exterior.js slides them open when someone walks up */
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(DW / 2 - 0.02, 2.6), gm); lf.position.set(dx, 1.32, dz); lf.userData.dn = 'glass'; lf.userData.noCollide = 1; lg.add(lf);
      const parts = []; for (const ex of [-1, 1]) parts.push(box(0.05, 2.62, 0.05, mat.trim, dx + ex * (DW / 4 - 0.03), 1.32, dz, lg)); parts.push(box(DW / 2, 0.05, 0.05, mat.trim, dx, 0.03, dz, lg), box(DW / 2, 0.05, 0.05, mat.trim, dx, 2.62, dz, lg));
      parts.push(box(0.03, 0.9, 0.05, mat.trim, EN.x + sx * 0.12, 1.1, dz - 0.04, lg)); if (EXT) for (const o of parts) o.userData.noCollide = 1; }   // pull bars at the meeting edge
    const ep = ctx.panel(ctx.textCanvas(['Entrance', 'Elder World Studio'], { w: 640, h: 160, size: 60 }), 1.6, 0.4, EN.x, 3.3, gz - 0.12, Math.PI); ep.userData.plate = 'Entrance';
    if (!EXT) { const c = box(EN.w, 4, 0.05, new THREE.MeshBasicMaterial({ visible: false }), EN.x, 2, gz + 0.05); c.userData.keep = 1; }   /* the glass still blocks walking out */
    else for (const sg of [-1, 1]) { const a = DW / 2 - 0.02, b = EN.w / 2, c = box(b - a, 4, 0.05, new THREE.MeshBasicMaterial({ visible: false }), EN.x + sg * (a + b) / 2, 2, gz + 0.05); c.userData.keep = 1; }   /* exterior on: side glass blocks, the doorway is open (doors slide) */
  } wall(fx, fz, fx, fZ); wall(fX, fz, fX, fZ);
  if (EXT) { try { ctx.exterior = EX.build(ctx, { fx, fX, fz, fZ, EN }); } catch (e) { console.warn('exterior failed', e); } }
  /* hallway dressing along the outer walls: wainscot band, big framed prints at eye height with sconces, pillars between bays,
     benches, plants and runner rugs. Same material = one batched draw call. Prints are game key art (no logo stretch). */
  { const imgs = (ctx.site?.games || []).filter(g => g.img).map(g => g.img), artM = new Map(), wood = mat.wood, warm = new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), fab = mat.fabric || mat.dark; let ai = 0;
    const artMat = u => { if (!artM.has(u)) { const t = ctx.image(u); t.colorSpace = THREE.SRGBColorSpace; artM.set(u, new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); } return artM.get(u); };
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 }), clay = new THREE.MeshStandardMaterial({ color: 0xa0593a, roughness: 0.9 });
    const put = (geo, m, x, y, z, ry) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const G = { frame: new THREE.BoxGeometry(2.1, 1.5, 0.06), art: new THREE.PlaneGeometry(1.95, 1.35), sconce: new THREE.BoxGeometry(0.12, 0.22, 0.1), pillar: new THREE.BoxGeometry(0.45, 4, 0.45), seat: new THREE.BoxGeometry(1.4, 0.08, 0.42), leg: new THREE.BoxGeometry(0.08, 0.4, 0.38), pot: new THREE.CylinderGeometry(0.22, 0.17, 0.42, 12), bush: new THREE.IcosahedronGeometry(0.38, 1), rug: new THREE.BoxGeometry(2.6, 0.02, 1.1) };
    const run = (x1, z1, x2, z2, nx, nz) => { const l = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(nx, nz), ux = (x2 - x1) / l, uz = (z2 - z1) / l;
      if (EN && nz === -1) { for (const [a, b] of [[x1, EN.x - EN.w / 2], [EN.x + EN.w / 2, x2]]) { const wc = box(b - a, 1.0, 0.04, wood, (a + b) / 2, 0.5, z1 - 0.17); wc.userData.noCollide = 1; } }
      else { const wc = box(l, 1.0, 0.04, wood, (x1 + x2) / 2 + nx * 0.17, 0.5, (z1 + z2) / 2 + nz * 0.17); wc.rotation.y = ry; wc.userData.noCollide = 1; }
      const n = Math.floor((l - 2) / 4.6); if (n < 1) return;
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t, at = (d, s = 0) => [cx + nx * d + ux * s, cz + nz * d + uz * s];
        if (EN && nz === -1 && Math.abs(cx - EN.x) < EN.w / 2 + 2.6) continue;   /* keep the glass entrance wall clear */
        let x, z;   /* no repeated poster run: sconces, pillars, benches, plants and rugs only */
        [x, z] = at(0.22); put(G.sconce, warm, x, 2.35, z, ry).userData.noCollide = 1;
        [x, z] = at(0.4, 2.3); put(G.pillar, mat.wall, x, 2, z, ry);
        if (i % 2 === 0) { [x, z] = at(0.55); put(G.seat, wood, x, 0.44, z, ry); for (const s of [-0.6, 0.6]) { [x, z] = at(0.55, s); put(G.leg, mat.rack, x, 0.2, z, ry); } [x, z] = at(1.6); put(G.rug, ctx.rug ? ctx.rug(0x8a5a44) : fab, x, 0.03, z, ry).userData.noCollide = 1; }
        else { [x, z] = at(0.5, -1.4); kit.plant(ctx, x, z, 1); [x, z] = at(0.12); kit.windowPane(ctx, x, 1.95, z, ry, 2.2, 1.5); } } };   /* exterior walls: windows onto the lake (baked view) */
    run(fx, fZ, fX, fZ, 0, -1); run(fx, fz, fX, fz, 0, 1); run(fx, fz, fx, fZ, 1, 0); run(fX, fz, fX, fZ, -1, 0); }
  // ceiling + recessed light panels (one instanced draw call), so there is no black void overhead
  /* ceiling (material-only v1, baked, unlit so it never reads black): off-white plaster with warm wood slats every
     0.5 m, a brass trim line and a soft baked cove glow per 4 m bay. One texture, one draw call. */
  /* ceiling v2 (campus vision board): warm wood slats over a warm taupe plaster, brass trim, and glowing ring coves
     (one InstancedMesh, unlit, baked glow halo texture under each ring). Unlit so it never reads black; 3 draw calls total. */
  { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#b9a58c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) { const x = i * 32 + 6, wg = g.createLinearGradient(x, 0, x + 20, 0); wg.addColorStop(0, '#7a5434'); wg.addColorStop(0.5, '#986a42'); wg.addColorStop(1, '#6d4a2d'); g.fillStyle = wg; g.fillRect(x, 0, 20, 512);
      g.globalAlpha = 0.16; g.fillStyle = '#3e2614'; for (let k = 0; k < 10; k++) g.fillRect(x + 2 + (k * 5) % 16, (k * 97 + i * 31) % 512, 1, 50 + (k * 31) % 90); g.globalAlpha = 1; }
    g.fillStyle = '#c9a24e'; g.fillRect(0, 0, 512, 5); g.fillRect(0, 507, 512, 5);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set((fX - fx) / 4, (fZ - fz) / 4); tx.anisotropy = 4;
    const ceil = box(fX - fx, 0.1, fZ - fz, new THREE.MeshBasicMaterial({ map: tx }), (fx + fX) / 2, 4.05, (fz + fZ) / 2); ceil.userData.noCollide = 1; ceil.name = 'ceiling';
    const hc = document.createElement('canvas'); hc.width = hc.height = 128; { const h = hc.getContext('2d'), r = h.createRadialGradient(64, 64, 20, 64, 64, 64); r.addColorStop(0, 'rgba(255,214,150,0)'); r.addColorStop(0.62, 'rgba(255,214,150,.55)'); r.addColorStop(0.72, 'rgba(255,214,150,.18)'); r.addColorStop(1, 'rgba(255,214,150,0)'); h.fillStyle = r; h.fillRect(0, 0, 128, 128); }
    const halo = new THREE.CanvasTexture(hc); halo.colorSpace = THREE.SRGBColorSpace;
    const pts = []; for (let x = fx + 6; x < fX - 3; x += 12) for (let z = fz + 6; z < fZ - 3; z += 12) pts.push([x, z]);
    const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1.6, 0.05, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), pts.length);
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.6, 4.6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), pts.length);
    const m4 = new THREE.Matrix4(); pts.forEach(([x, z], i) => { ring.setMatrixAt(i, m4.makeTranslation(x, 3.86, z)); glow.setMatrixAt(i, m4.makeTranslation(x, 3.99, z)); });
    ring.userData.dn = 'ring'; glow.userData.dn = 'halo'; for (const o of [ring, glow]) { o.userData.noCollide = 1; o.userData.keep = 1; o.frustumCulled = false; scene.add(o); } }
  { const cols = Math.floor((fX - fx) / 4), rows = Math.floor((fZ - fz) / 4), lp = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 0.5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false }), cols * rows), m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { m4.makeTranslation(fx + 2 + i * 4, 3.99, fz + 2 + j * 4); lp.setMatrixAt(k++, m4); } scene.add(lp); }

  // controls: drag look, WASD/arrows, joystick, tap to pick, glide tours
  for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(ev, e => { if (glide && !e.target.closest?.('button,.office-card,a')) glide = null; }, true);   /* any input cancels a guided move instantly */
  let lastInput = performance.now(); addEventListener('pointerdown', () => lastInput = performance.now(), true); addEventListener('keydown', () => lastInput = performance.now(), true);
  ctx.idleMs = () => performance.now() - lastInput;
  let yaw = Math.PI, pitch = 0; const pos = new THREE.Vector3(0, 1.65, 7.5); let glide = null;
  const lookAt = (p, l) => { const d = new THREE.Vector3(l[0] - p[0], l[1] - p[1], l[2] - p[2]); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
  const EYE = 1.65; function goTo(name) { const s = spots[name]; if (!s) return; const sp = [s.pos[0], EYE, s.pos[2]], t = lookAt(sp, s.look); t.pitch = Math.max(-0.5, Math.min(0.4, t.pitch)); glide = { from: pos.clone(), to: new THREE.Vector3(...sp), y0: yaw, y1: yaw + (((t.yaw - yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, p0: pitch, p1: t.pitch, t: 0 }; }
  if (spots.lobby) { pos.set(spots.lobby.pos[0], EYE, spots.lobby.pos[2]); ({ yaw, pitch } = lookAt([pos.x, EYE, pos.z], spots.lobby.look)); }
  const keys = {}; addEventListener('blur', () => { for (const k in keys) keys[k] = 0; }); addEventListener('focusin', e => { if (e.target.matches?.('input,textarea,select') || e.target.isContentEditable) { for (const k in keys) keys[k] = 0; if (document.pointerLockElement) document.exitPointerLock(); } }); addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,select,[contenteditable]') || e.target.isContentEditable) return; keys[e.key.toLowerCase()] = 1; if (e.key === 'Escape') closeCard(); }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; });
  let drag = null, moved = 0; const el = R.domElement;
  const PMAX = 85 * Math.PI / 180;   // free 360° yaw (the player body turns), pitch clamped to ±85°
  document.addEventListener('pointerlockchange', () => { if (locked()) drag = null; });
  let edgeX = 0; el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, dz = lockBroken ? 0.55 : 0.92;   // steer mode: the outer band of the screen turns you, faster toward the edge
    edgeX = Math.abs(nx) > dz ? Math.sign(nx) * Math.min(1, (Math.abs(nx) - dz) / (1 - dz) + 0.25) : 0; });
  el.addEventListener('mouseleave', e => { const r = el.getBoundingClientRect(); edgeX = e.clientX <= r.left + 2 ? -1 : e.clientX >= r.right - 2 ? 1 : 0; });
  addEventListener('blur', () => { edgeX = 0; });
  let wantLock = false; const lock = () => { if (lockBroken) return; wantLock = true; try { const r = el.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} };
  document.addEventListener('fullscreenchange', () => { if (wantLock && !locked()) setTimeout(lock, 150); });   // kiosk fullscreen can drop the lock: take it back
  document.addEventListener('pointerlockchange', () => { if (!locked() && !document.fullscreenElement) wantLock = false; lookHint.style.display = locked() || !fine ? 'none' : 'block'; });
  const lookHint = $('div', { class: 'office-lookhint', 'aria-hidden': 'true' }, 'Click to look around · or push the mouse to a screen edge'); lookHint.style.cssText = 'position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font:13px Inter,system-ui,sans-serif;color:#f3ead7;background:#0d0818b0;padding:4px 10px;border-radius:10px;pointer-events:none'; root.append(lookHint);
  addEventListener('keydown', e => { if (fine && !locked() && !lockBroken && /^[wasd]$|^arrow/i.test(e.key) && !e.target.closest?.('input,textarea,select') && !card) lock(); });   // first WASD press also grabs the mouse (keydown is a user gesture)
  // layout QA: from every viewing spot, raycast to each sign/display it can see; report anything solid in between
  function checkOcclusion() { const rc = new THREE.Raycaster(), out = [], c = new THREE.Vector3(), o = new THREE.Vector3(); scene.updateMatrixWorld(true);
    const solids = []; scene.traverse(m => { if (m.isMesh && !m.isSkinnedMesh && m.visible && !displays.includes(m) && m.material?.visible !== false && !m.material?.transparent) { m.geometry.computeBoundingBox?.(); const bb = new THREE.Box3().setFromObject(m); if (bb.max.y - bb.min.y > 0.3) solids.push(m); } });
    for (const [name, s] of Object.entries(spots)) { o.set(s.pos[0], 1.65, s.pos[2]);
      for (const p of displays) { if (!p.visible) continue; p.getWorldPosition(c); const dist = o.distanceTo(c); if (dist > 11) continue;
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(p.getWorldQuaternion(new THREE.Quaternion())); const fac = n.dot(o.clone().sub(c).normalize()); if (Math.abs(fac) < 0.6 || (fac < 0 && p.material.side !== THREE.DoubleSide)) continue;   // only signs that face this spot (within ~53°)
        const dir = c.clone().sub(o).normalize(); rc.set(o, dir); rc.far = dist - 0.06; const hit = rc.intersectObjects(solids, false)[0];
        if (hit) out.push({ spot: name, display: (p.userData.label || '').slice(0, 40) || `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`, blocker: hit.object.name || hit.object.geometry.type, at: hit.point.toArray().map(v => +v.toFixed(2)) }); } }
    return out; }
  // scene sanity (used by the pre-deploy gate): props must rest on a surface; no rig may be in bind/T-pose
  function sanity() { const out = [], rc = new THREE.Raycaster(); rc.camera = cam; const bb = new THREE.Box3(), c = new THREE.Vector3(); scene.updateMatrixWorld(true);
    scene.traverse(o => { if (!o.userData.prop) return; bb.setFromObject(o); bb.getCenter(c); rc.set(new THREE.Vector3(c.x, bb.min.y + 0.02, c.z), new THREE.Vector3(0, -1, 0)); rc.far = 3;
      const ms = []; scene.traverse(m => { if (m.isMesh && !m.isSkinnedMesh) ms.push(m); }); const hits = rc.intersectObjects(ms, false).filter(h => { let p = h.object; while (p) { if (p === o) return false; p = p.parent; } return h.object.visible; });
      const gap = hits.length ? (bb.min.y + 0.02) - hits[0].point.y : bb.min.y; if (Math.abs(gap) > 0.05) out.push({ type: 'floating-prop', name: o.userData.prop, gap: +gap.toFixed(2), at: c.toArray().map(v => +v.toFixed(1)) }); });
    for (const av of ctx.use('avatar')?.all || []) { const B = av.userData.bones; if (!B?.upperarm_l || !B?.lowerarm_l) continue; const a = B.upperarm_l.getWorldPosition(new THREE.Vector3()), b = B.lowerarm_l.getWorldPosition(new THREE.Vector3());
      const dy = Math.abs(b.y - a.y) / a.distanceTo(b); if (av.visible && dy < 0.35) out.push({ type: 'bind-pose', name: av.userData.a?.name, clip: av.userData.cur }); }
    for (const av of ctx.use('avatar')?.all || []) { const u = av.userData, st = u.state || {}; if (u.team && !u.monitor) out.push({ type: 'agent-without-station', name: u.a?.name }); if (!u.team || !u.home || !['plan', 'build', 'self-check'].includes(st.stage)) continue;
      const d = Math.hypot(av.position.x - u.home.x, av.position.z - u.home.z), f = new THREE.Vector3(Math.sin(av.rotation.y), 0, Math.cos(av.rotation.y)), m = u.monitor ? u.monitor.getWorldPosition(new THREE.Vector3()).sub(av.position).setY(0).normalize() : f;
      if (d > 0.45 || f.dot(m) < 0.8 || !(u.ph && u.ph.m !== 'stand')) out.push({ type: 'working-not-seated', name: u.a?.name, d: +d.toFixed(2), dot: +f.dot(m).toFixed(2), clip: u.cur }); }
    scene.traverse(o => { if (!o.isMesh || !o.visible || o.userData.batched) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return; const e = o.material?.emissive, wp = o.getWorldPosition(new THREE.Vector3());
      if (wp.y > 2.3 && (o.material?.isMeshBasicMaterial ? o.material.color.r > 0.8 && o.material.color.g < 0.3 && !o.material.map : e && e.r > 0.5 && e.g < 0.3)) out.push({ type: 'debug-marker', at: wp.toArray().map(x => +x.toFixed(1)) }); });
    { const ps = []; scene.traverse(o => { if (!o.isMesh || !o.visible || !o.material?.map?.userData?.text || !o.geometry?.parameters?.height) return; const b = new THREE.Box3().setFromObject(o), n = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); ps.push({ o, b, n });
        const hM = o.geometry.parameters.height * o.getWorldScale(new THREE.Vector3()).y, ch = hM * o.material.map.userData.minFrac; if (o.userData.plate && ch < 0.045) out.push({ type: 'illegible-text', name: o.material.map.userData.text.slice(0, 40), charHeightM: +ch.toFixed(3) }); });
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const A = ps[i], B = ps[j]; if (A.o.parent === B.o.parent && A.o.parent !== scene) continue; if (Math.abs(A.n.dot(B.n)) < 0.95) continue;
        const I = A.b.clone().intersect(B.b); if (I.isEmpty()) continue; const sz = I.getSize(new THREE.Vector3()), area = Math.max(sz.x, sz.z) * sz.y; if (area > 0.02) out.push({ type: 'text-overlap', a: A.o.material.map.userData.text.slice(0, 30), b: B.o.material.map.userData.text.slice(0, 30) }); } }
    scene.traverse(o => { if (!o.userData.art || !o.visible) return; const sz = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); if (Math.max(sz.x, sz.z) < 1.4 || sz.y < 1.0) out.push({ type: 'art-too-small', w: +Math.max(sz.x, sz.z).toFixed(2), h: +sz.y.toFixed(2) }); });
    scene.traverse(o => { if (!o.isMesh || !o.visible || o.userData.batched || o.isSkinnedMesh) return; const M = o.material; if (!M || Array.isArray(M) || M.map || M.vertexColors || !M.color) return; const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
      const lum = 0.3 * M.color.r + 0.59 * M.color.g + 0.11 * M.color.b; if (sz.y < 0.08 && b.max.y < 0.12 && sz.x * sz.z > 2 && lum < 0.08) out.push({ type: 'flat-dark-floor-quad', at: b.getCenter(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)), area: +(sz.x * sz.z).toFixed(1) }); });
    { const seen = new Set(); scene.traverse(o => { const c = o.userData.cabinet; if (!c) return; if (seen.has(c)) out.push({ type: 'duplicate-cabinet', name: c }); seen.add(c); }); }
    scene.traverse(o => { if (!o.userData.plate) return; const im = o.material.map?.image; let ok = false; try { const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data; let gold = 0; for (let i = 0; i < d.length; i += 64) if (d[i] > 150 && d[i + 2] < 140) gold++; ok = gold > 40; } catch {} if (!ok || !o.material.map.userData.text) out.push({ type: 'blank-plate', name: o.userData.plate }); });
    return out; }
  window.__ewsOffice = { get yaw() { return yaw; }, get pitch() { return pitch; }, checkOcclusion, sanity };
  const fine = matchMedia('(pointer: fine)').matches; lookHint.style.display = fine ? 'block' : 'none'; const locked = () => document.pointerLockElement === el;
  const center = { clientX: 0, clientY: 0 }; const centerPick = () => { const r = el.getBoundingClientRect(); center.clientX = r.left + r.width / 2; center.clientY = r.top + r.height / 2; return pickAt(center); };
  const xhair = $('div', { class: 'office-xhair', 'aria-hidden': 'true' }); root.append(xhair);
  document.addEventListener('pointerlockchange', () => { xhair.style.display = locked() ? 'block' : 'none'; });
  let skipMove = 0, zeroRun = 0, lockBroken = (() => { try { localStorage.removeItem('ews-nolock'); return sessionStorage.getItem('ews-nolock') === '1'; } catch { return false; } })();   /* session only: a stale flag used to disable mouse-look forever (Joshua's 'stuck mouse') */ document.addEventListener('pointerlockchange', () => { skipMove = 2; });
  document.addEventListener('mousemove', e => { if (!locked()) return; if (skipMove) { skipMove--; return; }
    if (e.movementX === 0 && e.movementY === 0) { if (++zeroRun > 40) { lockBroken = true; try { sessionStorage.setItem('ews-nolock', '1'); } catch {} document.exitPointerLock(); } return; } zeroRun = 0;   // compositor without relative-pointer support (e.g. cage): fall back to steer mode   // first events after (re)lock carry bogus jumps
    const mx = Math.max(-80, Math.min(80, e.movementX)), my = Math.max(-80, Math.min(80, e.movementY)); if (Math.abs(e.movementY) > 200 || Math.abs(e.movementX) > 400) return;
    yaw -= mx * 0.0022; pitch = Math.max(-PMAX, Math.min(PMAX, pitch - my * 0.0022)); yaw = (yaw + Math.PI * 4) % (Math.PI * 2); glide = null; });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'e' && !e.target.closest?.('input,textarea,select')) { const h = locked() ? centerPick() : null; if (h) { document.exitPointerLock?.(); h(); } } });
  if (fine) { const hint = $('div', { class: 'office-hint' }, 'WASD to move · Q/R or ←/→ to turn (or push the mouse to a screen edge) · click to look around · Shift to run · E or click to use · Esc to release'); root.append(hint); setTimeout(() => hint.classList.add('gone'), 6000); }
  el.addEventListener('pointerdown', e => {
    if (locked()) { const h = centerPick(); if (h) { document.exitPointerLock(); h(); } return; }            // desktop game mode: click = interact
    if (fine && e.pointerType === 'mouse') { const h = pickAt(e); if (h) { h(); return; } lock(); }   // if lock is refused (kiosk/iframe), drag-look below still works
    drag = { x: e.clientX, y: e.clientY }; moved = 0; try { el.setPointerCapture(e.pointerId); } catch {} });
  el.addEventListener('pointermove', e => { if (!drag) { el.style.cursor = pickAt(e) ? 'pointer' : 'grab'; return; } if (locked()) { drag = null; return; } const dx = Math.max(-120, Math.min(120, e.clientX - drag.x)), dy = Math.max(-120, Math.min(120, e.clientY - drag.y)); moved += Math.abs(dx) + Math.abs(dy); yaw -= dx * 0.005; pitch = Math.max(-PMAX, Math.min(PMAX, pitch - dy * 0.004)); drag = { x: e.clientX, y: e.clientY }; glide = null; });
  el.addEventListener('pointerup', e => { if (drag && moved < 8) { const h = pickAt(e); if (h) h(); else walkTo(e); } drag = null; });
  const jv = { x: 0, y: 0 };   // no on-screen joystick: tap the floor to walk, drag to look, WASD/arrows on keyboards
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fhit = new THREE.Vector3();
  function walkTo(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(floorPlane, fhit)) return; const d = Math.min(fhit.distanceTo(pos), 14), dir = fhit.clone().sub(pos).setY(0).normalize();
    const to = pos.clone().addScaledVector(dir, Math.max(0, d - 0.8)); { const B = ctx.curBounds || ctx.exterior?.bounds || [fx, fX, fz, fZ]; to.x = Math.max(B[0] + 1, Math.min(B[1] - 1, to.x)); to.z = Math.max(B[2] + 1, Math.min(B[3] - 1, to.z)); } to.y = pos.y;
    glide = { from: pos.clone(), to, y0: yaw, y1: yaw, p0: pitch, p1: pitch, t: 0, walk: true }; ripple(fhit); }
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 })); rip.rotation.x = -Math.PI / 2; scene.add(rip);
  function ripple(p) { rip.position.set(p.x, 0.02, p.z); rip.material.opacity = 0.9; rip.scale.setScalar(1); }
  function pickAt(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(clickables, false)[0]; return h && h.distance < 30 ? h.object.userData.onPick : null; }
  tours.forEach(([k, t]) => { const b = $('button', { class: 'ob', type: 'button' }, 'Go to ' + esc(t)); b.onclick = () => goTo(k); srNav.append(b); });
  let card = null; function closeCard() { card?.remove(); card = null; }
  function cardOf(html) { if (document.pointerLockElement) document.exitPointerLock(); closeCard(); card = $('section', { class: 'office-card', role: 'dialog', 'aria-modal': 'false' }, `<button class="x" type="button" aria-label="Close">×</button>${html}`); if (KIOSK) card.querySelectorAll('a[href]').forEach(a => { const u = new URL(a.href, location.href); if (u.hash && u.pathname === location.pathname) return; const s = document.createElement('span'); s.className = a.className + ' kiosk-url'; s.textContent = (a.textContent || '').trim() + ' · ' + u.host.replace(/^office-3d\./, '') + u.pathname; a.replaceWith(s); });   /* kiosk: links never navigate away from the office */ card.querySelector('.x').onclick = closeCard; root.append(card); tDom(card); const h = card.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus(); } return card; }
  function close() { running = false; R.setAnimationLoop(null); root.remove(); document.documentElement.classList.remove('office-on'); R.dispose(); }
  document.querySelector('.skip')?.addEventListener('click', () => { if (opts.overlay) close(); });
  ctx.state = s => mods.forEach(m => { try { m.onState?.(s); } catch (e) { console.warn(e); } });

  // loop with FPS watchdog
  const clock = new THREE.Clock(); const T0 = performance.now(); let cullT = 0, running = true, fa = 0, fn = 0, slow = false, lowFor = 0, fps1 = 0, fpsN = 0; const fpsEl = new URLSearchParams(location.search).has('fps') ? (() => { const d = document.createElement('div'); d.className = 'office-fps'; d.style.cssText = 'position:absolute;right:8px;top:8px;z-index:9;font:12px monospace;color:#0f0;background:#000a;padding:3px 6px;pointer-events:none'; root.append(d); return d; })() : null; const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function resize() { const w = root.clientWidth, h = root.clientHeight; R.setSize(w, h, false); cam.aspect = w / h; const a = w / h; cam.fov = a >= 1 ? 62 : Math.min(78, Math.max(62, 2 * Math.atan(Math.tan(Math.PI / 8) / a) * 180 / Math.PI)); cam.updateProjectionMatrix(); }   // portrait phones get a wider view
  addEventListener('resize', resize); resize();
  function frame() {
    if (!running) return; if (document.hidden && !R.xr.isPresenting) return;
    const rdt = clock.getDelta(), dt = Math.min(rdt, 0.05), t = clock.elapsedTime;
    fa += rdt; fn++; fps1 += rdt; fpsN++; if (fpsEl && fps1 > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fps1)} fps · tier ${tier} · ${R.getPixelRatio().toFixed(2)}x · ${R.info.render.calls} calls${igpu ? ' · iGPU' : ''}`; fps1 = fpsN = 0; }
    if (fa > 2 && performance.now() - T0 < 6000) { fa = fn = 0; }   // ignore the load spike
    if (fa > 2) { const fps = fn / fa; fa = fn = 0;   // step quality down first; only offer classic after sustained <20 fps for 10 s at the lowest level
      if (fps < 40 && ctx.lod > 0.5) { ctx.lod = Math.max(0.5, ctx.lod - 0.15); lowFor = 0; }
      else if (fps < 40 && (dstep < DSCALE.length - 1 || tier > 0)) { if (dstep < DSCALE.length - 1) dstep++; else { tier--; dstep = 0; ctx.tierChanged?.(tier); } applyRatio(); resize(); lowFor = 0; }
      else lowFor = 0; }   /* no 'running slowly' popup: quality steps down silently */
    if (glide) { glide.t = Math.min(1, glide.t + dt / 1.6); const k = glide.t * glide.t * (3 - 2 * glide.t); pos.lerpVectors(glide.from, glide.to, k); yaw = glide.y0 + (glide.y1 - glide.y0) * k; pitch = glide.p0 + (glide.p1 - glide.p0) * k; if (glide.t >= 1) glide = null; }
    const typing = (() => { const a = document.activeElement; return !!(a && (a.matches?.('input,textarea,select') || a.isContentEditable)) || !!document.querySelector('.office-chat:not([hidden]),.office-card form, .office-card[data-chat]'); })(); if (typing) for (const k in keys) keys[k] = 0;
    const mvF = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - jv.y, mvR = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + jv.x;
    if (keys.arrowleft || keys.q) yaw += dt * 1.8; if (keys.arrowright || keys.r) yaw -= dt * 1.8;   // keyboard turning never needs the cursor
    if (edgeX && !locked() && !drag && !card) yaw -= edgeX * dt * 2.2;          // cursor parked at a screen edge = keep turning
    if (mvF || mvR) { glide = null; fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(-fwd.z, 0, fwd.x); const sp = keys.shift ? 8 : 4; pos.addScaledVector(fwd, mvF * dt * sp).addScaledVector(right, mvR * dt * sp); { const B = ctx.curBounds || ctx.exterior?.bounds || [fx, fX, fz, fZ]; pos.x = Math.max(B[0] + 1, Math.min(B[1] - 1, pos.x)); pos.z = Math.max(B[2] + 1, Math.min(B[3] - 1, pos.z)); } }
    cullT += rdt; if (cullT > 0.4) { cullT = 0; const wp = new THREE.Vector3();   // distance-cull signs/displays (each is its own draw call)
      for (const p of farCull) { const u = p.userData.fc; const far = u.c.distanceTo(pos) - u.r > 20; if (far && p.visible) { p.visible = false; p.userData.far = 1; } else if (!far && p.userData.far) { p.visible = true; p.userData.far = 0; } }
      for (const p of displays) { p.getWorldPosition(wp); const far = wp.distanceToSquared(pos) > 18 * 18; if (far && p.visible) { p.visible = false; p.userData.far = 1; } else if (!far && p.userData.far) { p.visible = true; p.userData.far = 0; } } }
    if (!glide || glide.walk) { const ox = pos.x, oz = pos.z; collide(pos); if (glide?.walk && Math.hypot(pos.x - ox, pos.z - oz) > 0.01) glide = null; }   // tours glide freely; walking (keys or tap-to-walk) is blocked by furniture
    if (!window.__ewsFreeY) pos.y = EYE;   // always grounded at eye height: tours and teleports never lift the walking camera
    if (R.xr.isPresenting) { rig.position.set(pos.x, 0, pos.z); rig.rotation.set(0, yaw, 0); cam.position.set(0, 0, 0); }
    else { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); cam.position.copy(pos); cam.rotation.set(pitch, yaw, 0, 'YXZ'); }
    if (rip.material.opacity > 0) { rip.material.opacity = Math.max(0, rip.material.opacity - dt * 1.5); rip.scale.multiplyScalar(1 + dt * 1.2); }
    for (const m of mods) m.onFrame?.(dt, t);
    ctx.exterior?.frame(dt, t, pos, cam);
    R.render(scene, cam);
  }
  clearTimeout(loadDog); sessionStorage.removeItem('ews-retry');
  root.querySelector('.office-load').style.opacity = 0; setTimeout(() => root.querySelector('.office-load')?.remove(), 700);
  // static batching: every plain, non-interactive mesh is baked into one mesh per material (hundreds of desk/chair/
  // wall parts -> a few dozen draw calls). Clickables, signs, avatars and anything marked userData.keep stay live.
  function batchStatic() { scene.updateMatrixWorld(true); const groups = new Map(), victims = [], clickSet = new Set(clickables);
    scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || !m.visible || displays.includes(m) || clickSet.has(m) || m.userData.batched) return; if (m.material?.transparent && !m.userData.batch) return;
      for (let p = m; p; p = p.parent) { if (p.userData?.keep || p.userData?.a || p.isSprite) return; if (p !== m && !p.visible) return; }
      const g = m.geometry; if (!g.attributes.uv || !g.attributes.normal || g.morphAttributes?.position || Array.isArray(m.material)) return;
      const M = m.material, plain = !M.map && !M.emissiveMap && !M.normalMap && !M.transparent && M.isMeshStandardMaterial && !M.vertexColors; const k = plain ? 'vc' + M.type + '|' + M.roughness.toFixed(1) + '|' + M.metalness.toFixed(1) + '|' + M.side + '|' + (M.emissive?.getHex() || 0) : M.uuid; if (!groups.has(k)) groups.set(k, { mat: M, plain, list: [] }); groups.get(k).list.push(m); victims.push(m); });
    let before = victims.length, after = 0;
    for (const { mat: mat0, plain, list } of groups.values()) { let mat = mat0; if (plain) { mat = mat0.clone(); mat.color.set(0xffffff); mat.vertexColors = true; } if (list.length < 2) { before -= list.length; continue; }
      const geos = list.map(m => { let g = m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (g.index) g = g.toNonIndexed(); if (plain) { const n = g.attributes.position.count, a = new Float32Array(n * 3), col = m.material.color; for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); } return g.applyMatrix4(m.matrixWorld); }); const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
      if (!merged) { before -= list.length; continue; } const mm = new THREE.Mesh(merged, mat); mm.userData.batched = true; mm.matrixAutoUpdate = false; scene.add(mm); after++;
      list.forEach(m => m.parent?.remove(m)); }
    ctx.batched = { before, after }; }
  const farCull = []; function collectFar() { farCull.length = 0; const clickSet = new Set(clickables); for (const o of scene.children) { if (o.userData.batched || o.userData.noFarCull || o.isLight || o.userData.a || o.isSkinnedMesh || o.isInstancedMesh || o === rip) continue; let skin = false; o.traverse(c => { if (c.isSkinnedMesh || c.userData.a) skin = true; }); if (o.userData.far) { o.visible = true; o.userData.far = 0; }   /* un-hide anything a previous cull pass hid, or it drops out of the list and stays hidden forever (blank whiteboards) */
      if (!skin && !displays.includes(o) && o.visible) { const bx = new THREE.Box3().setFromObject(o); if (bx.isEmpty()) continue; const sp = bx.getBoundingSphere(new THREE.Sphere()); if (sp.radius > 12) continue; o.userData.fc = { c: sp.center, r: sp.radius }; farCull.push(o); } } }
  /* integrated GPUs: swap PBR for Lambert (keeps colour/map/emissive, drops normal/roughness/metal maps) */
  const lam = new Map(); function lowMats() { if (!igpu) return; scene.traverse(o => { if (!o.isMesh) return; const conv = M => { if (!M?.isMeshStandardMaterial) return M; let L = lam.get(M.uuid);
      if (!L) { L = new THREE.MeshLambertMaterial({ color: M.color, map: M.map, emissive: M.emissive, emissiveMap: M.emissiveMap, emissiveIntensity: M.emissiveIntensity, transparent: M.transparent, opacity: M.opacity, side: M.side, vertexColors: M.vertexColors, alphaTest: M.alphaTest, depthWrite: M.depthWrite }); L.name = M.name; lam.set(M.uuid, L); } return L; };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); }); }
  ctx.dn = DN.start(ctx, { hemi, sun, scene, THREE }); window.__ewsOffice.dayNight = () => ({ ...ctx.dayNight, apply: undefined });
  buildColliders(); baseCols = cols.slice(); batchStatic(); collectFar(); lowMats();
  setTimeout(() => { buildColliders(); const b0 = ctx.batched; batchStatic(); ctx.batched = { before: b0.before + ctx.batched.before, after: b0.after + ctx.batched.after }; collectFar(); lowMats(); }, 10500);   /* second pass: lazy GLB props */
  { let n = 0; const iv = setInterval(() => { buildColliders(); if (n % 4 === 3) lowMats(); if (++n >= 24) clearInterval(iv); }, 500); }  /* lazy desks/props get colliders within 0.5 s of landing */   // again once the lazy props have landed
  window.__ewsOffice.exterior = () => ctx.exterior?.info?.() || null; window.__ewsOffice.cam = (x, y, z, lx, ly, lz) => { window.__ewsFreeY = 1; pos.set(x, y, z); glide = null; const d = [lx - x, ly - y, lz - z]; yaw = Math.atan2(-d[0], -d[2]); pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); };   /* QA: free camera for exterior comparison shots */ window.__ewsOffice.pos = () => pos.toArray().map(v => +v.toFixed(3)); window.__ewsOffice.breakdown = () => { const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const m = {}; scene.traverseVisible(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return; if (o.frustumCulled && !o.isSkinnedMesh && o.geometry && !fr.intersectsObject(o)) return; let r = o; while (r.parent && r.parent !== scene) r = r.parent; const k = (o.isSkinnedMesh ? "skin:" : o.isSprite ? "sprite:" : o.isInstancedMesh ? "inst:" : "") + (r.userData.mod || r.name || r.type); m[k] = (m[k] || 0) + (Array.isArray(o.material) ? o.material.length : 1); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40); }; window.__ewsOffice.motionAudit = (secs = 4) => new Promise(res => {   /* dev check (Joshua 2026-10-16): anything that moves and is not on the allow-list */
      const ALLOW = /^(chairs|office chairs|world:|exterior-sky|ripple|ticket|daynight)/, snap = new Map(), path = o => { const p = []; for (let r = o; r && r !== scene; r = r.parent) p.push(r.userData.mod || r.userData.label || r.name || r.type); return p.reverse().join('>'); };
      const skip = o => { for (let r = o; r; r = r.parent) { if (r.userData?.a || r.userData?.anim || r.isCamera || r === rig || ctx.entranceDoors?.some?.(d => d.g === r)) return true; } return false; };
      const take = () => { const m = new Map(); scene.traverse(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine || o.isGroup)) return; if (skip(o)) return; o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements.slice(); if (o.isInstancedMesh) { const a = o.instanceMatrix.array; let h = 0; for (let i = 0; i < a.length; i += 7) h += a[i] * (i % 13 + 1); e.push(h, o.count); } m.set(o, e); }); return m; };
      const A0 = take(); setTimeout(() => { const A1 = take(), out = {}; for (const [o, e0] of A0) { const e1 = A1.get(o); if (!e1) continue; let d = 0; for (let i = 0; i < e0.length; i++) d = Math.max(d, Math.abs(e0[i] - e1[i])); if (d < 1e-4) continue;
          const pth = path(o) + (o.isSprite ? " (label sprite)" : "") + (o.isInstancedMesh && o.userData.keep && o.frustumCulled === false ? ' (world-live crew figures, untagged)' : ''), root = pth.split('>')[0], bill = o.isSprite || o.userData.billboard || /label|tag/i.test(o.userData.kind || '') || (o.material?.type === 'MeshBasicMaterial' && o.material.map && o.geometry?.type === 'PlaneGeometry' && o.material.depthTest === true && o.renderOrder >= 0 && /tag|label/i.test(pth));
          const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), k = (ALLOW.test(root) || o.userData.allowMove ? 'allowed ' : bill ? 'billboard ' : 'NOT-ALLOWED ') + pth + (o.userData.label ? ' [' + o.userData.label + ']' : '') + (/^(Mesh|Group)$/.test(root) ? ' {' + (o.geometry?.type || o.type) + ' ' + (o.material?.type || '') + (o.material?.map ? '+map' : '') + ' @' + wp.toArray().map(v => v.toFixed(1)).join(',') + '}' : ''); out[k] = Math.max(out[k] || 0, +d.toFixed(3)); }
        res(Object.entries(out).sort((a, b) => (a[0] < b[0] ? -1 : 1))); }, secs * 1000); });
    window.__ewsOffice.draws = (n = 60) => { const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const m = {}; scene.traverseVisible(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return; if (o.frustumCulled && !o.isSkinnedMesh && o.geometry && !fr.intersectsObject(o)) return; let r = o, path = []; while (r.parent && r.parent !== scene) { path.push(r.userData.mod || r.name || ''); r = r.parent; } const M = Array.isArray(o.material) ? o.material[0] : o.material; const k = [o.isSkinnedMesh ? 'skin' : o.isInstancedMesh ? 'inst' : o.isSprite ? 'sprite' : o.userData.batched ? 'batched' : 'mesh', r.userData.mod || r.name || r.type, M?.type, M?.transparent ? 'T' : '', M?.map ? 'map' : '', o.userData.label || o.name || ''].join('|'); m[k] = (m[k] || 0) + (Array.isArray(o.material) ? o.material.length : 1); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n); };   /* perf: visible draw calls by kind|root|material|transparent|map|label */
    window.__ewsOffice.hands = () => { const desks = ctx.desks || [], out = [];   /* fingertip-to-keyboard contact for typing agents (PR #6 gate: 5 cm) */
    for (const g of ctx.use('avatar')?.all || []) { if (g.userData.cur !== 'type' || !g.visible) continue; const tips = []; g.traverse(o => { if (o.isBone && /middle_?0?4/i.test(o.name)) tips.push(o); }); if (!tips.length) continue;
      const p = g.position; let best = null, bd = 1e9; for (const [x, z] of desks) { const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = [x, z]; } } if (!best || bd > 1.5) continue;
      const kb = new THREE.Box3(new THREE.Vector3(best[0] + 0.095 - 0.23, 0.76, best[1] - 0.48 - 0.08), new THREE.Vector3(best[0] + 0.095 + 0.23, 0.79, best[1] - 0.48 + 0.08));
      out.push({ name: g.userData.a?.name, d: tips.map(b => +kb.distanceToPoint(b.getWorldPosition(new THREE.Vector3())).toFixed(3)), tips: tips.map(b => b.name) }); } return out; };
  window.__ewsOffice.colliders = () => cols.length; window.__ewsOffice.plantDbg = () => { const out = []; scene.traverse(o => { if (o.name?.startsWith('plant:')) { const w = o.getWorldPosition(new THREE.Vector3()); let n = 0, vis = 0; o.traverse(m => { if (m.isMesh) { n++; if (m.visible) vis++; } }); let p = o, pv = true; while (p) { if (!p.visible) pv = false; p = p.parent; } out.push([o.name, JSON.stringify(o.userData), w.toArray().map(v => +v.toFixed(2)), 'meshes', n, 'vis', vis, 'chainVisible', pv, 'parent', o.parent?.name || o.parent?.type, o.parent === scene]); } }); return out; }; window.__ewsOffice.colRects = () => cols.map(c => c.map(v => +v.toFixed(2))); window.__ewsOffice.plants = () => ({ placed: ctx.plantSpecies || [], dupes: (ctx.plantSpecies || []).filter((u, i, a) => a.findIndex(v => v.species === u.species) !== i) }); window.__ewsOffice.near = (x0, x1, z0, z1) => { const out = [], b = new THREE.Box3(); scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.userData.batched) return; b.setFromObject(m); const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; if (cx > x0 && cx < x1 && cz > z0 && cz < z1) { let p = m, path = []; while (p && p !== scene) { path.push(p.name || p.userData.plate || p.userData.prop || p.type); p = p.parent; } out.push([path.join('<'), m.geometry.type, +cx.toFixed(2), +cz.toFixed(2), +(b.max.x - b.min.x).toFixed(2), +(b.max.y - b.min.y).toFixed(2), +(b.max.z - b.min.z).toFixed(2), +b.min.y.toFixed(2)]); } }); return out; }; window.__ewsOffice.spots = () => spots; window.__ewsOffice.lobbyAt = () => ctx.lobbyAt; window.__ewsOffice.kiosks = () => ctx.kiosks || [];
  window.__ewsOffice.colAudit = () => { const out = [], b = new THREE.Box3(); const hit = (x, z) => cols.some(([a, c, d, e]) => x > a - 0.01 && x < d + 0.01 && z > c - 0.01 && z < e + 0.01);
    scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || m.userData.noCollide) return; let p = m; while (p) { if (p.userData?.a) return; p = p.parent; }
      const one = (bb, nm) => { if (bb.max.y < 0.3 || bb.min.y > 1.2) return; const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z; if (w < 0.15 || d < 0.15 || w > 8 || d > 8) return; const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2; if (!hit(cx, cz)) out.push([nm, +cx.toFixed(1), +cz.toFixed(1), +w.toFixed(2), +d.toFixed(2)]); };
      if (m.isInstancedMesh) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const mm = new THREE.Matrix4(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mm); one(b.copy(m.geometry.boundingBox).applyMatrix4(mm.premultiply(m.matrixWorld)), (m.name || m.geometry.type) + '#i'); } }
      else if (!m.userData.batched) one(b.setFromObject(m), m.name || m.userData.plate || m.userData.label || m.geometry.type + (m.material?.transparent ? ':T' : '')); });
    return out; }; window.__ewsOffice.i18nSeen = () => [...seenStr]; tDom(srNav); window.__ewsOffice.orphans = () => { const out = []; scene.traverse(o => { if (!o.isSkinnedMesh) return; let p = o, ok = false; while (p) { if (p.userData?.a) ok = true; p = p.parent; } if (!ok) { let r = o; while (r.parent && r.parent !== scene) r = r.parent; out.push('ROOT ' + JSON.stringify(r.userData).slice(0, 120) + ' pos ' + r.position.toArray().join(',')); const chain = []; let q = o; while (q) { chain.push((q.type || '') + ':' + (q.name || '')); q = q.parent; } out.push(chain.join(' < ')); } }); return out; }; window.__ewsOffice.avatars = () => [...(ctx.use('avatar')?.all || [])].map(g => ({ id: g.userData.a?.id, name: g.userData.a?.name, look: g.userData.look, p: g.position.toArray().map(v => +v.toFixed(2)), ry: +g.rotation.y.toFixed(2), clip: g.userData.cur, hip: (() => { const h = g.userData.bones?.pelvis || g.userData.bones?.hips || g.userData.bones?.Hips; return h ? h.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) : null; })(), vis: g.visible, inScene: !!g.parent })); window.__ewsOffice.look = (x, z, lx, lz) => { pos.set(x, EYE, z); glide = null; ({ yaw, pitch } = lookAt([x, EYE, z], [lx, 1.2, lz])); }; ctx.teleport = window.__ewsOffice.look; window.__ewsOffice.top = (x, z, h = 3.9) => { window.__ewsFreeY = 1; pos.set(x, h, z); glide = null; pitch = -1.5; yaw = 0; }; ctx.pos = () => pos; window.__ewsOffice.info = () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, batched: ctx.batched, ratio: R.getPixelRatio(), buf: R.getDrawingBufferSize(new THREE.Vector2()).toArray(), tier, lod: ctx.lod }); window.__ewsOffice.desks = () => ctx.desks || [];
  /* seat audit (2026-10-16): exclusive chairs, no seated pose without a chair, sitters face the desk with hips on the seat and feet down */
  window.__ewsOffice.seatAudit = () => { const CH = kit.chairs(ctx), SC = new Set(['read', 'idle', 'type', 'blocked', 'phone', 'sitIn', 'sitOut', 'stretch', 'coffee', 'think', 'chat', 'write', 'mouse']), occ = new Map(), r = { ...CH.audit(), seatedWithoutChair: [], duplicateSeats: [], facing: [], hips: [], feet: [], screenClip: [], offDesk: [], seated: 0, walking: 0, states: {} }, w = new THREE.Vector3();
    for (const av of ctx.use('avatar')?.all || []) { const u = av.userData, n = u.a?.name; r.states[u.cur] = (r.states[u.cur] || 0) + 1; if (u.cur === 'walk' || u.cur === 'carry') r.walking++;
      if (!SC.has(u.cur)) continue; u.mixer?.update(0); av.updateMatrixWorld(true); const st = u.seat; if (!st || st.holder !== av || !u.ph || u.ph.m === 'stand') { r.seatedWithoutChair.push({ n, clip: u.cur }); continue; }
      r.seated++; occ.set(st, [...(occ.get(st) || []), n]); if (u.home && st.kind !== 'qa' && st.root !== u.home) r.offDesk.push({ n, seat: st.label }); if (u.ph.m !== 'seated') continue;
      const yaw = st.rot + (u.chatYaw || 0), dot = Math.sin(av.rotation.y) * Math.sin(yaw) + Math.cos(av.rotation.y) * Math.cos(yaw); if (dot < 0.98) r.facing.push({ n, dot: +dot.toFixed(3) });
      const pel = u.bones?.pelvis; if (pel) { pel.getWorldPosition(w); const cx = st.root.x - Math.sin(st.rot) * st.c.off, cz = st.root.z - Math.cos(st.rot) * st.c.off, hd = Math.hypot(w.x - cx, w.z - cz), up = w.y - 0.51; if (hd > 0.12 || up < -0.01 || up > 0.12) r.hips.push({ n, horiz: +hd.toFixed(3), aboveSeat: +up.toFixed(3) }); }
      if (u.monitor && u.bones?.head) { u.bones.head.getWorldPosition(w); const mp = u.monitor.userData.wp || (u.monitor.userData.wp = u.monitor.getWorldPosition(new THREE.Vector3())); const gap = Math.hypot(w.x - mp.x, w.z - mp.z); if (gap < 0.3) r.screenClip.push({ n, gap: +gap.toFixed(3) }); }
      for (const b of ['ball_l', 'ball_r']) if (u.bones?.[b]) { u.bones[b].getWorldPosition(w); if (w.y > (u.cur === 'blocked' || u.cur === 'think' ? 0.1 : 0.08)) r.feet.push({ n, b, y: +w.y.toFixed(3) }); } }
    for (const [st, ns] of occ) if (ns.length > 1) r.duplicateSeats.push({ seat: st.label || st.i, agents: ns });
    r.seatList = CH.seats.map(s => ({ i: s.i, label: s.label, kind: s.kind, owner: s.owner, holder: s.holder?.userData.a?.name || null, off: +s.c.off.toFixed(3) })); return r; }; window.__ewsOffice.walk = (x, z, ang, secs) => { pos.set(x, EYE, z); glide = null; yaw = ang; keys.w = 1; return new Promise(r => setTimeout(() => { keys.w = 0; r([pos.x, pos.z]); }, secs * 1000)); };
  /* seamless updates + kiosk health: the kiosk watcher asks the page; the page reloads only when nobody is using it */
  let lastFrameT = performance.now(), wantUpdate = false; for (const ev of ['mousemove', 'wheel', 'touchstart', 'input']) addEventListener(ev, () => lastInput = performance.now(), { passive: true, capture: true });
  const busy = () => { const a = document.activeElement; return !!(document.querySelector('.office-card') || (a && (a.matches?.('input,textarea,select') || a.isContentEditable)) || glide); };
  const saveState = () => { try { sessionStorage.setItem('ews-state', JSON.stringify({ p: pos.toArray(), yaw, pitch, t: Date.now() })); } catch {} };
  try { const st = JSON.parse(sessionStorage.getItem('ews-state') || 'null'); if (st && Date.now() - st.t < 10 * 60e3) { pos.fromArray(st.p); pos.y = EYE; yaw = st.yaw; pitch = st.pitch; } sessionStorage.removeItem('ews-state'); } catch {}
  addEventListener('pagehide', saveState);
  /* Hot module swap (Joshua 2026-10-16 11:27 PM: updates must be seamless). A changed module that implements dispose() is imported in the
     background, set up next to the old one (its setup may resolve only once it is fully built), then swapped into the frame loop in one
     tick and the old one disposed. Player position, camera and world state are untouched. Any failure keeps the old version. A module
     without dispose(), or a core change, falls back to the soft reload below. */
  ctx.hotSwap = async (id, hash) => { const ent = byId[id]; if (!ent) return 'unknown';
    if (typeof ent.mod.dispose !== 'function') { wantUpdate = true; return 'reload'; }
    let nm; try { nm = (await import(`../${ent.m.src}?v=${V}&h=${hash}`)).default; await nm.setup(ctx, ent.m.config || {}, ent.anchor); }
    catch (e) { console.warn('hot swap failed, keeping the old', id, e); try { nm?.dispose?.(); } catch {} return 'kept-old'; }
    const i = mods.indexOf(ent.mod); if (i < 0) { try { nm.dispose?.(); } catch {} return 'gone'; }
    mods[i] = nm; const old = ent.mod; ent.mod = nm; try { old.dispose(); } catch (e) { console.warn('old module dispose', id, e); }
    (window.__ewsOffice.hotLog ||= []).push({ id, hash, at: Date.now() }); return 'swapped'; };
  /* Core/engine changes: soft reload only when nobody is using the page (60 s without input and no card/typing/tour), or the moment the
     visitor leaves the tab. Position + view are restored from sessionStorage, so it comes back exactly where it was. */
  setInterval(() => { if (wantUpdate && ctx.idleMs() > 60e3 && !busy()) { saveState(); location.reload(); } }, 5000);
  document.addEventListener('visibilitychange', () => { if (wantUpdate && document.hidden) { saveState(); location.reload(); } });
  Object.assign(window.__ewsOffice, { health: () => ({ stallMs: Math.round(performance.now() - lastFrameT), idleMs: Math.round(ctx.idleMs()), busy: busy() }), applyUpdateWhenIdle: () => { wantUpdate = true; return 'deferred'; } });
  const frame0 = frame; R.setAnimationLoop(t => { lastFrameT = performance.now(); frame0(t); }); return { goTo, close, ctx };   // setAnimationLoop also drives WebXR frames
}
