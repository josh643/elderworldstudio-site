// Elderverse day/night: one time of day for every visitor, from the SERVER clock (Date header of /api/office/state),
// in America/Chicago, with real sunrise/sunset for Memphis. No real-time GI: we blend 4 baked looks (day, golden, dusk,
// night) by sun elevation and push them into a handful of cheap knobs every 20 s:
//   sky/fog colour, hemisphere + sun light, the shared window-view canvas (one redraw), exterior glass tint,
//   ring lights + logo backlight (brighter at night), datacenter server glow (more visible at night), and the real exterior
//   (sky, haze, water, lamps, facade windows) via ctx.exterior.dayNight().
// Staging-only override: ?time=HH:MM (ignored on the public hostname).
const LAT = 35.1495, LON = -90.049, D2R = Math.PI / 180;
export function sunElevation(date) {   // NOAA simplified solar position, degrees
  const jd = date.getTime() / 864e5 + 2440587.5, n = jd - 2451545.0, L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
  const lam = L + 1.915 * Math.sin(g * D2R) + 0.02 * Math.sin(2 * g * D2R), eps = 23.439 - 4e-7 * n;
  const dec = Math.asin(Math.sin(eps * D2R) * Math.sin(lam * D2R)), ra = Math.atan2(Math.cos(eps * D2R) * Math.sin(lam * D2R), Math.cos(lam * D2R)) / D2R;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, lst = (gmst * 15 + LON) % 360, ha = ((lst - ra + 540) % 360 - 180) * D2R;
  return Math.asin(Math.sin(LAT * D2R) * Math.sin(dec) + Math.cos(LAT * D2R) * Math.cos(dec) * Math.cos(ha)) / D2R;
}
const LOOKS = {   // sky top, sky horizon, lake top, lake bottom, hemi, sun, sunColour, glass [rgb, opacity], rings, halo, servers, stars, cityLights
  day:    { st: '#7fb2e0', sh: '#e9e2cf', lt: '#7fa6c4', lb: '#3f6684', hemi: 1.3, sun: 1.1, sc: '#ffe2b0', gl: ['#9fc4d8', 0.35], ring: 1.0, halo: 0.75, srv: 0.6, stars: 0, lights: 0 },
  golden: { st: '#e7a46a', sh: '#ffd9a0', lt: '#c7966a', lb: '#5a4a5a', hemi: 1.2, sun: 1.0, sc: '#ffb070', gl: ['#e9b884', 0.38], ring: 1.05, halo: 0.85, srv: 0.8, stars: 0, lights: 0.3 },
  dusk:   { st: '#3a3466', sh: '#c47a6a', lt: '#4a4a6e', lb: '#1e2238', hemi: 1.05, sun: 0.35, sc: '#ff9a70', gl: ['#6a5a7a', 0.3], ring: 1.15, halo: 1.0, srv: 1.2, stars: 0.3, lights: 0.8 },
  night:  { st: '#070b1c', sh: '#1a2240', lt: '#141c34', lb: '#060a16', hemi: 0.95, sun: 0.0, sc: '#9ab0ff', gl: ['#ffcf8a', 0.22], ring: 1.3, halo: 1.25, srv: 1.7, stars: 1, lights: 1 } };
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixC = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function blend(el) {   // weights by sun elevation
  const pairs = el >= 10 ? ['day', 'day', 0] : el >= 2 ? ['golden', 'day', (el - 2) / 8] : el >= -4 ? ['dusk', 'golden', (el + 4) / 6] : el >= -10 ? ['night', 'dusk', (el + 10) / 6] : ['night', 'night', 0];
  const [a, b, t] = pairs, A = LOOKS[a], B = LOOKS[b], o = {};
  for (const k in A) o[k] = typeof A[k] === 'number' ? A[k] + (B[k] - A[k]) * t : Array.isArray(A[k]) ? [mixC(A[k][0], B[k][0], t), A[k][1] + (B[k][1] - A[k][1]) * t] : mixC(A[k], B[k], t);
  o.name = t > 0.5 ? b : a; return o;
}
export function drawView(g, P) {   // the baked lake/campus view behind every window, parameterised by the look
  const sky = g.createLinearGradient(0, 0, 0, 190); sky.addColorStop(0, P.st); sky.addColorStop(1, P.sh); g.fillStyle = sky; g.fillRect(0, 0, 512, 190);
  if (P.stars > 0.05) { g.fillStyle = `rgba(255,255,240,${0.8 * P.stars})`; for (let i = 0; i < 60; i++) g.fillRect((i * 151) % 512, (i * 67) % 150, 1.5, 1.5); }
  g.fillStyle = `rgba(255,255,255,${0.75 * (1 - P.stars)})`; for (const [x, y, r] of [[90, 60, 26], [120, 52, 32], [150, 62, 22], [360, 40, 20], [385, 34, 28], [410, 44, 18]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = mixC('#6f8a6a', '#0d1410', P.stars); g.beginPath(); g.moveTo(0, 190); for (let x = 0; x <= 512; x += 16) g.lineTo(x, 172 - Math.abs(Math.sin(x * 0.021)) * 26 - (x % 48 === 0 ? 8 : 0)); g.lineTo(512, 190); g.fill();
  g.fillStyle = mixC('#b8a688', '#1c1a22', P.stars); for (const [x, w, h] of [[300, 40, 34], [350, 26, 48], [384, 34, 28]]) g.fillRect(x, 190 - h, w, h);
  if (P.lights > 0.05) { g.fillStyle = `rgba(255,210,140,${P.lights})`; for (const [x, w, h] of [[300, 40, 34], [350, 26, 48], [384, 34, 28]]) for (let yy = 190 - h + 5; yy < 186; yy += 8) for (let xx = x + 4; xx < x + w - 4; xx += 8) if ((xx * 7 + yy * 3) % 5 < 3) g.fillRect(xx, yy, 4, 4); }
  const lake = g.createLinearGradient(0, 190, 0, 320); lake.addColorStop(0, P.lt); lake.addColorStop(1, P.lb); g.fillStyle = lake; g.fillRect(0, 190, 512, 130);
  g.fillStyle = `rgba(255,255,255,${0.25 * (1 - 0.6 * P.stars)})`; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 512, 196 + (i * 37) % 120, 18 + (i % 5) * 6, 2);
}
export function start(ctx, { hemi, sun, scene, THREE }) {
  const pub = /(^|\.)elderworldstudio\.com$/.test(location.hostname), m = !pub && /[?&]time=(\d{1,2}):(\d{2})/.exec(location.search);
  let offset = 0;   // server clock - device clock
  fetch('/api/office/state', { cache: 'no-store' }).then(r => { const d = Date.parse(r.headers.get('date')); if (d) { offset = d - Date.now(); apply(); } }).catch(() => {});
  const now = () => { if (!m) return new Date(Date.now() + offset);
    // ?time=HH:MM in America/Chicago today: find the UTC instant whose Chicago wall-clock is HH:MM
    const base = new Date(Date.now() + offset), f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [hh, mm] = f.format(base).split(':').map(Number); return new Date(base.getTime() + (((+m[1] - hh) * 60 + (+m[2] - mm)) * 60e3)); };
  const base = new Map(); const remember = o => { if (!base.has(o)) base.set(o, { c: o.color?.clone(), op: o.opacity }); return base.get(o); };
  const apply = () => {
    const d = now(), el = sunElevation(d), P = blend(el);
    scene.background.set(P.st); scene.fog?.color.set(mixC(P.st, '#0b0716', 0.5)); hemi.intensity = P.hemi; sun.intensity = P.sun; sun.color.set(P.sc);
    try { ctx.exterior?.dayNight?.(P, el, d); } catch (e) { console.warn(e); }   /* real exterior (core/exterior.js) */
    const V = ctx.kit.viewTex(ctx); drawView(V.image.getContext('2d'), P); V.needsUpdate = true;
    scene.traverse(o => { const t = o.userData?.dn; if (!t || !o.material) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mt of mats) { const b = remember(mt);
        if (t === 'glass') { mt.color.set(P.gl[0]); mt.opacity = P.gl[1]; }
        else if (b.c) mt.color.copy(b.c).multiplyScalar(t === 'ring' ? P.ring : t === 'halo' ? P.halo : t === 'server' ? P.srv : 1);
        if (t === 'halo' && b.op != null) mt.opacity = Math.min(1, b.op * P.halo); } });
    ctx.dayNight = { el: +el.toFixed(1), look: P.name, time: new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) };
  };
  apply(); setTimeout(apply, 4000); setInterval(apply, 20e3);   // second pass picks up lazily-built rooms
  return { apply, sunElevation };
}
