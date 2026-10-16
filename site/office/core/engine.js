// EWS 3D office engine (core). Knows nothing about games, teams or Freyja: it loads modules.json, gives each
// module a ctx (scene + helpers + service registry), then runs controls, HUD, tours, cards and the render loop.
// Module contract (modules/<id>/index.js): export default { setup(ctx, config, anchor) -> void|{bounds},
//   onState?(snapshot), onFrame?(dt, t) }. Modules share things with ctx.provide(name, v) / ctx.use(name).
import * as THREE from '../vendor/three.module.min.js?v=169';
import * as kit from './kit.js?v=4';
const V = 4, GOLD = 0xd9b45a;
const $ = (t, a = {}, h = '') => { const e = document.createElement(t); for (const k in a) e.setAttribute(k, a[k]); e.innerHTML = h; return e; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function start(opts = {}) {
  if (!document.querySelector('link[href*="office.css"]')) document.head.append($('link', { rel: 'stylesheet', href: '/office/office.css?v=' + V }));
  const root = $('div', { class: 'office-root', role: 'application', 'aria-label': 'Elder World Studio 3D office. Use the tour buttons, or switch to the classic site.' });
  root.append($('div', { class: 'office-load' }, 'Opening the doors of Fólkvangr…'));
  document.body.append(root); document.documentElement.classList.add('office-on');
  const get = n => fetch(`/office/${n}?v=${V}`).then(r => r.json());
  const [site, roster, registry] = await Promise.all([get('data/site.json'), get('data/roster.json'), get('modules.json')]);

  // renderer + auto quality tiers
  const R = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
  const lowEnd = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4, RATIOS = [0.75, 1, 1.5];
  let tier = lowEnd ? 0 : devicePixelRatio > 1.5 ? 1 : 2; R.setPixelRatio(Math.min(devicePixelRatio, RATIOS[tier])); R.outputColorSpace = THREE.SRGBColorSpace;
  root.prepend(R.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0716); scene.fog = new THREE.Fog(0x0b0716, 25, 70);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 120); const rig = new THREE.Group(); rig.add(cam); scene.add(rig);   // rig = player body (XR moves the camera inside it)
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1a1030, 1.3)); const sun = new THREE.DirectionalLight(0xffe2b0, 1.1); sun.position.set(8, 20, 6); scene.add(sun);
  const mcache = new Map(); const M = c => { if (!mcache.has(c)) mcache.set(c, M.standard ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }) : new THREE.MeshLambertMaterial({ color: c })); return mcache.get(c); };
  const mat = { floor: M(0x2a2236), wall: M(0x3a2f4a), trim: M(GOLD), dark: M(0x15101f), wood: M(0x6b4a2e), stone: M(0x4b4458), rack: M(0x1d1d24), glow: new THREE.MeshBasicMaterial({ color: GOLD }) };
  const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  const loader = new THREE.TextureLoader(); const image = src => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; return t; };
  function wrap(g, s, max) { const out = []; let cur = ''; for (const wd of s.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > max && cur) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  function textCanvas(lines, { w = 1024, h = 256, bg = '#140c22', fg = '#f3ead7', size = 64, border = true } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } if (border) { g.strokeStyle = '#d9b45a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); }
    let y = 28; g.textBaseline = 'top';
    lines.forEach((ln, i) => { const s = i === 0 ? size : Math.round(size * 0.5); g.font = `${i ? '500' : '700'} ${s}px ${i ? 'Inter, system-ui, sans-serif' : 'Cinzel, Georgia, serif'}`; g.fillStyle = i ? fg : '#d9b45a';
      for (const part of wrap(g, String(ln), w - 64)) { if (y + s > h - 16) return; g.fillText(part, 32, y); y += s * 1.18; } });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const panel = (texture, w, h, x, y, z, ry = 0, parent = scene) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p); return p; };
  function label(text, sub, col = '#f3ead7') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#0d0818cc'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill(); g.textAlign = 'center';
    g.fillStyle = col; g.font = '700 26px Inter, system-ui, sans-serif'; g.fillText(text, 128, 30);
    if (sub) { g.fillStyle = '#c9bfae'; g.font = '500 17px Inter, system-ui, sans-serif'; g.fillText(String(sub).slice(0, 26), 128, 52); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(1.6, 0.4, 1); return s;
  }
  const clickables = [], spots = {}, tours = [], services = {}, bounds = { minX: -8, maxX: 8, minZ: -4, maxZ: 10 }, after = {};
  const ctx = {
    THREE, kit, scene, cam, rig, renderer: R, mat, get tier() { return tier; }, M, box, panel, image, textCanvas, label, site, roster, esc, root,
    onClick: (obj, handler) => { obj.userData.onPick = handler; clickables.push(obj); return obj; },
    spot: (name, pos, look, tourLabel) => { spots[name] = { pos, look }; if (tourLabel) tours.push([name, tourLabel]); },
    extend: (x1, z1, x2, z2) => { bounds.minX = Math.min(bounds.minX, x1); bounds.minZ = Math.min(bounds.minZ, z1); bounds.maxX = Math.max(bounds.maxX, x2); bounds.maxZ = Math.max(bounds.maxZ, z2); },
    provide: (k, v) => { services[k] = v; }, use: k => services[k],
    goTo: n => goTo(n), card: html => cardOf(html), closeCard: () => closeCard(),
    btn: b => `<a class="ob ${b.primary !== false ? 'gold' : ''}" href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.label)}</a>`,
    hudButton: (text, fn, gold) => { const b = $('button', { class: 'ob' + (gold ? ' gold' : ''), type: 'button' }, esc(text)); b.onclick = fn; hud.insertBefore(b, bClassic); return b; },
    player: { get pos() { return pos; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, teleport: (x, z) => { pos.x = x; pos.z = z; glide = null; } },
    activity: () => { lastInput = performance.now(); },
    setTitle: t => { hud.querySelector('.t').textContent = t; }, announce: t => { live.textContent = t; },
  };
  // HUD (built before modules so they can add buttons)
  const hud = $('div', { class: 'office-hud' }, `<span class="t">Elder World Studio · Fólkvangr</span>`); const bClassic = $('button', { class: 'ob', type: 'button' }, 'Classic site'); hud.append(bClassic); root.append(hud);
  bClassic.onclick = () => { try { localStorage.setItem('ews-classic', '1'); } catch (e) {} if (opts.overlay) close(); else location.href = '/?classic=1'; };
  const live = $('div', { class: 'office-sr', 'aria-live': 'polite' }); root.append(live);

  // load + set up modules in registry order
  const mods = [];
  for (const m of registry.modules) {
    try {
      let anchor = m.anchor || [0, 0];
      if (typeof anchor[1] === 'string' && anchor[1].startsWith('after:')) anchor = [anchor[0], (after[anchor[1].slice(6)] ?? bounds.minZ) - 4];
      const mod = (await import(`../${m.src}?v=${V}`)).default; const r = (await mod.setup(ctx, m.config || {}, anchor)) || {};
      if (r.minZ != null) after[m.id] = r.minZ; mods.push(mod);
    } catch (e) { console.warn('office module failed:', m.id, e); }   // one broken module never takes the office down
  }
  // shell: floor + outer walls sized to whatever the modules built
  const { minX, maxX, minZ, maxZ } = bounds; const fx = minX - 2, fX = maxX + 2, fz = minZ - 2, fZ = maxZ;
  box(fX - fx, 0.2, fZ - fz, mat.floor, (fx + fX) / 2, -0.1, (fz + fZ) / 2);
  const wall = (x1, z1, x2, z2) => { const l = Math.hypot(x2 - x1, z2 - z1); const w = box(l, 4, 0.3, mat.wall, (x1 + x2) / 2, 2, (z1 + z2) / 2); w.rotation.y = -Math.atan2(z2 - z1, x2 - x1); };
  wall(fx, fZ, fX, fZ); wall(fx, fz, fX, fz); wall(fx, fz, fx, fZ); wall(fX, fz, fX, fZ);

  // controls: drag look, WASD/arrows, joystick, tap to pick, glide tours
  let lastInput = performance.now(); addEventListener('pointerdown', () => lastInput = performance.now(), true); addEventListener('keydown', () => lastInput = performance.now(), true);
  ctx.idleMs = () => performance.now() - lastInput;
  let yaw = Math.PI, pitch = 0; const pos = new THREE.Vector3(0, 1.65, 7.5); let glide = null;
  const lookAt = (p, l) => { const d = new THREE.Vector3(l[0] - p[0], l[1] - p[1], l[2] - p[2]); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
  function goTo(name) { const s = spots[name]; if (!s) return; const t = lookAt(s.pos, s.look); glide = { from: pos.clone(), to: new THREE.Vector3(...s.pos), y0: yaw, y1: yaw + (((t.yaw - yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, p0: pitch, p1: t.pitch, t: 0 }; }
  if (spots.lobby) { pos.set(...spots.lobby.pos); ({ yaw, pitch } = lookAt(spots.lobby.pos, spots.lobby.look)); }
  const keys = {}; addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,select')) return; keys[e.key.toLowerCase()] = 1; if (e.key === 'Escape') closeCard(); }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; });
  let drag = null, moved = 0; const el = R.domElement;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!drag) { el.style.cursor = pickAt(e) ? 'pointer' : 'grab'; return; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); yaw -= dx * 0.005; pitch = Math.max(-1, Math.min(0.8, pitch - dy * 0.004)); drag = { x: e.clientX, y: e.clientY }; glide = null; });
  el.addEventListener('pointerup', e => { if (drag && moved < 8) { const h = pickAt(e); if (h) h(); } drag = null; });
  const joy = $('div', { class: 'office-joy', 'aria-hidden': 'true' }, '<i></i>'); root.append(joy); let jv = { x: 0, y: 0 };
  const jmove = e => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - 55) / 45, y = (e.clientY - r.top - 55) / 45; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } jv = { x, y }; joy.firstChild.style.transform = `translate(${x * 35}px,${y * 35}px)`; glide = null; };
  joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); jmove(e); }); joy.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') jmove(e); });
  joy.addEventListener('pointerup', () => { jv = { x: 0, y: 0 }; joy.firstChild.style.transform = ''; });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(clickables, false)[0]; return h && h.distance < 30 ? h.object.userData.onPick : null; }
  const tour = $('nav', { class: 'office-tour', 'aria-label': 'Tour' });
  tours.forEach(([k, t]) => { const b = $('button', { class: 'ob', type: 'button' }, esc(t)); b.onclick = () => goTo(k); tour.append(b); }); root.append(tour);
  let card = null; function closeCard() { card?.remove(); card = null; }
  function cardOf(html) { closeCard(); card = $('section', { class: 'office-card', role: 'dialog', 'aria-modal': 'false' }, `<button class="x" type="button" aria-label="Close">×</button>${html}`); card.querySelector('.x').onclick = closeCard; root.append(card); const h = card.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus(); } return card; }
  function close() { running = false; R.setAnimationLoop(null); root.remove(); document.documentElement.classList.remove('office-on'); R.dispose(); }
  document.querySelector('.skip')?.addEventListener('click', () => { if (opts.overlay) close(); });
  ctx.state = s => mods.forEach(m => { try { m.onState?.(s); } catch (e) { console.warn(e); } });

  // loop with FPS watchdog
  const clock = new THREE.Clock(); let running = true, fa = 0, fn = 0, slow = false; const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  function resize() { const w = root.clientWidth, h = root.clientHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function frame() {
    if (!running) return; if (document.hidden && !R.xr.isPresenting) return;
    const rdt = clock.getDelta(), dt = Math.min(rdt, 0.05), t = clock.elapsedTime;
    fa += rdt; fn++; if (fa > 4) { const fps = fn / fa; fa = fn = 0; if (fps < 24 && tier > 0) { tier--; R.setPixelRatio(Math.min(devicePixelRatio, RATIOS[tier])); resize(); } else if (fps < 14 && tier === 0 && !slow) { slow = true; cardOf('<h3>Running slowly?</h3><p>Your device is struggling with the 3D office.</p><div class="row"><a class="ob gold" href="/?classic=1">Switch to the classic site</a></div>'); } }
    if (glide) { glide.t = Math.min(1, glide.t + dt / 1.6); const k = glide.t * glide.t * (3 - 2 * glide.t); pos.lerpVectors(glide.from, glide.to, k); yaw = glide.y0 + (glide.y1 - glide.y0) * k; pitch = glide.p0 + (glide.p1 - glide.p0) * k; if (glide.t >= 1) glide = null; }
    const mvF = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - jv.y, mvR = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + jv.x;
    if (keys.arrowleft) yaw += dt * 1.8; if (keys.arrowright) yaw -= dt * 1.8;
    if (mvF || mvR) { glide = null; fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(-fwd.z, 0, fwd.x); pos.addScaledVector(fwd, mvF * dt * 4).addScaledVector(right, mvR * dt * 4); pos.x = Math.max(fx + 1, Math.min(fX - 1, pos.x)); pos.z = Math.max(fz + 1, Math.min(fZ - 1, pos.z)); }
    if (R.xr.isPresenting) { rig.position.set(pos.x, 0, pos.z); rig.rotation.set(0, yaw, 0); cam.position.set(0, 0, 0); }
    else { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); cam.position.copy(pos); cam.rotation.set(pitch, yaw, 0, 'YXZ'); }
    for (const m of mods) m.onFrame?.(dt, t);
    R.render(scene, cam);
  }
  root.querySelector('.office-load').style.opacity = 0; setTimeout(() => root.querySelector('.office-load')?.remove(), 700);
  R.setAnimationLoop(frame); return { goTo, close, ctx };   // setAnimationLoop also drives WebXR frames
}
