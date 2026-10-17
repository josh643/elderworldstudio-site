// Live update path for non-world changes (2026-10-16). /office/manifest.json is written at deploy time (tools/office/manifest.py):
//   { code: <hash of every office .js/.json/.css>, assets: { "<path under /office/assets/>": "<content hash>" } }
// Every 60 s (and when the tab becomes visible) the page compares it with the one it booted with:
//   - only assets changed -> swap them in place: textures whose source is that file get the new bytes, and GLBs registered through
//     ctx.use('assets').watch(path, cb) are told the new versioned URL. No reload.
//   - a module changed (manifest v2 'modules') -> ctx.hotSwap(id): imported + built in the background, swapped in one tick, old disposed;
//     a failure keeps the old version (logged). Modules without dispose() fall back to the soft reload.
//   - core code changed -> soft reload only when idle (60 s without input, no card/tablet/typing/tour; a hidden tab waits too); floor + position + view restored (core/floors.js restore).
// Trigger: the world DO broadcasts {t:'release'} on every staging deploy (world-live passes it here), plus a slow 5-min safety poll.
export default {
  setup(ctx, cfg) {
    const url = cfg.url || '/office/manifest.json', every = cfg.everyMs || 300000, watchers = new Map(); let base = null, pending = false;
    const api = { watch: (path, cb) => { const k = String(path).replace(/^\/office\/assets\//, '').split('?')[0]; (watchers.get(k) || watchers.set(k, []).get(k)).push(cb); },
      url: (path) => { const k = String(path).replace(/^\/office\/assets\//, '').split('?')[0], h = base?.assets?.[k]; return '/office/assets/' + k + (h ? '?v=' + h : ''); }, get manifest() { return base; }, swaps: 0, checks: 0, hot: [] };
    ctx.provide('assets', api);
    const swapTextures = (k, h) => { const T = ctx.THREE, seen = new Set(), loader = new T.ImageLoader(); let n = 0;
      ctx.scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap']) { const t = m[key]; const src = t?.image?.currentSrc || t?.image?.src || t?.userData?.src || '';
        if (!t || seen.has(t) || !src.includes('/office/assets/' + k)) continue; seen.add(t); n++; loader.load('/office/assets/' + k + '?v=' + h, img => { t.image = img; t.needsUpdate = true; }); } });
      return n; };
    let busyC = false; const check = async () => { if (busyC) return; busyC = true; try { await check0(); } finally { busyC = false; } };
    api.check = () => check();
    const check0 = async () => {
      api.checks++; let m; try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return; m = await r.json(); } catch { return; }
      if (!base) { base = m; return; }
      if (m.code !== base.code) { if (!pending) { pending = true; window.__ewsOffice?.applyUpdateWhenIdle?.(); } return; }
      for (const [id, h] of Object.entries(m.modules || {})) if (base.modules?.[id] && base.modules[id] !== h) {
        base.modules[id] = h; const r = ctx.hotSwap ? await ctx.hotSwap(id, h) : 'reload'; api.hot.push({ id, h, r, at: Date.now() }); console.info('[live-update] module', id, h, r);
        if (r === 'reload' && !pending) { pending = true; window.__ewsOffice?.applyUpdateWhenIdle?.(); } }
      for (const [k, h] of Object.entries(m.assets || {})) if (base.assets?.[k] && base.assets[k] !== h) { const n = swapTextures(k, h); for (const cb of watchers.get(k) || []) { try { cb('/office/assets/' + k + '?v=' + h); } catch {} } api.swaps += n + (watchers.get(k)?.length || 0); }
      base = { ...m, code: base.code };
    };
    setTimeout(check, 1500); setInterval(check, every); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    const hook = () => { if (!window.__ewsOffice) return setTimeout(hook, 1000); window.__ewsOffice.liveUpdate = () => ({ code: base?.code, assets: Object.keys(base?.assets || {}).length, swaps: api.swaps, checks: api.checks, pending, hot: api.hot }); window.__ewsOffice.liveUpdateCheck = check; }; hook();
  },
};
