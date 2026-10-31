// Futuristic worlds HUD: start, pause, help, settings, minimap, location, touch joystick.
// No medieval/fantasy crests or runes. No client names. Settings live in localStorage `ews-worlds` only.

const STORE = 'ews-worlds';
const read = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
const write = (o) => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch {} };

function locLabel(ctx) {
  const tr = ctx.use('worldsTravel');
  if (tr?.zone === 'space') return 'Orbit · Elderverse system';
  if (tr?.zone === 'omnivael') {
    const p = ctx.player.pos;
    if (Math.hypot(p.x, p.z - 10) < 5) return 'Omnivael · Visitor pad';
    if (p.z < -14) return 'Omnivael · Duskfall gate';
    return 'Omnivael · Valtoria frontier';
  }
  const p = ctx.player.pos, fl = ctx.curFloor || 'G';
  if (tr?.near) return 'Campus · Launch pad';
  if (ctx.exterior && (p.z > (ctx.shell?.fZ || 10) + 50)) return 'District 1 · Elder Avenue';
  if (ctx.exterior && (p.z > (ctx.shell?.fZ || 10) + 2 || p.x < (ctx.shell?.fx || -10) || p.x > (ctx.shell?.fX || 10))) return 'Campus grounds';
  if (fl === 'G') return 'Fólkvangr · Lobby';
  if (fl === 'B1') return 'Campus · Restricted';
  return 'Campus · Floor ' + fl;
}

