// Decides whether to start the 3D office over the classic page. The classic HTML stays in the DOM
// (search engines, screen readers, no-WebGL, Save-Data, ?classic=1 or the "Classic site" button).
(function () {
  var q = new URLSearchParams(location.search);
  (function () { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/office/choice.css?v=1'; document.head.appendChild(l); })();
  /* language: ?lang= > remembered > browser. English + Spanish ship now. */
  var L = (q.get('lang') || '').slice(0, 2); try { if (L) localStorage.setItem('ews-lang', L); else L = localStorage.getItem('ews-lang') || ''; } catch (e) {}
  if (!L) L = (navigator.language || 'en').slice(0, 2); window.EWS_LANG = L === 'es' ? 'es' : 'en'; document.documentElement.lang = window.EWS_LANG;
  /* view choice (home route only; deep links and crawlers keep the classic page untouched). Kiosk (?office=1) always 3D. */
  if (/bot|crawl|spider|slurp|lighthouse-classic/i.test(navigator.userAgent)) return;
  if (q.has('classic')) { try { localStorage.setItem('ews-view', q.get('classic') === '0' ? '3d' : 'classic'); } catch (e) {} }
  var V = q.get('view'), forced = q.has('office') || V === '3d', pref = null; try { pref = localStorage.getItem('ews-view'); } catch (e) {}
  if (V === 'classic' || (q.has('classic') && q.get('classic') !== '0')) { classicLink(); return; }
  if (!forced && pref === 'classic') { classicLink(); return; }
  var weak = (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) || !(function () { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })() || matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData);
  function classicLink() { var go3 = function () { var a = document.createElement('a'); a.href = '/?view=3d'; a.className = 'ews-switch'; a.textContent = window.EWS_LANG === 'es' ? 'Cambiar a 3D' : 'Switch to 3D';
      a.onclick = function () { try { localStorage.removeItem('ews-view'); } catch (e) {} }; document.body.appendChild(a); };
    if (document.body) go3(); else addEventListener('DOMContentLoaded', go3); }
  var T = { en: { h: 'How would you like to visit?', d3: '3D Office', d3s: 'Walk our studio, meet Freyja, watch the AI team work live', cl: 'Classic Site', cls: 'Fast, simple pages', rec: 'Recommended for this device', rem: 'Remember my choice', lang: 'Language' },
            es: { h: '¿Cómo quieres visitarnos?', d3: 'Oficina 3D', d3s: 'Recorre el estudio, conoce a Freyja y mira al equipo de IA trabajar en vivo', cl: 'Sitio clásico', cls: 'Páginas rápidas y sencillas', rec: 'Recomendado para este dispositivo', rem: 'Recordar mi elección', lang: 'Idioma' } };
  function choice() {
    var t = T[window.EWS_LANG], o = document.createElement('div'); o.className = 'ews-choice'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'ews-ch-h');
    o.innerHTML = '<div class="box"><img src="/assets/img/logo-gold.png" alt="Elder World Studio" width="88" height="88"><h2 id="ews-ch-h">' + t.h + '</h2><div class="opts">' +
      '<button type="button" class="opt" data-v="3d"><b>' + t.d3 + '</b><span>' + t.d3s + '</span>' + (weak ? '' : '<em>' + t.rec + '</em>') + '</button>' +
      '<button type="button" class="opt" data-v="classic"><b>' + t.cl + '</b><span>' + t.cls + '</span>' + (weak ? '<em>' + t.rec + '</em>' : '') + '</button></div>' +
      '<label class="rem"><input type="checkbox"> ' + t.rem + '</label><label class="lang">' + t.lang + ' <select><option value="en">English</option><option value="es">Español</option></select></label></div>';
    var sel = o.querySelector('select'); sel.value = window.EWS_LANG;
    sel.onchange = function () { try { localStorage.setItem('ews-lang', sel.value); } catch (e) {} window.EWS_LANG = sel.value; o.remove(); choice(); };
    [].forEach.call(o.querySelectorAll('.opt'), function (b) { b.onclick = function () { var v = b.getAttribute('data-v'); if (o.querySelector('.rem input').checked) { try { localStorage.setItem('ews-view', v); } catch (e) {} }
      o.remove(); document.documentElement.classList.remove('ews-choosing'); if (v === '3d') { forced = true; document.documentElement.classList.add('office-pending'); go(); } else classicLink(); }; });
    document.documentElement.classList.add('ews-choosing'); document.body.appendChild(o); o.querySelector(weak ? '[data-v=classic]' : '[data-v=3d]').focus();
  }
  var go = function () {
  try { var c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return false;
    var ext = gl.getExtension('WEBGL_debug_renderer_info'), rn = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(rn) && !forced) return false;   // no real GPU: classic site
  } catch (e) { return false; }

 import('/office/office.js?v=25').then(function (m) { m.start({ overlay: true }); }).catch(function (e) { console.warn('office failed, classic site stays', e); }); };
  if (!forced && pref !== '3d') { if (document.body) choice(); else addEventListener('DOMContentLoaded', choice); return; }
  var later = function () { setTimeout(function () { (window.requestIdleCallback || setTimeout)(go, { timeout: 1500 }); }, forced ? 0 : 400); };
  document.documentElement.classList.add('office-pending');
  if (document.readyState === 'complete') later(); else addEventListener('load', later);
})();
