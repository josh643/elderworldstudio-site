/* Tie the designer to a signed-in account site. No payment words here. */
(function () {
  'use strict';
  var siteId = new URLSearchParams(location.search).get('site');
  var entitled = false;
  function save() {
    if (!entitled || !window.EWSBuilder || !siteId) return;
    var S;
    try { S = JSON.parse(localStorage.getItem('ews-builder-draft-v2') || '{}'); } catch (e) { return; }
    fetch('/api/sites/' + encodeURIComponent(siteId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ draft: S.d || {}, spec: S.spec || null }),
    }).catch(function () {});
  }
  function addActions() {
    var host = document.getElementById('builder');
    if (!host || document.getElementById('acct-actions')) return;
    var bar = document.createElement('div');
    bar.id = 'acct-actions';
    bar.className = 'nav-btns';
    bar.innerHTML = '<a class="btn btn-ghost" id="acct-preview" href="/api/sites/' + encodeURIComponent(siteId) + '/preview" target="_blank" rel="noopener">Preview</a>' +
      '<button type="button" class="btn btn-ghost" id="acct-publish">Publish</button>' +
      '<a class="btn btn-primary" id="acct-dl" href="/api/sites/' + encodeURIComponent(siteId) + '/download">Download my site</a>';
    host.appendChild(bar);
    document.getElementById('acct-publish').addEventListener('click', function () {
      fetch('/api/sites/' + encodeURIComponent(siteId) + '/publish', { method: 'POST', credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && j.url) location.href = j.url;
          else alert((j && j.error) || 'Could not publish.');
        });
    });
  }
  fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
    if (!me || !me.ok) return;
    entitled = !!me.canEdit;
    if (!siteId && me.sites && me.sites[0]) siteId = me.sites[0].id;
    if (!siteId || !entitled) return;
    addActions();
    fetch('/api/sites/' + encodeURIComponent(siteId), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.site) return;
      try {
        var S = JSON.parse(localStorage.getItem('ews-builder-draft-v2') || '{}');
        if (j.site.draft) {
          var d = typeof j.site.draft === 'string' ? JSON.parse(j.site.draft) : j.site.draft;
          if (d && d.name) S.d = Object.assign(S.d || {}, d);
        }
        if (j.site.spec) S.spec = typeof j.site.spec === 'string' ? JSON.parse(j.site.spec) : j.site.spec;
        localStorage.setItem('ews-builder-draft-v2', JSON.stringify(S));
      } catch (e) {}
    }).catch(function () {});
    setInterval(save, 8000);
  }).catch(function () {});
})();
