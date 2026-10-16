// Kiosk mode for in-store screens: /?kiosk=1 (or /office/?kiosk=1). Fullscreen on first touch, hides "Classic site",
// resets to the lobby after idleSeconds without input, and runs an attract loop through the tour stops while idle.
export default {
  setup(ctx, cfg) {
    if (!new URLSearchParams(location.search).has('kiosk')) return;
    this.on = true; this.ctx = ctx; this.idle = (cfg.idleSeconds || 90) * 1000; this.every = (cfg.attractSeconds || 9) * 1000;
    this.stops = cfg.attract || ['lobby', 'games', 'services', 'merch', 'teams', 'datacenter']; this.i = 0; this.last = 0;
    try { localStorage.removeItem('ews-classic'); } catch {}
    const fs = () => { document.documentElement.requestFullscreen?.().catch(() => {}); removeEventListener('pointerdown', fs); };
    addEventListener('pointerdown', fs);
    const st = document.createElement('style'); st.textContent = '.office-hud .ob:not(.gold){display:none}'; document.head.append(st);
  },
  onFrame() {
    if (!this.on) return; const idle = this.ctx.idleMs(), now = performance.now();
    if (idle > this.idle) {
      if (!this.attract) { this.attract = true; this.ctx.closeCard(); this.i = 0; this.last = 0; }
      if (now - this.last > this.every) { this.ctx.goTo(this.stops[this.i++ % this.stops.length]); this.last = now; }
    } else this.attract = false;
  },
};
