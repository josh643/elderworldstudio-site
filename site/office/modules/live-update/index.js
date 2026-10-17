// Live update path for non-world changes (2026-10-16). /office/manifest.json is written at deploy time (tools/office/manifest.py):
//   { code: <hash of every office .js/.json/.css>, assets: { "<path under /office/assets/>": "<content hash>" } }
// Every 60 s (and when the tab becomes visible) the page compares it with the one it booted with:
//   - only assets changed -> swap them in place: textures whose source is that file get the new bytes, and GLBs registered through
//     ctx.use('assets').watch(path, cb) are told the new versioned URL. No reload.
//   - code changed -> the engine's deferred reload (applyUpdateWhenIdle: waits for 2 min idle, never mid-chat or mid-tour).
export default {
  setup(ctx, cfg) {
    const url = cfg.url || '/office/manifest.json', every = cfg.everyMs || 60000, watchers = new Map(); let base = null, pending = false;
    const api = { watch: (path, cb) => { const k = String(path).replace(/^\/office\/assets\//, '').split('?')[0]; (watchers.get(k) || watchers.set(k, []).get(k)).push(cb); },
      url: (path) => { const k = String(path).replace(/^\/office\/assets\//, '').split('?')[0], h = base?.assets?.[k]; return '/office/assets/' + k + (h ? '?v=' + h : ''); }, get manifest() { return base; }, swaps: 0, checks: 0 };
    ctx.provide('assets', api);
    const swapTextures = (k, h) => { const T = ctx.THREE, seen = new Set(), loader = new T.ImageLoader(); let n = 0;
      ctx.scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap']) { const t = m[key]; const src = t?.image?.currentSrc || t?.image?.src || t?.userData?.src || '';
        if (!t || seen.has(t) || !src.includes('/office/assets/' + k)) continue; seen.add(t); n++; loader.load('/office/assets/' + k + '?v=' + h, img => { t.image = img; t.needsUpdate = true; }); } });
      return n; };
    const check = async () => {
      api.checks++; let m; try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return; m = await r.json(); } catch { return; }
      if (!base) { base = m; return; }
      if (m.code !== base.code) { if (!pending) { pending = true; window.__ewsOffice?.applyUpdateWhenIdle?.(); } return; }
      for (const [k, h] of Object.entries(m.assets || {})) if (base.assets?.[k] && base.assets[k] !== h) { const n = swapTextures(k, h); for (const cb of watchers.get(k) || []) { try { cb('/office/assets/' + k + '?v=' + h); } catch {} } api.swaps += n + (watchers.get(k)?.length || 0); }
      base = { ...m, code: base.code };
    };
    setTimeout(check, 1500); setInterval(check, every); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    const hook = () => { if (!window.__ewsOffice) return setTimeout(hook, 1000); window.__ewsOffice.liveUpdate = () => ({ code: base?.code, assets: Object.keys(base?.assets || {}).length, swaps: api.swaps, checks: api.checks, pending }); window.__ewsOffice.liveUpdateCheck = check; }; hook();
  },
};
