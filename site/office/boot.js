// Decides whether to start the 3D office over the classic page. The classic HTML stays in the DOM
// (search engines, screen readers, no-WebGL, Save-Data, ?classic=1 or the "Classic site" button).
(function () {
  var q = new URLSearchParams(location.search);
  if (q.has('classic')) { try { localStorage.setItem('ews-classic', q.get('classic') === '0' ? '0' : '1'); } catch (e) {} }
  var pref = null; try { pref = localStorage.getItem('ews-classic'); } catch (e) {}
  if (pref === '1' && !q.has('office')) return;
  if (navigator.connection && navigator.connection.saveData && !q.has('office')) return;
  if (/bot|crawl|spider|lighthouse-classic/i.test(navigator.userAgent)) return;
  if ((navigator.deviceMemory && navigator.deviceMemory < 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 3)) { if (!q.has('office')) return; }
  try { var c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return; } catch (e) { return; }
  var go = function () { import('/office/office.js?v=3').then(function (m) { m.start({ overlay: true }); }).catch(function (e) { console.warn('office failed, classic site stays', e); }); };
  var later = function () { (window.requestIdleCallback || setTimeout)(go, { timeout: 1500 }); };
  document.documentElement.classList.add('office-pending');
  if (document.readyState === 'complete') later(); else addEventListener('load', later);
})();
