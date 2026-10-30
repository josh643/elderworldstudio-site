/* Elder World Studio website builder (web version of the kiosk "Custom Website" flow).
   Pure render/state helpers live on window.EWSBuilder so tests can call them. No payments, no domain purchases. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TYPES = {
    bakery:   { label: 'Bakery or café', icon: '🥐', tagline: 'Fresh from the oven every morning', items: [['Country sourdough', 'Slow-rise, crackly crust'], ['Butter croissants', 'Flaky, baked daily'], ['Celebration cakes', 'Order 48 hours ahead']], menuWord: 'Menu' },
    restaurant:{ label: 'Restaurant', icon: '🍽️', tagline: 'Good food, good company', items: [['Lunch specials', 'Weekdays 11–2'], ['Family dinners', 'Feeds four'], ['Catering', 'Parties and offices']], menuWord: 'Menu' },
    salon:    { label: 'Barber or salon', icon: '💈', tagline: 'Look sharp, feel great', items: [['Classic cut', 'Clippers and scissors'], ['Beard trim', 'Hot towel finish'], ['Color & style', 'By appointment']], menuWord: 'Services' },
    retail:   { label: 'Retail shop', icon: '🛍️', tagline: 'Find something you love', items: [['New arrivals', 'Fresh every week'], ['Local makers', 'Made in Memphis'], ['Gift cards', 'Any amount']], menuWord: 'Shop' },
    auto:     { label: 'Auto or repair', icon: '🔧', tagline: 'Honest work, fair prices', items: [['Oil change', 'In and out fast'], ['Brakes & tires', 'Free inspection'], ['Diagnostics', 'Check-engine light']], menuWord: 'Services' },
    pro:      { label: 'Home or pro services', icon: '🧰', tagline: 'Done right the first time', items: [['Free estimates', 'Same-week visits'], ['Licensed & insured', 'Peace of mind'], ['Satisfaction promise', 'We make it right']], menuWord: 'Services' },
    other:    { label: 'Something else', icon: '✨', tagline: 'Welcome — we’re glad you’re here', items: [['What we do', 'Tell visitors here'], ['Why us', 'What makes you different'], ['Get in touch', 'Call, email or visit']], menuWord: 'Services' }
  };
  var STYLES = {
    rustic: { label: 'Warm & rustic', font: 'Georgia, "Times New Roman", serif', bg: '#fbf6ef', ink: '#3a2418', head: '#f3e3cc', headInk: '#4a2c1d', accent: '#c0662b', hero: 'linear-gradient(135deg,#d99a5b,#7a4524)', radius: 10 },
    minimal:{ label: 'Modern minimal', font: 'Inter, "Helvetica Neue", Arial, sans-serif', bg: '#ffffff', ink: '#1d1d22', head: '#ffffff', headInk: '#1d1d22', accent: '#2f6df6', hero: 'linear-gradient(135deg,#e9eef8,#c9d6ee)', radius: 4 },
    bold:   { label: 'Bold & bright', font: '"Trebuchet MS", Arial, sans-serif', bg: '#fff9f0', ink: '#1a1033', head: '#1a1033', headInk: '#ffffff', accent: '#ff2bd6', hero: 'linear-gradient(135deg,#8b5cf6,#ff2bd6)', radius: 18 }
  };
  var PAGES = ['Home', 'Menu', 'About', 'Contact', 'Gallery'];
  var CHANGES = {
    darker: { label: 'Darker header', apply: function (s) { s.mods.darkHeader = true; } },
    lighter:{ label: 'Lighter header', apply: function (s) { s.mods.darkHeader = false; } },
    bigger: { label: 'Bigger headline', apply: function (s) { s.mods.bigHead = true; } },
    round:  { label: 'Rounder buttons', apply: function (s) { s.mods.round = true; } },
    square: { label: 'Square buttons', apply: function (s) { s.mods.round = false; } }
  };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function blank() { return { type: 'bakery', style: 'rustic', name: '', tagline: '', phone: '', address: '', hours: '', pages: ['Home', 'Menu', 'About', 'Contact'], accent: '', mods: {} }; }
  function pageLabel(d, p) { return p === 'Menu' ? (TYPES[d.type] || TYPES.other).menuWord : p; }

  /* Render a draft page to a complete static HTML document (shown in a sandboxed, script-less iframe). */
  function render(d, page) {
    var t = TYPES[d.type] || TYPES.other, st = STYLES[d.style] || STYLES.rustic, m = d.mods || {};
    var accent = /^#[0-9a-f]{6}$/i.test(d.accent || '') ? d.accent : st.accent;
    var head = m.darkHeader ? '#1f140f' : st.head, headInk = m.darkHeader ? '#f8ead7' : st.headInk;
    var rad = m.round ? 40 : st.radius, name = esc(d.name || 'Your Business'), tag = esc(d.tagline || t.tagline);
    var pages = d.pages && d.pages.length ? d.pages : ['Home'];
    if (pages.indexOf(page) < 0) page = pages[0];
    var nav = pages.map(function (p) { return '<span class="n' + (p === page ? ' on' : '') + '">' + esc(pageLabel(d, p)) + '</span>'; }).join('');
    var btn = '<span class="b">' + (d.type === 'salon' || d.type === 'pro' || d.type === 'auto' ? 'Book now' : 'Visit us') + '</span>';
    var cards = t.items.map(function (i) { return '<div class="c"><b>' + esc(i[0]) + '</b><small>' + esc(i[1]) + '</small></div>'; }).join('');
    var body;
    if (page === 'Home') body = '<section class="hero"><h1>' + name + '</h1><p>' + tag + '</p>' + btn + '</section><section class="cards">' + cards + '</section>';
    else if (page === 'Menu') body = '<section class="pad"><h2>' + esc(pageLabel(d, 'Menu')) + '</h2>' + t.items.map(function (i, k) { return '<div class="row"><span><b>' + esc(i[0]) + '</b><br><small>' + esc(i[1]) + '</small></span><span class="pr">$' + (8 + k * 6) + '</span></div>'; }).join('') + '<p class="note">Sample items. You’ll give us your real list.</p></section>';
    else if (page === 'About') body = '<section class="pad split"><div class="ph">' + t.icon + '</div><div><h2>About ' + name + '</h2><p>' + name + ' is a ' + esc(t.label.toLowerCase()) + ' serving our neighbors. This is where your story goes: how you started, what you care about and why customers come back.</p></div></section>';
    else if (page === 'Contact') body = '<section class="pad"><h2>Visit or call</h2><p><b>Phone:</b> ' + esc(d.phone || '(901) 555-0100') + '</p><p><b>Address:</b> ' + esc(d.address || 'Memphis, TN') + '</p><p><b>Hours:</b> ' + esc(d.hours || 'Mon–Sat 8am–6pm') + '</p>' + btn + '</section>';
    else body = '<section class="pad"><h2>Gallery</h2><div class="gal">' + [1, 2, 3, 4, 5, 6].map(function () { return '<div class="g"></div>'; }).join('') + '</div><p class="note">Your photos go here.</p></section>';
    var css = '*{box-sizing:border-box;margin:0}body{font-family:' + st.font + ';background:' + st.bg + ';color:' + st.ink + '}' +
      'header{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:16px 22px;background:' + head + ';color:' + headInk + '}' +
      'header .logo{font-weight:700;font-size:22px;margin-right:auto}.n{font-size:15px;padding-bottom:3px}.n.on{color:' + accent + ';border-bottom:3px solid ' + accent + '}' +
      '.hero{padding:64px 24px;background:' + st.hero + ';color:#fff;text-align:center}.hero h1{font-size:' + (m.bigHead ? 'clamp(40px,8vw,72px)' : 'clamp(30px,6vw,52px)') + ';line-height:1.05}.hero p{margin:12px 0 22px;font-size:18px;opacity:.95}' +
      '.b{display:inline-block;background:' + accent + ';color:#fff;padding:12px 26px;border-radius:' + rad + 'px;font-weight:700}' +
      '.c b{display:block}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;padding:26px 22px}.c{background:rgba(0,0,0,.04);border-radius:' + st.radius + 'px;padding:18px}.c small,.row small{opacity:.7}' +
      '.pad{padding:34px 24px}.pad h2{font-size:30px;margin-bottom:16px}.pad p{margin-bottom:10px;line-height:1.5}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(0,0,0,.1)}.pr{color:' + accent + ';font-weight:700}' +
      '.note{opacity:.6;font-size:13px;margin-top:14px}.split{display:flex;gap:24px;flex-wrap:wrap}.split>div:last-child{flex:1;min-width:220px}.ph{width:180px;height:180px;border-radius:' + st.radius + 'px;background:' + st.hero + ';display:flex;align-items:center;justify-content:center;font-size:64px}' +
      '.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.g{aspect-ratio:1;border-radius:' + st.radius + 'px;background:' + st.hero + ';opacity:.8}' +
      'footer{padding:18px;text-align:center;font-size:12px;opacity:.6}';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><header><span class="logo">' + t.icon + ' ' + name + '</span>' + nav + '</header>' + body + '<footer>Draft by Elder World Studio · not published</footer></body></html>';
  }

  function validLead(f) {
    var e = [];
    if (!String(f.name || '').trim()) e.push('name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(f.email || '').trim())) e.push('email');
    if (!String(f.business || '').trim()) e.push('business');
    var dom = String(f.domain || '').trim().toLowerCase();
    if (dom && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(dom) && !/^[a-z0-9-]+$/.test(dom)) e.push('domain');
    return e;
  }
  function suggestDomain(name) { var s = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ''); return s ? s.slice(0, 40) + '.com' : ''; }

  window.EWSBuilder = { TYPES: TYPES, STYLES: STYLES, PAGES: PAGES, CHANGES: CHANGES, blank: blank, render: render, validLead: validLead, suggestDomain: suggestDomain, esc: esc };

  /* ---------------- UI ---------------- */
  var root = document.getElementById('builder'); if (!root) return;
  var KEY = 'ews-builder-draft-v1';
  var S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.d) S = { step: 0, d: blank(), revs: [], page: 'Home', device: 'desktop' };
  var $ = function (q) { return root.querySelector(q); };
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  /* Final pricing, approved by Joshua 2026-10-29. Leads only, nothing is charged online. */
  var PRICING = [['Starter', '$349 one-time + $19/mo care', 'Up to 3 pages from your draft, hosting, SSL, 1 small edit a month'],
    ['Business', '$699 one-time + $39/mo care', 'Up to 6 pages, your photos and copy polish, Google Business setup, 2 edits a month'],
    ['Plus', '$1,299 one-time + $69/mo care', 'Up to 10 pages, booking or online ordering hookup, priority edits'],
    ['Domain', 'Registrar cost + $2/yr', 'e.g. a .com is about $13/yr, in your name'],
    ['Launch offer', 'Starter $249 one-time + $19/mo care', 'For the first 10 Memphis shops']];
  var SHOW_PRICING = true;
  var STEPS = ['Business type', 'Style', 'Details', 'Preview', 'Get it built'];

  function chip(group, val, label, on, extra) { return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-' + group + '="' + esc(val) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (extra || '') + '>' + label + '</button>'; }
  function draw() {
    var d = S.d, h = '';
    $('#steps').innerHTML = STEPS.map(function (s, i) { return '<li class="' + (i === S.step ? 'on' : i < S.step ? 'done' : '') + '"><span>' + (i + 1) + '</span>' + s + '</li>'; }).join('');
    if (S.step === 0) h = '<h2>What kind of business is it?</h2><div class="tiles">' + Object.keys(TYPES).map(function (k) { return '<button type="button" class="tile' + (d.type === k ? ' on' : '') + '" data-type="' + k + '"><span>' + TYPES[k].icon + '</span>' + esc(TYPES[k].label) + '</button>'; }).join('') + '</div>';
    if (S.step === 1) h = '<h2>Pick a style</h2><div class="tiles">' + Object.keys(STYLES).map(function (k) { var s = STYLES[k]; return '<button type="button" class="tile sty' + (d.style === k ? ' on' : '') + '" data-style="' + k + '"><i style="background:' + s.hero + '"></i>' + s.label + '</button>'; }).join('') + '</div><h3>Which pages do you need?</h3><div>' + PAGES.map(function (p) { return chip('page', p, esc(pageLabel(d, p)), d.pages.indexOf(p) >= 0); }).join('') + '</div>';
    if (S.step === 2) h = '<h2>Tell us about your business</h2><div class="form">' +
      '<label>Business name *<input id="f-name" maxlength="80" value="' + esc(d.name) + '" placeholder="Bluff City Bakery" autocomplete="organization"></label>' +
      '<label>Tagline<input id="f-tagline" maxlength="120" value="' + esc(d.tagline) + '" placeholder="' + esc(TYPES[d.type].tagline) + '"></label>' +
      '<label>Phone<input id="f-phone" maxlength="40" value="' + esc(d.phone) + '" placeholder="(901) 555-0100" autocomplete="tel"></label>' +
      '<label>Address or area<input id="f-address" maxlength="120" value="' + esc(d.address) + '" placeholder="Memphis, TN"></label>' +
      '<label>Hours<input id="f-hours" maxlength="80" value="' + esc(d.hours) + '" placeholder="Mon–Sat 8am–6pm"></label></div><p class="err" id="err" hidden>Please add your business name.</p>';
    if (S.step === 3) h = '<h2>Your live draft</h2><p class="muted">Tap the pages to look around, then ask for changes. Every change is saved as a new revision.</p>' +
      '<h3>Ask for a change</h3><div>' + Object.keys(CHANGES).map(function (k) { return chip('change', k, CHANGES[k].label, false); }).join('') + '</div>' +
      '<label class="inline">Accent color <input type="color" id="f-accent" value="' + (d.accent || (STYLES[d.style] || STYLES.rustic).accent) + '"></label>' +
      '<h3>Revisions</h3><ol class="revs" id="revs">' + ['v1 · First draft'].concat(S.revs.map(function (r, i) { return 'v' + (i + 2) + ' · ' + esc(r.label); })).map(function (r, i) { return '<li' + (i === S.revs.length ? ' class="on"' : '') + '>' + r + '</li>'; }).join('') + '</ol>' +
      (S.revs.length ? '<button type="button" class="ghost sm" id="undo">Undo last change</button>' : '');
    if (S.step === 4) h = S.sent ? '<h2>Thanks, we’ve got it ✅</h2><p>Your request <b class="mono" id="lead-id">' + esc(S.sent) + '</b> is saved with your draft. Someone from Elder World Studio will reach out about your site and domain. Nothing has been charged.</p><button type="button" class="ghost" id="restart">Start another design</button>' :
      '<h2>Get it built</h2><p class="muted">We’ll turn this draft into a real site: your photos and copy, mobile-ready, and on your own domain. We confirm a quote first and nothing is charged here.</p>' +
      (SHOW_PRICING ? '<div class="panel" id="pricing"><b>Pricing</b>' + PRICING.map(function (r) { return '<p><b>' + r[0] + ':</b> ' + r[1] + '<br><small>' + r[2] + '</small></p>'; }).join('') + '</div>' : '') +
      '<form id="claim" class="form" novalidate><input type="text" name="website_url" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label>Your name *<input name="name" required maxlength="100" autocomplete="name"></label>' +
      '<label>Email *<input name="email" type="email" required maxlength="200" autocomplete="email"></label>' +
      '<label>Phone (optional)<input name="phone" type="tel" maxlength="40" autocomplete="tel" value="' + esc(d.phone) + '"></label>' +
      '<label>Business name *<input name="business" required maxlength="150" value="' + esc(d.name) + '"></label>' +
      '<label>Domain you want<input name="domain" maxlength="80" value="' + esc(suggestDomain(d.name)) + '" placeholder="yourbusiness.com"></label>' +
      '<label>Anything else?<textarea name="notes" rows="3" maxlength="2000" placeholder="Already have a domain? Want online ordering?"></textarea></label>' +
      '<p class="err" id="err" hidden></p><button class="btn btn-primary" type="submit" id="send">Request my site</button>' +
      '<p class="fine">By sending, you agree we can contact you about this request. See our <a class="link" href="../privacy-policy/index.html">Privacy Policy</a>.</p></form>';
    $('#panel').innerHTML = h;
    $('#back').hidden = S.step === 0 || !!S.sent; $('#next').hidden = S.step >= 4;
    $('#next').textContent = S.step === 3 ? 'I like it, get it built →' : 'Next →';
    var tabs = d.pages.length ? d.pages : ['Home']; if (tabs.indexOf(S.page) < 0) S.page = tabs[0];
    $('#tabs').innerHTML = tabs.map(function (p) { return '<button type="button" class="tab' + (p === S.page ? ' on' : '') + '" data-tab="' + p + '">' + esc(pageLabel(d, p)) + '</button>'; }).join('');
    $('#frame-wrap').className = 'frame ' + S.device;
    root.querySelectorAll('[data-device]').forEach(function (b) { b.classList.toggle('on', b.dataset.device === S.device); });
    $('#url').textContent = (suggestDomain(d.name) || 'yourbusiness.com') + (S.page === 'Home' ? '' : '/' + S.page.toLowerCase());
    $('#preview').srcdoc = render(d, S.page);
    $('#rev-badge').textContent = 'v' + (S.revs.length + 1);
    save();
  }
  function readDetails() { ['name', 'tagline', 'phone', 'address', 'hours'].forEach(function (k) { var el = $('#f-' + k); if (el) S.d[k] = el.value.trim(); }); }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.type) { S.d.type = b.dataset.type; }
    else if (b.dataset.style) { S.d.style = b.dataset.style; S.d.accent = ''; }
    else if (b.dataset.page) { var i = S.d.pages.indexOf(b.dataset.page); if (i >= 0) { if (S.d.pages.length > 1) S.d.pages.splice(i, 1); } else S.d.pages = PAGES.filter(function (p) { return p === b.dataset.page || S.d.pages.indexOf(p) >= 0; }); }
    else if (b.dataset.tab) { S.page = b.dataset.tab; }
    else if (b.dataset.device) { S.device = b.dataset.device; }
    else if (b.dataset.change) { S.revs.push({ label: CHANGES[b.dataset.change].label, before: clone(S.d) }); CHANGES[b.dataset.change].apply(S.d); }
    else if (b.id === 'undo') { var r = S.revs.pop(); if (r) S.d = r.before; }
    else if (b.id === 'next') { if (S.step === 2) { readDetails(); if (!S.d.name) { $('#err').hidden = false; $('#f-name').focus(); return; } } S.step = Math.min(4, S.step + 1); window.scrollTo(0, root.offsetTop - 70); }
    else if (b.id === 'back') { if (S.step === 2) readDetails(); S.step = Math.max(0, S.step - 1); }
    else if (b.id === 'restart') { S = { step: 0, d: blank(), revs: [], page: 'Home', device: S.device }; }
    else return;
    draw();
  });
  root.addEventListener('input', function (e) {
    if (e.target.id && e.target.id.indexOf('f-') === 0 && e.target.id !== 'f-accent') { readDetails(); $('#preview').srcdoc = render(S.d, S.page); $('#url').textContent = suggestDomain(S.d.name) || 'yourbusiness.com'; save(); }
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'f-accent') { S.revs.push({ label: 'Accent color ' + e.target.value, before: clone(S.d) }); S.d.accent = e.target.value; draw(); }
  });
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'claim') return; e.preventDefault();
    var f = e.target, data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; });
    var bad = validLead(data), err = $('#err');
    if (bad.length) { err.textContent = 'Please check: ' + bad.join(', ') + '.'; err.hidden = false; return; }
    data.t = S.t0; data.draft = { type: S.d.type, style: S.d.style, name: S.d.name, tagline: S.d.tagline, phone: S.d.phone, address: S.d.address, hours: S.d.hours, pages: S.d.pages, accent: S.d.accent, mods: S.d.mods, revisions: S.revs.length + 1 };
    var btn = $('#send'); btn.disabled = true; btn.textContent = 'Sending…';
    fetch('/api/build-lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Could not send right now.'); S.sent = j.id; draw(); })
      .catch(function (x) { err.textContent = x.message + ' You can also email annaews@agentmail.to.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Request my site'; });
  });
  S.t0 = S.t0 || Date.now(); S.sent = S.step === 4 ? S.sent : null;
  draw();
})();
