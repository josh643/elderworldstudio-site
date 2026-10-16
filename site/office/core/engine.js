// EWS 3D office engine (core). Knows nothing about games, teams or Freyja: it loads modules.json, gives each
// module a ctx (scene + helpers + service registry), then runs controls, HUD, tours, cards and the render loop.
// Module contract (modules/<id>/index.js): export default { setup(ctx, config, anchor) -> void|{bounds},
//   onState?(snapshot), onFrame?(dt, t) }. Modules share things with ctx.provide(name, v) / ctx.use(name).
import * as THREE from '../vendor/three.module.min.js?v=169';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=169';
import * as kit from './kit.js?v=18';
const V = 18, GOLD = 0xd9b45a;
const $ = (t, a = {}, h = '') => { const e = document.createElement(t); for (const k in a) e.setAttribute(k, a[k]); e.innerHTML = h; return e; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function start(opts = {}) {
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
  const R = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, powerPreference: 'high-performance' });
  const lowEnd = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4, RATIOS = [0.75, 1, 1.5];   // tier base ratios; DSCALE steps below these at runtime
  let tier = lowEnd ? 0 : devicePixelRatio > 1.5 ? 1 : 2; if (tier === 2 && matchMedia('(pointer: fine)').matches) RATIOS[2] = igpu ? 1.25 : 2;   // desktop: native res up to 2x, 1.25 on integrated GPUs
  if (igpu) RATIOS[1] = Math.min(RATIOS[1], 1.0);
  if (matchMedia('(pointer: fine)').matches) { RATIOS[0] = RATIOS[1] = 1; }   // desktops/kiosks never drop below native resolution; LOD and effects go first
  const DSCALE = matchMedia('(pointer: fine)').matches ? [1] : [1, 0.85, 0.72]; /* desktop never renders below native size; it sheds LOD instead */ let dstep = 0; const FINE = matchMedia('(pointer: fine)').matches; const applyRatio = () => R.setPixelRatio(FINE ? 1 : Math.min(devicePixelRatio, RATIOS[tier]) * DSCALE[dstep]);   // desktop/kiosk: exactly 1.0 (native CSS pixels)
  applyRatio(); R.outputColorSpace = THREE.SRGBColorSpace;
  root.prepend(R.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0716); scene.fog = new THREE.Fog(0x0b0716, 25, 70);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 120); const rig = new THREE.Group(); rig.add(cam); scene.add(rig);   // rig = player body (XR moves the camera inside it)
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1a1030, 1.3)); const sun = new THREE.DirectionalLight(0xffe2b0, 1.1); sun.position.set(8, 20, 6); scene.add(sun);
  const mcache = new Map(); const M = c => { if (!mcache.has(c)) mcache.set(c, M.standard ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }) : new THREE.MeshLambertMaterial({ color: c })); return mcache.get(c); };
  const mat = { floor: M(0x2a2236), wall: M(0x3a2f4a), trim: M(GOLD), dark: M(0x15101f), wood: M(0x6b4a2e), stone: M(0x4b4458), rack: M(0x1d1d24), glow: new THREE.MeshBasicMaterial({ color: GOLD }) };
  const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  const loader = new THREE.TextureLoader(); const image = src => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.capabilities.getMaxAnisotropy(); return t; };
  function wrap(g, s, max) { const out = []; let cur = ''; for (const wd of s.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > max && cur) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  function textCanvas(lines, { w = 1024, h = 256, bg = '#140c22', fg = '#f3ead7', size = 64, border = true } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const draw = () => { g.clearRect(0, 0, w, h);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } if (border) { g.strokeStyle = '#d9b45a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); }
    let y = 28; g.textBaseline = 'top';
    lines.forEach((ln, i) => { const s = i === 0 ? size : Math.round(size * 0.5); g.font = `${i ? '500' : '700'} ${s}px ${i ? 'Inter, system-ui, sans-serif' : 'Cinzel, Georgia, serif'}`; g.fillStyle = i ? fg : '#d9b45a';
      for (const part of wrap(g, String(ln), w - 64)) { if (y + s > h - 16) return; g.fillText(part, 32, y); y += s * 1.18; } }); };
    draw();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.text = lines.join(' ').trim();
    document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; }); return t;
  }
  const panel = (texture, w, h, x, y, z, ry = 0, parent = scene) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p); displays.push(p); return p; };
  const displays = [];
  function label(text, sub, col = '#f3ead7') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#0d0818cc'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill(); g.textAlign = 'center';
    g.fillStyle = col; g.font = '700 26px Inter, system-ui, sans-serif'; g.fillText(text, 128, 30);
    if (sub) { g.fillStyle = '#c9bfae'; g.font = '500 17px Inter, system-ui, sans-serif'; g.fillText(String(sub).slice(0, 26), 128, 52); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(1.6, 0.4, 1); return s;
  }
  const clickables = [], spots = {}, tours = [], services = {}, bounds = { minX: -8, maxX: 8, minZ: -4, maxZ: 10 }, after = {};
  const touch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches, xr = /OculusBrowser|Quest|Pico/i.test(navigator.userAgent);
  const verb = xr ? 'Trigger' : touch ? 'Tap' : 'Click or press E';   // device-aware prompt for in-world signs
  const ctx = {
    verb, touch, lod: 1,
    THREE, kit, scene, cam, rig, renderer: R, mat, get tier() { return tier; }, M, box, panel, image, textCanvas, label, site, roster, esc, root,
    onClick: (obj, handler) => { obj.userData.onPick = handler; clickables.push(obj); return obj; },
    spot: (name, pos, look, tourLabel) => { spots[name] = { pos, look }; if (tourLabel) tours.push([name, tourLabel]); },
    extend: (x1, z1, x2, z2) => { bounds.minX = Math.min(bounds.minX, x1); bounds.minZ = Math.min(bounds.minZ, z1); bounds.maxX = Math.max(bounds.maxX, x2); bounds.maxZ = Math.max(bounds.maxZ, z2); },
    provide: (k, v) => { services[k] = v; }, use: k => services[k],
    goTo: n => goTo(n), card: html => cardOf(html), closeCard: () => closeCard(),
    btn: b => `<a class="ob ${b.primary !== false ? 'gold' : ''}" href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.label)}</a>`,
    hudButton: (text, fn) => { const b = $('button', { class: 'ob', type: 'button' }, esc(text)); b.onclick = fn; srNav.append(b); return b; },   // a11y only; visible UI is in-world
    sign: (text, sub, x, y, z, ry, fn, w = 2.6) => { const p = panel(textCanvas([text, sub || ''], { w: 768, h: 200, size: 64 }), w, w * 0.26, x, y, z, ry); if (fn) ctx.onClick(p, fn); return p; },
    get tours() { return tours; }, spotOf: k => spots[k],
    player: { get pos() { return pos; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, teleport: (x, z) => { pos.x = x; pos.z = z; glide = null; } },
    activity: () => { lastInput = performance.now(); },
    setTitle: t => { hud.querySelector('.t').textContent = t; }, announce: t => { live.textContent = t; },
  };
  // HUD (built before modules so they can add buttons)
  const hud = $('div', { class: 'office-hud' }, `<span class="t">Elder World Studio · Fólkvangr</span>`); root.append(hud);
  const srNav = $('nav', { class: 'office-srnav', 'aria-label': 'Office navigation' }); const bClassic = $('button', { class: 'ob', type: 'button' }, 'Classic site'); srNav.append(bClassic); root.append(srNav);
  ctx.classic = () => { try { localStorage.setItem('ews-classic', '1'); } catch (e) {} if (opts.overlay) close(); else location.href = '/?classic=1'; };
  bClassic.onclick = () => ctx.classic();
  const live = $('div', { class: 'office-sr', 'aria-live': 'polite' }); root.append(live);

  // load + set up modules in registry order
  const mods = [];
  for (const m of registry.modules) {
    await new Promise(r => setTimeout(r, 0));   // yield between modules: no long main-thread tasks
    try {
      let anchor = m.anchor || [0, 0];
      if (typeof anchor[1] === 'string' && anchor[1].startsWith('after:')) anchor = [anchor[0], (after[anchor[1].slice(6)] ?? bounds.minZ) - 4];
      const mod = (await import(`../${m.src}?v=${V}`)).default; const r = (await mod.setup(ctx, m.config || {}, anchor)) || {};
      if (r.minZ != null) after[m.id] = r.minZ; mods.push(mod);
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
    ctx.colliders = cols; }
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
  wall(fx, fZ, fX, fZ); wall(fx, fz, fX, fz); wall(fx, fz, fx, fZ); wall(fX, fz, fX, fZ);
  // ceiling + recessed light panels (one instanced draw call), so there is no black void overhead
  box(fX - fx, 0.1, fZ - fz, new THREE.MeshStandardMaterial({ color: 0x3a3442, roughness: 0.9 }), (fx + fX) / 2, 4.05, (fz + fZ) / 2);
  { const cols = Math.floor((fX - fx) / 4), rows = Math.floor((fZ - fz) / 4), lp = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 0.5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false }), cols * rows), m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { m4.makeTranslation(fx + 2 + i * 4, 3.99, fz + 2 + j * 4); lp.setMatrixAt(k++, m4); } scene.add(lp); }

  // controls: drag look, WASD/arrows, joystick, tap to pick, glide tours
  let lastInput = performance.now(); addEventListener('pointerdown', () => lastInput = performance.now(), true); addEventListener('keydown', () => lastInput = performance.now(), true);
  ctx.idleMs = () => performance.now() - lastInput;
  let yaw = Math.PI, pitch = 0; const pos = new THREE.Vector3(0, 1.65, 7.5); let glide = null;
  const lookAt = (p, l) => { const d = new THREE.Vector3(l[0] - p[0], l[1] - p[1], l[2] - p[2]); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
  const EYE = 1.65; function goTo(name) { const s = spots[name]; if (!s) return; const sp = [s.pos[0], EYE, s.pos[2]], t = lookAt(sp, s.look); t.pitch = Math.max(-0.5, Math.min(0.4, t.pitch)); glide = { from: pos.clone(), to: new THREE.Vector3(...sp), y0: yaw, y1: yaw + (((t.yaw - yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, p0: pitch, p1: t.pitch, t: 0 }; }
  if (spots.lobby) { pos.set(spots.lobby.pos[0], EYE, spots.lobby.pos[2]); ({ yaw, pitch } = lookAt([pos.x, EYE, pos.z], spots.lobby.look)); }
  const keys = {}; addEventListener('blur', () => { for (const k in keys) keys[k] = 0; }); addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,select')) return; keys[e.key.toLowerCase()] = 1; if (e.key === 'Escape') closeCard(); }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; });
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
    scene.traverse(o => { if (!o.userData.plate) return; const im = o.material.map?.image; let ok = false; try { const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data; let gold = 0; for (let i = 0; i < d.length; i += 64) if (d[i] > 150 && d[i + 2] < 140) gold++; ok = gold > 40; } catch {} if (!ok || !o.material.map.userData.text) out.push({ type: 'blank-plate', name: o.userData.plate }); });
    return out; }
  window.__ewsOffice = { get yaw() { return yaw; }, get pitch() { return pitch; }, checkOcclusion, sanity };
  const fine = matchMedia('(pointer: fine)').matches; lookHint.style.display = fine ? 'block' : 'none'; const locked = () => document.pointerLockElement === el;
  const center = { clientX: 0, clientY: 0 }; const centerPick = () => { const r = el.getBoundingClientRect(); center.clientX = r.left + r.width / 2; center.clientY = r.top + r.height / 2; return pickAt(center); };
  const xhair = $('div', { class: 'office-xhair', 'aria-hidden': 'true' }); root.append(xhair);
  document.addEventListener('pointerlockchange', () => { xhair.style.display = locked() ? 'block' : 'none'; });
  let skipMove = 0, zeroRun = 0, lockBroken = (() => { try { return localStorage.getItem('ews-nolock') === '1'; } catch { return false; } })(); document.addEventListener('pointerlockchange', () => { skipMove = 2; });
  document.addEventListener('mousemove', e => { if (!locked()) return; if (skipMove) { skipMove--; return; }
    if (e.movementX === 0 && e.movementY === 0) { if (++zeroRun > 12) { lockBroken = true; try { localStorage.setItem('ews-nolock', '1'); } catch {} document.exitPointerLock(); } return; } zeroRun = 0;   // compositor without relative-pointer support (e.g. cage): fall back to steer mode   // first events after (re)lock carry bogus jumps
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
    const to = pos.clone().addScaledVector(dir, Math.max(0, d - 0.8)); to.x = Math.max(fx + 1, Math.min(fX - 1, to.x)); to.z = Math.max(fz + 1, Math.min(fZ - 1, to.z)); to.y = pos.y;
    glide = { from: pos.clone(), to, y0: yaw, y1: yaw, p0: pitch, p1: pitch, t: 0, walk: true }; ripple(fhit); }
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 })); rip.rotation.x = -Math.PI / 2; scene.add(rip);
  function ripple(p) { rip.position.set(p.x, 0.02, p.z); rip.material.opacity = 0.9; rip.scale.setScalar(1); }
  function pickAt(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(clickables, false)[0]; return h && h.distance < 30 ? h.object.userData.onPick : null; }
  tours.forEach(([k, t]) => { const b = $('button', { class: 'ob', type: 'button' }, 'Go to ' + esc(t)); b.onclick = () => goTo(k); srNav.append(b); });
  let card = null; function closeCard() { card?.remove(); card = null; }
  function cardOf(html) { if (document.pointerLockElement) document.exitPointerLock(); closeCard(); card = $('section', { class: 'office-card', role: 'dialog', 'aria-modal': 'false' }, `<button class="x" type="button" aria-label="Close">×</button>${html}`); card.querySelector('.x').onclick = closeCard; root.append(card); const h = card.querySelector('h3'); if (h) { h.tabIndex = -1; h.focus(); } return card; }
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
    const mvF = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - jv.y, mvR = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + jv.x;
    if (keys.arrowleft || keys.q) yaw += dt * 1.8; if (keys.arrowright || keys.r) yaw -= dt * 1.8;   // keyboard turning never needs the cursor
    if (edgeX && !locked() && !drag && !card) yaw -= edgeX * dt * 2.2;          // cursor parked at a screen edge = keep turning
    if (mvF || mvR) { glide = null; fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(-fwd.z, 0, fwd.x); const sp = keys.shift ? 8 : 4; pos.addScaledVector(fwd, mvF * dt * sp).addScaledVector(right, mvR * dt * sp); pos.x = Math.max(fx + 1, Math.min(fX - 1, pos.x)); pos.z = Math.max(fz + 1, Math.min(fZ - 1, pos.z)); }
    cullT += rdt; if (cullT > 0.4) { cullT = 0; const wp = new THREE.Vector3();   // distance-cull signs/displays (each is its own draw call)
      for (const p of farCull) { const u = p.userData.fc; const far = u.c.distanceTo(pos) - u.r > 20; if (far && p.visible) { p.visible = false; p.userData.far = 1; } else if (!far && p.userData.far) { p.visible = true; p.userData.far = 0; } }
      for (const p of displays) { p.getWorldPosition(wp); const far = wp.distanceToSquared(pos) > 18 * 18; if (far && p.visible) { p.visible = false; p.userData.far = 1; } else if (!far && p.userData.far) { p.visible = true; p.userData.far = 0; } } }
    if (!glide || glide.walk) { const ox = pos.x, oz = pos.z; collide(pos); if (glide?.walk && Math.hypot(pos.x - ox, pos.z - oz) > 0.01) glide = null; }   // tours glide freely; walking (keys or tap-to-walk) is blocked by furniture
    pos.y = EYE;   // always grounded at eye height: tours and teleports never lift the walking camera
    if (R.xr.isPresenting) { rig.position.set(pos.x, 0, pos.z); rig.rotation.set(0, yaw, 0); cam.position.set(0, 0, 0); }
    else { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); cam.position.copy(pos); cam.rotation.set(pitch, yaw, 0, 'YXZ'); }
    if (rip.material.opacity > 0) { rip.material.opacity = Math.max(0, rip.material.opacity - dt * 1.5); rip.scale.multiplyScalar(1 + dt * 1.2); }
    for (const m of mods) m.onFrame?.(dt, t);
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
  const farCull = []; function collectFar() { farCull.length = 0; const clickSet = new Set(clickables); for (const o of scene.children) { if (o.userData.batched || o.isLight || o.userData.a || o.isSkinnedMesh || o.isInstancedMesh || o === rip) continue; let skin = false; o.traverse(c => { if (c.isSkinnedMesh || c.userData.a) skin = true; }); if (!skin && !displays.includes(o) && o.visible) { const bx = new THREE.Box3().setFromObject(o); if (bx.isEmpty()) continue; const sp = bx.getBoundingSphere(new THREE.Sphere()); if (sp.radius > 12) continue; o.userData.fc = { c: sp.center, r: sp.radius }; farCull.push(o); } } }
  buildColliders(); baseCols = cols.slice(); batchStatic(); collectFar();
  setTimeout(() => { buildColliders(); const b0 = ctx.batched; batchStatic(); ctx.batched = { before: b0.before + ctx.batched.before, after: b0.after + ctx.batched.after }; collectFar(); }, 10500);   /* second pass: lazy GLB props */
  setTimeout(buildColliders, 4000); setTimeout(buildColliders, 10000);   // again once the lazy props have landed
  window.__ewsOffice.scene = scene; window.__ewsOffice.colAt = (x, z, r = 0.6) => cols.filter(c => x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r); window.__ewsOffice.breakdown = () => { const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const m = {}; scene.traverseVisible(o => { if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return; if (o.frustumCulled && !o.isSkinnedMesh && o.geometry && !fr.intersectsObject(o)) return; let r = o; while (r.parent && r.parent !== scene) r = r.parent; const k = (o.isSkinnedMesh ? "skin:" : o.isSprite ? "sprite:" : o.isInstancedMesh ? "inst:" : "") + (r.userData.mod || r.name || r.type); m[k] = (m[k] || 0) + (Array.isArray(o.material) ? o.material.length : 1); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40); }; window.__ewsOffice.colliders = () => cols.length; window.__ewsOffice.orphans = () => { const out = []; scene.traverse(o => { if (!o.isSkinnedMesh) return; let p = o, ok = false; while (p) { if (p.userData?.a) ok = true; p = p.parent; } if (!ok) { let r = o; while (r.parent && r.parent !== scene) r = r.parent; out.push('ROOT ' + JSON.stringify(r.userData).slice(0, 120) + ' pos ' + r.position.toArray().join(',')); const chain = []; let q = o; while (q) { chain.push((q.type || '') + ':' + (q.name || '')); q = q.parent; } out.push(chain.join(' < ')); } }); return out; }; window.__ewsOffice.avatars = () => [...(ctx.use('avatar')?.all || [])].map(g => ({ id: g.userData.a?.id, name: g.userData.a?.name, p: g.position.toArray().map(v => +v.toFixed(2)), ry: +g.rotation.y.toFixed(2), clip: g.userData.cur, vis: g.visible, inScene: !!g.parent })); window.__ewsOffice.look = (x, z, lx, lz) => { pos.set(x, EYE, z); glide = null; ({ yaw, pitch } = lookAt([x, EYE, z], [lx, 1.2, lz])); }; window.__ewsOffice.info = () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, batched: ctx.batched, ratio: R.getPixelRatio(), buf: R.getDrawingBufferSize(new THREE.Vector2()).toArray(), tier, lod: ctx.lod }); window.__ewsOffice.desks = () => ctx.desks || []; window.__ewsOffice.walk = (x, z, ang, secs) => { pos.set(x, EYE, z); glide = null; yaw = ang; keys.w = 1; return new Promise(r => setTimeout(() => { keys.w = 0; r([pos.x, pos.z]); }, secs * 1000)); };
  R.setAnimationLoop(frame); return { goTo, close, ctx };   // setAnimationLoop also drives WebXR frames
}