export default {
  setup(ctx) {
    if (!ctx.worlds) return;
    this.ctx = ctx;
    const cfg = Object.assign({ quality: 'auto', sensitivity: 1, invertY: false, minimap: true }, read());
    ctx.lookSens = cfg.sensitivity;
    ctx.qualityMode = cfg.quality;
    this.cfg = cfg;
    const auto = /[?&]autostart=1/.test(location.search);
    ctx.menuOpen = !auto;

    if (!document.querySelector('link[href*="worlds.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/worlds/worlds.css?v=1'; document.head.append(l);
    }

    const ui = document.createElement('div');
    ui.className = 'ew-ui';
    ui.innerHTML = `
      <div class="ew-top">
        <div class="ew-brand"><b>ELDERVERSE</b><span>worlds</span></div>
        <div class="ew-loc" data-loc>Campus</div>
        <div class="ew-top-actions">
          <button type="button" class="ew-btn" data-act="help">Controls</button>
          <button type="button" class="ew-btn" data-act="settings">Settings</button>
          <button type="button" class="ew-btn" data-act="pause">Pause</button>
        </div>
      </div>
      <canvas class="ew-map" width="160" height="160" aria-label="Minimap"></canvas>
      <div class="ew-prompt" hidden data-prompt></div>
      <div class="ew-joy" hidden>
        <div class="ew-joy-stick" data-joy="move" aria-label="Move"><i></i></div>
        <div class="ew-joy-look" data-joy="look" aria-label="Look"></div>
        <button type="button" class="ew-joy-act" data-act="jump">JUMP</button>
        <button type="button" class="ew-joy-act ew-joy-use" data-act="use">USE</button>
      </div>
      <div class="ew-screen ${auto ? 'hide' : ''}" data-screen="start">
        <div class="ew-panel">
          <p class="ew-kicker">Elder World Studio</p>
          <h1>ELDERVERSE</h1>
          <p class="ew-sub">Walk the campus. Launch to orbit. Land on Omnivael.</p>
          <button type="button" class="ew-cta" data-act="enter">Enter world</button>
          <p class="ew-fine">WASD · mouse look · E to use · Esc to pause · gamepad + touch supported</p>
        </div>
      </div>
      <div class="ew-screen hide" data-screen="pause">
        <div class="ew-panel">
          <h2>Paused</h2>
          <button type="button" class="ew-cta" data-act="resume">Resume</button>
          <button type="button" class="ew-btn" data-act="help">Controls</button>
          <button type="button" class="ew-btn" data-act="settings">Settings</button>
        </div>
      </div>
      <div class="ew-screen hide" data-screen="help">
        <div class="ew-panel ew-wide">
          <h2>Controls</h2>
          <ul class="ew-keys">
            <li><kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump</li>
            <li>Mouse look (click canvas) · <kbd>Q</kbd>/<kbd>R</kbd> or arrows turn</li>
            <li><kbd>E</kbd> use launch pad / land / return</li>
            <li><kbd>Esc</kbd> pause · <kbd>H</kbd> this panel</li>
            <li>Gamepad: left stick move, right stick look, A jump, B/X use, Start pause</li>
            <li>Phone: left stick move, right pad look, JUMP / USE</li>
          </ul>
          <button type="button" class="ew-cta" data-act="close">Close</button>
        </div>
      </div>
      <div class="ew-screen hide" data-screen="settings">
        <div class="ew-panel">
          <h2>Settings</h2>
          <label>Graphics
            <select data-set="quality">
              <option value="auto">Auto (adaptive)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="ultra">Ultra (horizon)</option>
            </select>
          </label>
          <label>Look sensitivity
            <input type="range" min="0.4" max="2.2" step="0.1" data-set="sensitivity">
          </label>
          <label class="ew-check"><input type="checkbox" data-set="invertY"> Invert look Y</label>
          <label class="ew-check"><input type="checkbox" data-set="minimap"> Show minimap</label>
          <label class="ew-check"><input type="checkbox" data-set="ewsrender"> EWS renderer (Phase 2)</label>
          <label>Builder token
            <input type="password" data-set="modtoken" autocomplete="off" placeholder="configured on the host">
          </label>
          <button type="button" class="ew-btn" data-act="modlogin">Sign in as builder</button>
          <button type="button" class="ew-cta" data-act="close">Done</button>
        </div>
      </div>`;
    ctx.root.append(ui);
    this.ui = ui;
    ui.querySelector('[data-set=quality]').value = cfg.quality;
    ui.querySelector('[data-set=sensitivity]').value = cfg.sensitivity;
    ui.querySelector('[data-set=invertY]').checked = cfg.invertY;
    ui.querySelector('[data-set=minimap]').checked = cfg.minimap;
    try { ui.querySelector('[data-set=ewsrender]').checked = localStorage.getItem('ews-render') === '1' || /[?&]ewsrender=1/.test(location.search); } catch {}

    const show = (name) => {
      ui.querySelectorAll('.ew-screen').forEach(s => s.classList.toggle('hide', s.getAttribute('data-screen') !== name));
      ctx.menuOpen = name === 'start' || name === 'pause' || name === 'help' || name === 'settings';
      ctx.paused = name === 'pause';
      if (name === 'start' || name === 'pause' || name === 'help' || name === 'settings') document.exitPointerLock?.();
    };
    this.show = show;
    ui.addEventListener('click', e => {
      const a = e.target.closest?.('[data-act]')?.getAttribute('data-act');
      if (a === 'enter' || a === 'resume' || a === 'close') { show(null); ctx.menuOpen = false; ctx.paused = false; ui.querySelectorAll('.ew-screen').forEach(s => s.classList.add('hide')); }
      if (a === 'pause') show('pause');
      if (a === 'help') show('help');
      if (a === 'settings') show('settings');
      if (a === 'jump') ctx._wantJump = true;
      if (a === 'use') ctx.use('worldsTravel')?.interact?.();
      if (a === 'modlogin') {
        const tok = ui.querySelector('[data-set=modtoken]')?.value || '';
        ctx.use('worldsEditor')?.login(tok);
      }
    });
    ui.querySelector('[data-set=quality]').addEventListener('change', e => {
      cfg.quality = e.target.value; ctx.qualityMode = cfg.quality; write(cfg);
      ctx.use('worldsLod')?.setMode(cfg.quality);
      ctx.tierChanged?.(cfg.quality === 'low' ? 0 : (cfg.quality === 'high' || cfg.quality === 'ultra') ? 2 : 1);
    });
    ui.querySelector('[data-set=sensitivity]').addEventListener('input', e => { cfg.sensitivity = +e.target.value; ctx.lookSens = cfg.sensitivity; write(cfg); });
    ui.querySelector('[data-set=invertY]').addEventListener('change', e => { cfg.invertY = e.target.checked; write(cfg); });
    ui.querySelector('[data-set=minimap]').addEventListener('change', e => { cfg.minimap = e.target.checked; write(cfg); ui.querySelector('.ew-map').hidden = !cfg.minimap; });
    ui.querySelector('[data-set=ewsrender]').addEventListener('change', e => {
      try { localStorage.setItem('ews-render', e.target.checked ? '1' : '0'); } catch {}
      const u = new URL(location.href);
      if (e.target.checked) u.searchParams.set('ewsrender', '1'); else u.searchParams.delete('ewsrender');
      location.href = u.toString();
    });
    addEventListener('keydown', e => {
      if (e.target.closest?.('input,textarea,select')) return;
      if (e.code === 'Escape') { if (ctx.menuOpen && !ui.querySelector('[data-screen=start]:not(.hide)')) { show(null); ctx.menuOpen = false; ctx.paused = false; ui.querySelectorAll('.ew-screen').forEach(s => s.classList.add('hide')); } else show('pause'); }
      if (e.code === 'KeyH') show('help');
    });

    const coarse = matchMedia('(pointer: coarse)').matches;
    const joy = ui.querySelector('.ew-joy'); joy.hidden = !coarse;
    ctx.joy = { x: 0, y: 0, run: false };
    if (coarse) {
      const stick = joy.querySelector('[data-joy=move]'), knob = stick.querySelector('i'), look = joy.querySelector('[data-joy=look]');
      const at = (el, ev) => { const b = el.getBoundingClientRect(), x = (ev.clientX - (b.left + b.width / 2)) / (b.width / 2), y = (ev.clientY - (b.top + b.height / 2)) / (b.height / 2), m = Math.hypot(x, y) || 1; return { x: x / Math.max(1, m), y: y / Math.max(1, m) }; };
      stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); const v = at(stick, e); ctx.joy.x = v.x; ctx.joy.y = v.y; knob.style.transform = `translate(${v.x * 36}px,${v.y * 36}px)`; });
      stick.addEventListener('pointermove', e => { if (!stick.hasPointerCapture(e.pointerId)) return; const v = at(stick, e); ctx.joy.x = v.x; ctx.joy.y = v.y; ctx.joy.run = Math.hypot(v.x, v.y) > 0.9; knob.style.transform = `translate(${v.x * 36}px,${v.y * 36}px)`; });
      const end = () => { ctx.joy.x = ctx.joy.y = 0; ctx.joy.run = false; knob.style.transform = ''; };
      stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
      let lp = null;
      look.addEventListener('pointerdown', e => { look.setPointerCapture(e.pointerId); lp = { x: e.clientX, y: e.clientY }; });
      look.addEventListener('pointermove', e => {
        if (!lp) return;
        ctx.player.yaw -= (e.clientX - lp.x) * 0.008 * cfg.sensitivity;
        ctx.player.pitch -= (cfg.invertY ? -(e.clientY - lp.y) : (e.clientY - lp.y)) * 0.006 * cfg.sensitivity;
        lp = { x: e.clientX, y: e.clientY };
      });
      look.addEventListener('pointerup', () => { lp = null; });
    }
    ui.querySelector('.ew-map').hidden = !cfg.minimap;
    this.map = ui.querySelector('.ew-map');
    this.prompt = ui.querySelector('[data-prompt]');
    this.loc = ui.querySelector('[data-loc]');
  },
  onFrame() {
    if (!this.ctx?.worlds || !this.ui) return;
    this.loc.textContent = locLabel(this.ctx);
    const tr = this.ctx.use('worldsTravel');
    let msg = '';
    if (tr?.zone === 'town' && tr.near) msg = 'E · Launch to orbit';
    if (tr?.zone === 'space') msg = 'E near a planet to land';
    if (tr?.zone === 'omnivael' && Math.hypot(this.ctx.player.pos.x, this.ctx.player.pos.z - 10) < 4) msg = 'E · Return to orbit';
    this.prompt.hidden = !msg; this.prompt.textContent = msg;
    if (!this.cfg.minimap || !this.map) return;
    const g = this.map.getContext('2d'), W = this.map.width, p = this.ctx.player.pos;
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(4,10,18,0.72)'; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(62,232,255,0.35)'; g.strokeRect(1, 1, W - 2, W - 2);
    const zone = tr?.zone || 'town';
    const sc = zone === 'space' ? 0.6 : 1.15, cx = W / 2, cy = W / 2;
    const sx = x => cx + (x - p.x) * sc, sz = z => cy + (z - p.z) * sc;
    g.fillStyle = 'rgba(62,232,255,0.12)';
    (this.ctx.colliders || []).forEach(c => { g.fillRect(sx(c[0]), sz(c[1]), (c[2] - c[0]) * sc, (c[3] - c[1]) * sc); });
    if (tr?.pad) { g.fillStyle = '#3ee8ff'; g.beginPath(); g.arc(sx(tr.pad.x), sz(tr.pad.z), 3, 0, 6.3); g.fill(); }
    g.fillStyle = '#d24bff'; g.beginPath(); g.arc(cx, cy, 3.5, 0, 6.3); g.fill();
    g.strokeStyle = '#3ee8ff'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - Math.sin(this.ctx.player.yaw) * 10, cy - Math.cos(this.ctx.player.yaw) * 10); g.stroke();
  },
};
