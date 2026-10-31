export async function waitReady(page, timeout = 60_000) {
  await page.waitForFunction(() => window.__ewsWorlds?.ready === true, null, { timeout });
}

export function noPageErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

export function serious(errors) {
  return errors.filter(e => !/404|Failed to load resource|favicon|freyja|office\/state|office\/world|layout-status|webgl|WebGL/i.test(e));
}

/** Layout + overlay dump used by mobile / HUD regression tests. */
export async function worldsChrome(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, area = vw * vh;
    const vis = el => {
      if (!el) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const cover = el => {
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return (w * h) / area;
    };
    const screens = [...document.querySelectorAll('.ew-screen')].map(el => ({
      name: el.getAttribute('data-screen'),
      hiddenClass: el.classList.contains('hide'),
      visible: vis(el),
      cover: cover(el),
    }));
    const map = document.querySelector('.ew-map');
    const wrap = document.querySelector('.ew-map-wrap');
    const mr = map?.getBoundingClientRect();
    const wr = wrap?.getBoundingClientRect();
    const load = document.querySelector('.office-load');
    const overlays = [...document.querySelectorAll('.ew-screen, .office-load, .office-card, .ew-fade, .ew-map, .ew-map-wrap')]
      .filter(el => vis(el) && cover(el) >= 0.45)
      .filter(el => el.tagName !== 'CANVAS' || el.classList.contains('ew-map'))
      .map(el => ({ cls: el.className, tag: el.tagName, cover: +cover(el).toFixed(3), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
    const hudBtns = [...document.querySelectorAll('.ew-top-actions .ew-btn')]
      .filter(b => vis(b))
      .map(b => {
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent.trim(),
          inView: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
          left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
        };
      });
    return {
      vw, vh,
      screens,
      map: mr ? { w: +mr.width.toFixed(1), h: +mr.height.toFixed(1), hidden: !!(map.hidden || wrap?.hidden) } : null,
      wrap: wr ? { w: +wr.width.toFixed(1), h: +wr.height.toFixed(1), hidden: !!wrap.hidden } : null,
      load: !!load && vis(load),
      overlays,
      hudBtns,
      menuOpen: !!(window.__ewsWorlds && document.querySelector('.ew-screen:not(.hide)')),
    };
  });
}

export function assertPlayableChrome(info, { maxMap = 160 } = {}) {
  if (info.load) throw new Error('office-load still visible');
  const open = (info.screens || []).filter(s => s.visible && !s.hiddenClass);
  if (open.length) throw new Error('menu/start overlay still open: ' + open.map(s => s.name).join(','));
  if ((info.overlays || []).length) throw new Error('fullscreen overlay still visible: ' + JSON.stringify(info.overlays));
  if (info.map && !info.map.hidden && (info.map.w > maxMap || info.map.h > maxMap)) {
    throw new Error(`minimap stretched to ${info.map.w}x${info.map.h}`);
  }
  if (info.wrap && !info.wrap.hidden && (info.wrap.w > maxMap || info.wrap.h > maxMap)) {
    throw new Error(`minimap wrap stretched to ${info.wrap.w}x${info.wrap.h}`);
  }
  const clipped = (info.hudBtns || []).filter(b => !b.inView);
  if (clipped.length) throw new Error('HUD buttons clipped: ' + JSON.stringify(clipped));
}
