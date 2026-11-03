/* Paid CTAs on /build/. No-ops unless /api/shop-config says livePayments. Static page stays reservation-only. */
(function () {
  'use strict';
  var PLAN = { Starter: 'starter', Business: 'business', Plus: 'plus', 'Take it': 'take_it' };
  function pickPlan(label) {
    if (PLAN[label]) return PLAN[label];
    var k = Object.keys(PLAN).find(function (p) { return label.indexOf(p) === 0; });
    return k ? PLAN[k] : '';
  }
  function statusEl() {
    var s = document.getElementById('form-status');
    if (!s) return null;
    s.hidden = false;
    return s;
  }
  function startPay(plan) {
    var email = '';
    var form = document.getElementById('build-form');
    if (form && form.email) email = form.email.value.trim();
    if (!email) {
      var ask = window.prompt('Email for this order');
      email = (ask || '').trim();
    }
    if (!email) return;
    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ plan: plan, email: email }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok && j.url) { location.href = j.url; return; }
      var s = statusEl();
      if (s) s.textContent = (j && j.error === 'payments-off')
        ? 'Online payment is not on yet. Reserve your spot below.'
        : ((j && j.error) || 'Could not start that order.') + ' You can still reserve your spot below.';
    }).catch(function () {
      var s = statusEl();
      if (s) s.textContent = 'Could not start that order. Reserve your spot below.';
    });
  }
  fetch('/api/shop-config', { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (cfg) {
    if (!cfg || !cfg.livePayments) return;
    document.querySelectorAll('[data-plan]').forEach(function (a) {
      var plan = pickPlan(a.getAttribute('data-plan') || '');
      if (!plan) return;
      a.textContent = plan === 'take_it' ? 'Take it with you · $99' : ('Start ' + a.getAttribute('data-plan'));
      a.addEventListener('click', function (e) {
        e.preventDefault();
        startPay(plan);
      });
    });
  }).catch(function () {});
})();
