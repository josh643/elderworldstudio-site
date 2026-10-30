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

  /* ---- AI site spec renderer. spec comes from /api/build-ai (already validated + sanitized server-side); everything is escaped again here. ---- */
  var FONTSTACK = { playfair: '"Playfair Display", Georgia, "Times New Roman", serif', fraunces: 'Fraunces, Georgia, serif', bebas: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
    oswald: 'Oswald, "Arial Narrow", Impact, sans-serif', poppins: 'Poppins, "Segoe UI", Arial, sans-serif', inter: 'Inter, "Helvetica Neue", Arial, sans-serif', lora: 'Lora, Georgia, serif',
    dmserif: '"DM Serif Display", Georgia, serif', archivo: '"Archivo Black", "Arial Black", sans-serif', pacifico: 'Pacifico, "Brush Script MT", cursive', space: '"Space Grotesk", "Courier New", monospace',
    nunito: 'Nunito, "Trebuchet MS", Arial, sans-serif', cormorant: '"Cormorant Garamond", Garamond, Georgia, serif', worksans: '"Work Sans", Verdana, Arial, sans-serif' };
  var PAGE_KINDS = { Menu: ['services', 'menu'], About: ['about', 'story', 'testimonials', 'stats'], Contact: ['map', 'hours', 'booking', 'faq'], Gallery: ['gallery'] };
  var okImg = function (u) { return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(String(u || '')) ? u : ''; };
  function renderSpec(sp, d, page, img) {
    img = img || {}; var P = sp.palette, r = sp.radius, photo = okImg(img.photo), logo = okImg(img.logo);
    var name = esc(d.name || 'Your Business'), hf = FONTSTACK[sp.fonts.head] || FONTSTACK.inter, bf = FONTSTACK[sp.fonts.body] || FONTSTACK.inter;
    var pages = ['Home'].concat((d.pages || []).filter(function (p) { return p !== 'Home'; }));
    if (pages.indexOf(page) < 0) page = 'Home';
    var nav = pages.map(function (p) { return '<span class="n' + (p === page ? ' on' : '') + '">' + esc(p === 'Menu' ? ((sp.sections.filter(function (s) { return s.kind === 'menu' || s.kind === 'services'; })[0] || {}).title || 'Menu') : p) + '</span>'; }).join('');
    var cta = '<span class="b">' + esc(sp.cta.label) + '</span>';
    var art = photo ? 'url(' + photo + ') center/cover' : 'linear-gradient(135deg,' + P.accent + ',' + P.accent2 + ')';
    var heroes = {
      split: '<section class="hero split"><div><h1>' + esc(sp.headline) + '</h1><p>' + esc(sp.subhead) + '</p>' + cta + '</div><div class="art" role="img" aria-label="' + esc(sp.imagery) + '"></div></section>',
      center: '<section class="hero center"><h1>' + esc(sp.headline) + '</h1><p>' + esc(sp.subhead) + '</p>' + cta + '</section>',
      full: '<section class="hero full"><div class="veil"><h1>' + esc(sp.headline) + '</h1><p>' + esc(sp.subhead) + '</p>' + cta + '</div></section>',
      minimal: '<section class="hero minimal"><p class="kick">' + name + '</p><h1>' + esc(sp.headline) + '</h1><p>' + esc(sp.subhead) + '</p>' + cta + '</section>',
      banner: '<section class="hero banner"><div class="strip"></div><h1>' + esc(sp.headline) + '</h1><p>' + esc(sp.subhead) + '</p>' + cta + '</section>' };
    function items(s) { return s.items.map(function (i) { return '<div class="it"><b>' + esc(i.name) + '</b>' + (i.price ? '<span class="pr">' + esc(i.price) + '</span>' : '') + '<small>' + esc(i.text) + '</small></div>'; }).join(''); }
    function sec(s) {
      var h = '<h2>' + esc(s.title) + '</h2>' + (s.intro ? '<p class="intro">' + esc(s.intro) + '</p>' : ''), k = s.kind, v = s.variant;
      if (k === 'services' || k === 'menu') return '<section class="s ' + k + ' v-' + v + '">' + h + '<div class="items">' + items(s) + '</div></section>';
      if (k === 'gallery') return '<section class="s gallery v-' + v + '">' + h + '<div class="gal">' + [0, 1, 2, 3, 4, 5].map(function (n) { return '<div class="g g' + n + '"></div>'; }).join('') + '</div><p class="note">' + esc(sp.imagery) + '</p></section>';
      if (k === 'testimonials') return '<section class="s quotes">' + h + '<div class="items">' + s.items.map(function (i) { return '<blockquote>“' + esc(i.text) + '”<cite>' + esc(i.name) + '</cite></blockquote>'; }).join('') + '</div></section>';
      if (k === 'about' || k === 'story') return '<section class="s about"><div class="ph"></div><div>' + h + '<p>' + esc(s.intro ? '' : sp.about) + '</p>' + items(s) + '</div></section>';
      if (k === 'stats') return '<section class="s stats">' + h + '<div class="items">' + s.items.map(function (i) { return '<div class="it"><b class="big">' + esc(i.name) + '</b><small>' + esc(i.text) + '</small></div>'; }).join('') + '</div></section>';
      if (k === 'map') return '<section class="s map">' + h + '<div class="mapbox"><span>📍 ' + esc(d.address || 'Memphis, TN') + '</span></div></section>';
      if (k === 'hours') return '<section class="s hours">' + h + '<p><b>' + esc(d.hours || 'Mon–Sat 8am–6pm') + '</b></p>' + items(s) + '</section>';
      if (k === 'booking') return '<section class="s booking">' + h + '<p>' + esc(sp.cta.note || 'Call ' + (d.phone || '(901) 555-0100')) + '</p>' + cta + '</section>';
      if (k === 'faq') return '<section class="s faq">' + h + s.items.map(function (i) { return '<details open><summary>' + esc(i.name) + '</summary><p>' + esc(i.text) + '</p></details>'; }).join('') + '</section>';
      return '';
    }
    var list = page === 'Home' ? sp.sections : sp.sections.filter(function (s) { return (PAGE_KINDS[page] || []).indexOf(s.kind) >= 0; });
    if (page === 'About' && !list.length) list = [{ kind: 'about', title: 'About ' + (d.name || 'us'), intro: '', items: [] }];
    if (page === 'Contact' && !list.length) list = [{ kind: 'booking', title: 'Visit or call', intro: '', items: [] }, { kind: 'map', title: 'Find us', intro: '', items: [] }];
    var body = (page === 'Home' ? heroes[sp.hero] || heroes.center : '') + list.map(sec).join('');
    var dark = function (h) { var n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140; };
    var onA = dark(P.accent) ? '#fff' : '#111';
    var css = '*{box-sizing:border-box;margin:0}body{font-family:' + bf + ';background:' + P.bg + ';color:' + P.ink + ';line-height:1.5}h1,h2,.logo,.big{font-family:' + hf + '}' +
      'header{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:14px 22px;background:' + P.surface + '}header .logo{font-weight:700;font-size:22px;margin-right:auto;display:flex;align-items:center;gap:10px}header .logo img{height:36px;width:auto;border-radius:6px}' +
      '.n{font-size:15px;padding-bottom:3px}.n.on{border-bottom:3px solid ' + P.accent + '}.b{display:inline-block;background:' + P.accent + ';color:' + onA + ';padding:12px 26px;border-radius:' + r + 'px;font-weight:700}' +
      '.hero{padding:64px 24px}.hero h1{font-size:clamp(30px,6vw,56px);line-height:1.05}.hero p{margin:12px 0 22px;font-size:18px;opacity:.9;max-width:640px}' +
      '.center{text-align:center}.center p{margin-left:auto;margin-right:auto}.split{display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:center}.split .art{min-height:300px;border-radius:' + r + 'px;background:' + art + '}' +
      '.full{background:' + art + ';padding:0}.full .veil{background:linear-gradient(0deg,rgba(0,0,0,.65),rgba(0,0,0,.15));color:#fff;padding:120px 26px 56px}' +
      '.minimal{padding:90px 26px 50px;border-bottom:1px solid ' + P.accent + '}.minimal .kick{letter-spacing:.3em;text-transform:uppercase;font-size:13px;color:' + P.accent + '}' +
      '.banner{background:' + P.accent2 + ';color:' + (dark(P.accent2) ? '#fff' : '#111') + '}.banner .strip{height:10px;width:120px;background:' + P.accent + ';margin-bottom:18px}' +
      '.s{padding:40px 24px}.s h2{font-size:30px;margin-bottom:10px}.intro{opacity:.8;margin-bottom:16px;max-width:680px}.s:nth-of-type(even){background:' + P.surface + '}' +
      '.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.it{background:' + P.bg + ';border:1px solid rgba(127,127,127,.25);border-radius:' + r + 'px;padding:16px}.it b{display:block}.it small{opacity:.75}.pr{color:' + P.accent + ';font-weight:700;float:right}' +
      '.v-list .items{display:block}.v-list .it{border:0;border-bottom:1px dashed rgba(127,127,127,.4);border-radius:0;background:none}.v-columns .items{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.v-band .it{background:' + P.accent + ';color:' + onA + '}' +
      '.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.v-strip .gal{grid-auto-flow:column;grid-template-columns:none;overflow:hidden}.g{aspect-ratio:1;border-radius:' + r + 'px;background:' + art + '}' +
      '.g1{filter:hue-rotate(25deg)}.g2{filter:saturate(.6)}.g3{filter:brightness(1.15)}.g4{filter:hue-rotate(-25deg)}.g5{filter:contrast(1.2)}' +
      'blockquote{background:' + P.bg + ';border-left:4px solid ' + P.accent + ';padding:14px 16px;border-radius:' + r + 'px;font-style:italic}cite{display:block;margin-top:8px;font-style:normal;font-weight:700;font-size:14px}' +
      '.about{display:flex;gap:24px;flex-wrap:wrap}.about>div:last-child{flex:1;min-width:220px}.about .ph{width:200px;height:200px;border-radius:' + r + 'px;background:' + art + '}' +
      '.big{font-size:38px;color:' + P.accent + '}.mapbox{height:180px;border-radius:' + r + 'px;background:repeating-linear-gradient(45deg,' + P.surface + ' 0 14px,' + P.bg + ' 14px 28px);display:flex;align-items:center;justify-content:center;font-weight:700}' +
      '.booking{text-align:center;background:' + P.accent2 + '!important;color:' + (dark(P.accent2) ? '#fff' : '#111') + '}.booking p{margin-bottom:16px}details{padding:10px 0;border-bottom:1px solid rgba(127,127,127,.3)}summary{font-weight:700}' +
      '.note{opacity:.6;font-size:13px;margin-top:12px}footer{padding:18px;text-align:center;font-size:12px;opacity:.6}@media(max-width:640px){.split{grid-template-columns:1fr}.full .veil{padding-top:80px}}';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><header><span class="logo">' + (logo ? '<img src="' + logo + '" alt="">' : '') + name + '</span>' + nav + '</header>' + body + '<footer>Draft by Elder World Studio · not published</footer></body></html>';
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

  window.EWSBuilder = { TYPES: TYPES, STYLES: STYLES, PAGES: PAGES, CHANGES: CHANGES, blank: blank, render: render, renderSpec: renderSpec, validLead: validLead, suggestDomain: suggestDomain, esc: esc };

  /* ---------------- UI ---------------- */
  var root = document.getElementById('builder'); if (!root) return;
  var KEY = 'ews-builder-draft-v2', IMGKEY = 'ews-builder-img-v1';
  var S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.d) S = { step: 0, d: blank(), revs: [], page: 'Home', device: 'desktop' };
  var IMG = {}; try { IMG = JSON.parse(localStorage.getItem(IMGKEY)) || {}; } catch (e) {}
  if (!S.sid) S.sid = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  var VIBES = ['Upscale', 'Playful', 'Classic', 'Modern', 'Cozy', 'Bold', 'Old-school', 'Family-friendly'];
  var busy = false;
  var $ = function (q) { return root.querySelector(q); };
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem(IMGKEY, JSON.stringify(IMG)); } catch (e) {} };
  function aiInput(seed) { var d = S.d; return { name: d.name, type: d.type, style: d.style, story: d.story || '', vibe: (d.vibes || []).join(', '), tagline: d.tagline, phone: d.phone, address: d.address, hours: d.hours, hasLogo: !!IMG.logo, hasPhoto: !!IMG.photo, seed: seed || 0 }; }
  function ai(body) { body.input = aiInput(body.seed); body.session = S.sid; body.consent = !!S.d.consent; body.nameConsent = !!S.d.nameConsent;
    return fetch('/api/build-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }); }
  function design(action, req) {
    if (busy) return; busy = true; S.msg = action === 'edit' ? 'Updating your design…' : 'Designing a site just for ' + (S.d.name || 'you') + '…'; draw();
    var seed = Math.floor(Math.random() * 99999);
    ai({ action: action, seed: seed, spec: S.spec || null, request: req || '' }).then(function (j) {
      busy = false; S.msg = '';
      if (j && j.spec) { if (S.spec) S.revs.push({ label: action === 'edit' ? 'Change: ' + req : action === 'regenerate' ? 'Fresh design' : 'New design', before: clone(S.d), spec: clone(S.spec), src: S.src }); S.spec = j.spec; S.src = j.source; if (j.source === 'fallback') S.msg = j.error || 'Our AI designer is busy, so this is a starter layout. Try Regenerate in a bit.'; }
      else S.msg = (j && j.error) || 'Could not reach the designer. Showing a starter layout.';
      draw();
    }).catch(function () { busy = false; S.msg = 'Could not reach the designer. Showing a starter layout.'; draw(); });
  }
  function shrink(file, max, cb) { if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8e6) return cb(''); var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .82)); }; im.onerror = function () { cb(''); }; im.src = fr.result; }; fr.readAsDataURL(file); }
  /* Final pricing, approved by Joshua 2026-10-29. Leads only, nothing is charged online. */
  var PRICING = [['Starter', '$349 one-time + $19/mo care', 'Up to 3 pages from your draft, hosting, SSL, 1 small edit a month'],
    ['Business', '$699 one-time + $39/mo care', 'Up to 6 pages, your photos and copy polish, Google Business setup, 2 edits a month'],
    ['Plus', '$1,299 one-time + $69/mo care', 'Up to 10 pages, booking or online ordering hookup, priority edits'],
    ['Domain', 'Registrar cost + $2/yr', 'e.g. a .com is about $13/yr, in your name'],
    ['Launch offer', 'Starter $249 one-time + $19/mo care', 'For the first 10 Memphis shops']];
  var SHOW_PRICING = true;
  var STEPS = ['Business type', 'Style', 'Details', 'Your story', 'Preview', 'Get it built'];

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
    if (S.step === 3) h = '<h2>Tell us about your business</h2><p class="muted">In your own words. Our AI designer uses this to build a layout, colors, fonts and copy that fit you, not a template.</p><div class="form">' +
      '<label>What makes you different? *<textarea id="f-story" rows="5" maxlength="1200" placeholder="e.g. Family barbershop since 1998 on Summer Ave. Old-school fades, hot towel shaves, Grizzlies on the TV.">' + esc(d.story || '') + '</textarea></label></div>' +
      '<h3>The vibe (pick any)</h3><div>' + VIBES.map(function (v) { return chip('vibe', v, esc(v), (d.vibes || []).indexOf(v) >= 0); }).join('') + '</div>' +
      '<h3>Logo or photo (optional)</h3><div class="form"><label>Logo<input type="file" id="f-logo" accept="image/png,image/jpeg,image/webp"></label><label>A photo of your shop or work<input type="file" id="f-photo" accept="image/png,image/jpeg,image/webp"></label></div>' +
      '<p class="fine">' + (IMG.logo ? '✔ Logo added. ' : '') + (IMG.photo ? '✔ Photo added. ' : '') + 'Images stay in your browser for the preview and are not uploaded until you request your site.</p>' +
      '<label class="inline"><input type="checkbox" id="f-consent"' + (d.consent ? ' checked' : '') + '> Help improve our AI designer: save an anonymous copy of this design session (no name, email or phone).</label>' +
      '<label class="inline"><input type="checkbox" id="f-nameconsent"' + (d.nameConsent ? ' checked' : '') + (d.consent ? '' : ' disabled') + '> It’s OK to keep my business name in that copy.</label>' +
      '<p class="err" id="err" hidden>Tell us a little about your business first.</p>';
    if (S.step === 4) h = '<h2>Your live draft</h2>' + (S.msg ? '<p class="muted" id="ai-msg" role="status">' + esc(S.msg) + '</p>' : '') + '<p class="muted">' + (S.src === 'ai' ? 'Designed by AI from your story. ' : '') + 'Tap the pages to look around, then ask for changes. Every change is saved as a new revision.</p>' +
      '<button type="button" class="btn btn-ghost" id="regen"' + (busy ? ' disabled' : '') + '>↻ Regenerate design</button>' +
      '<h3>Ask for a change</h3><div class="form"><label>Describe it<input id="f-ask" maxlength="300" placeholder="Make it darker, add a gallery, move reviews to the top…"></label></div><button type="button" class="btn btn-primary sm" id="ask"' + (busy ? ' disabled' : '') + '>Apply change</button>' +
      '<label class="inline">Accent color <input type="color" id="f-accent" value="' + (S.spec ? S.spec.palette.accent : (d.accent || (STYLES[d.style] || STYLES.rustic).accent)) + '"></label>' +
      '<h3>Revisions</h3><ol class="revs" id="revs">' + ['v1 · First draft'].concat(S.revs.map(function (r, i) { return 'v' + (i + 2) + ' · ' + esc(r.label); })).map(function (r, i) { return '<li' + (i === S.revs.length ? ' class="on"' : '') + '>' + r + '</li>'; }).join('') + '</ol>' +
      (S.revs.length ? '<button type="button" class="ghost sm" id="undo">Undo last change</button>' : '');
    if (S.step === 5) h = S.sent ? '<h2>Thanks, we’ve got it ✅</h2><p>Your request <b class="mono" id="lead-id">' + esc(S.sent) + '</b> is saved with your draft. Someone from Elder World Studio will reach out about your site and domain. Nothing has been charged.</p><button type="button" class="ghost" id="restart">Start another design</button>' :
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
      '<p class="fine">By sending, you agree we can contact you about this request. If you opted in, an anonymous copy of your design session (no name, email or phone) helps train our AI designer. See our <a class="link" href="../privacy-policy/index.html">Privacy Policy</a>.</p></form>';
    $('#panel').innerHTML = h;
    $('#back').hidden = S.step === 0 || !!S.sent; $('#next').hidden = S.step >= 5;
    $('#next').textContent = S.step === 4 ? 'I like it, get it built →' : 'Next →';
    var tabs = d.pages.length ? d.pages : ['Home']; if (tabs.indexOf(S.page) < 0) S.page = tabs[0];
    $('#tabs').innerHTML = tabs.map(function (p) { return '<button type="button" class="tab' + (p === S.page ? ' on' : '') + '" data-tab="' + p + '">' + esc(pageLabel(d, p)) + '</button>'; }).join('');
    $('#frame-wrap').className = 'frame ' + S.device;
    root.querySelectorAll('[data-device]').forEach(function (b) { b.classList.toggle('on', b.dataset.device === S.device); });
    $('#url').textContent = (suggestDomain(d.name) || 'yourbusiness.com') + (S.page === 'Home' ? '' : '/' + S.page.toLowerCase());
    $('#preview').srcdoc = S.spec ? renderSpec(S.spec, d, S.page, IMG) : render(d, S.page);
    $('#rev-badge').textContent = 'v' + (S.revs.length + 1);
    save();
  }
  function readStory() { var el = $('#f-story'); if (el) S.d.story = el.value.trim(); }
  function readDetails() { ['name', 'tagline', 'phone', 'address', 'hours'].forEach(function (k) { var el = $('#f-' + k); if (el) S.d[k] = el.value.trim(); }); }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.type) { S.d.type = b.dataset.type; }
    else if (b.dataset.style) { S.d.style = b.dataset.style; S.d.accent = ''; }
    else if (b.dataset.page) { var i = S.d.pages.indexOf(b.dataset.page); if (i >= 0) { if (S.d.pages.length > 1) S.d.pages.splice(i, 1); } else S.d.pages = PAGES.filter(function (p) { return p === b.dataset.page || S.d.pages.indexOf(p) >= 0; }); }
    else if (b.dataset.tab) { S.page = b.dataset.tab; }
    else if (b.dataset.device) { S.device = b.dataset.device; }
    else if (b.dataset.vibe) { readStory(); var vs = S.d.vibes = S.d.vibes || [], vi = vs.indexOf(b.dataset.vibe); if (vi >= 0) vs.splice(vi, 1); else if (vs.length < 3) vs.push(b.dataset.vibe); }
    else if (b.id === 'regen') { design('regenerate'); return; }
    else if (b.id === 'ask') { var q = ($('#f-ask').value || '').trim(); if (!q || !S.spec) return; design('edit', q); return; }
    else if (b.dataset.change) { S.revs.push({ label: CHANGES[b.dataset.change].label, before: clone(S.d) }); CHANGES[b.dataset.change].apply(S.d); }
    else if (b.id === 'undo') { var r = S.revs.pop(); if (r) { S.d = r.before; if (r.spec) { S.spec = r.spec; S.src = r.src; } S.msg = ''; } }
    else if (b.id === 'next') { if (S.step === 2) { readDetails(); if (!S.d.name) { $('#err').hidden = false; $('#f-name').focus(); return; } } if (S.step === 3) { readStory(); if (S.d.story.length < 10) { $('#err').hidden = false; $('#f-story').focus(); return; } S.step = 4; S.revs = []; S.spec = null; draw(); design('generate'); window.scrollTo(0, root.offsetTop - 70); return; } S.step = Math.min(5, S.step + 1); window.scrollTo(0, root.offsetTop - 70); }
    else if (b.id === 'back') { if (S.step === 2) readDetails(); if (S.step === 3) readStory(); S.step = Math.max(0, S.step - 1); }
    else if (b.id === 'restart') { S = { step: 0, d: blank(), revs: [], page: 'Home', device: S.device, sid: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) }; IMG = {}; }
    else return;
    draw();
  });
  root.addEventListener('input', function (e) {
    if (e.target.id && e.target.id.indexOf('f-') === 0 && e.target.id !== 'f-accent') { readDetails(); $('#preview').srcdoc = S.spec ? renderSpec(S.spec, S.d, S.page, IMG) : render(S.d, S.page); $('#url').textContent = suggestDomain(S.d.name) || 'yourbusiness.com'; save(); }
  });
  root.addEventListener('change', function (e) {
    if (e.target.id === 'f-accent') { S.revs.push({ label: 'Accent color ' + e.target.value, before: clone(S.d), spec: S.spec ? clone(S.spec) : null, src: S.src }); S.d.accent = e.target.value; if (S.spec && /^#[0-9a-f]{6}$/i.test(e.target.value)) S.spec.palette.accent = e.target.value; draw(); }
    else if (e.target.id === 'f-consent') { readStory(); S.d.consent = e.target.checked; if (!S.d.consent) S.d.nameConsent = false; draw(); }
    else if (e.target.id === 'f-nameconsent') { readStory(); S.d.nameConsent = e.target.checked; save(); }
    else if (e.target.id === 'f-logo' || e.target.id === 'f-photo') { readStory(); var key = e.target.id.slice(2); shrink(e.target.files[0], key === 'logo' ? 240 : 900, function (u) { if (u) IMG[key] = u; draw(); }); }
  });
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'claim') return; e.preventDefault();
    var f = e.target, data = {}; new FormData(f).forEach(function (v, k) { data[k] = v; });
    var bad = validLead(data), err = $('#err');
    if (bad.length) { err.textContent = 'Please check: ' + bad.join(', ') + '.'; err.hidden = false; return; }
    data.t = S.t0; data.draft = { type: S.d.type, style: S.d.style, name: S.d.name, tagline: S.d.tagline, phone: S.d.phone, address: S.d.address, hours: S.d.hours, pages: S.d.pages, accent: S.d.accent, mods: S.d.mods, revisions: S.revs.length + 1, story: S.d.story, vibes: S.d.vibes, ai: S.src || 'preset', spec: S.spec || null, hasLogo: !!IMG.logo, hasPhoto: !!IMG.photo };
    var btn = $('#send'); btn.disabled = true; btn.textContent = 'Sending…';
    fetch('/api/build-lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Could not send right now.'); S.sent = j.id; if (S.spec) ai({ action: 'outcome', outcome: 'lead', spec: S.spec }).catch(function () {}); draw(); })
      .catch(function (x) { err.textContent = x.message + ' You can also email annaews@agentmail.to.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Request my site'; });
  });
  S.t0 = S.t0 || Date.now(); S.sent = S.step === 5 ? S.sent : null; busy = false; if (S.step === 4 && !S.spec) design('generate');
  draw();
})();
