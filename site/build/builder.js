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
  function blank() { return { type: '', style: 'rustic', name: '', tagline: '', phone: '', address: '', hours: '', pages: ['Home', 'Menu', 'About', 'Contact'], accent: '', mods: {} }; }
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
  var GF = { playfair: 'Playfair+Display:wght@600;800', fraunces: 'Fraunces:wght@600;800', bebas: 'Bebas+Neue', oswald: 'Oswald:wght@500;700', poppins: 'Poppins:wght@400;700;800', inter: 'Inter:wght@400;600;800',
    lora: 'Lora:wght@500;700', dmserif: 'DM+Serif+Display', archivo: 'Archivo+Black', pacifico: 'Pacifico', space: 'Space+Grotesk:wght@500;700', nunito: 'Nunito:wght@400;700;800', cormorant: 'Cormorant+Garamond:wght@500;700', worksans: 'Work+Sans:wght@400;600;800' };
  var ICONS = { salon: '✂️💈💅✨🪮⭐', bakery: '🥐🍞☕🧁🥖⭐', restaurant: '🍽️🔥🥘🍷🌶️⭐', auto: '🔧🚗🛞⚙️🔋⭐', retail: '🛠️🎨🔑🪵🔩⭐', pro: '🧰📐🏠✅📞⭐', other: '✨💡🤝📞🏷️⭐', learn: '📚✏️🎓💡🧠⭐' };
  function iconsFor(t) { return Array.from(ICONS[t] || ICONS.other).filter(function (c) { return /\S/.test(c) && c !== '\ufe0f'; }); }
  // Industry illustration (no stock licensing needed): duotone gradient with layered shapes and the industry glyph.
  function illo(P, t, k) {
    var ic = iconsFor(t)[k % 5] || '★';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + P.accent + '"/><stop offset="1" stop-color="' + P.accent2 + '"/></linearGradient>' +
      '<pattern id="d" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" fill-opacity=".18"/></pattern></defs><rect width="600" height="400" fill="url(#g)"/><rect width="600" height="400" fill="url(#d)"/>' +
      '<circle cx="' + (470 - k * 40) + '" cy="90" r="140" fill="#fff" fill-opacity=".12"/><circle cx="' + (90 + k * 30) + '" cy="360" r="170" fill="' + P.ink + '" fill-opacity=".14"/><rect x="330" y="210" width="190" height="120" rx="22" transform="rotate(-12 425 270)" fill="#fff" fill-opacity=".16"/>' +
      '<text x="300" y="250" font-size="150" text-anchor="middle">' + ic + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function renderSpec(sp, d, page, img) {
    img = img || {}; var P = sp.palette, r = sp.radius, photo = okImg(img.photo), logo = okImg(img.logo), aiImg = okImg(img.ai), t = d.type || 'other'; if (t === 'other' && /tutor|lesson|teach|reading|school|learn|academy/i.test((d.story || '') + ' ' + (d.name || ''))) t = 'learn';
    var name = esc(d.name || 'Your Business'), hf = FONTSTACK[sp.fonts.head] || FONTSTACK.inter, bf = FONTSTACK[sp.fonts.body] || FONTSTACK.inter;
    var custom = (d.custom || []).filter(function (c) { return c && c.title; });
    var pages = ['Home'].concat((d.pages || []).filter(function (p) { return p !== 'Home'; })).concat(custom.map(function (c) { return c.title; }));
    if (pages.indexOf(page) < 0) page = 'Home';
    var cp = custom.filter(function (c) { return c.title === page; })[0];
    var nav = pages.map(function (p) { var mt = p === 'Menu' && ((sp.sections.filter(function (s) { return s.kind === 'menu' || s.kind === 'services'; })[0] || {}).title || ''); return '<span class="n' + (p === page ? ' on' : '') + '">' + esc(p === 'Menu' ? (mt && mt.length <= 16 ? mt : pageLabel(d, 'Menu')) : p) + '</span>'; }).join('');
    var cta = '<span class="b">' + esc(sp.cta.label) + ' <i>→</i></span>', cta2 = '<span class="b ghost">' + esc(d.phone || 'Call us') + '</span>';
    var heroImg = photo || aiImg || illo(P, t, 0), art = 'url("' + heroImg + '") center/cover';
    var hero = sp.hero === 'center' ? 'bigtype' : sp.hero === 'minimal' ? 'overlap' : sp.hero;
    var kick = '<p class="kick">' + esc(d.tagline || ('Locally owned' + (d.address ? ' · ' + d.address : ''))) + '</p>', hh = '<h1>' + esc(sp.headline) + '</h1><p class="sub">' + esc(sp.subhead) + '</p><div class="ctas">' + cta + cta2 + '</div>';
    var badges = '<div class="badges">' + ['★★★★★ Loved locally', esc(d.hours || 'Open 6 days'), esc(d.address || 'Near you')].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
    var heroes = {
      split: '<section class="hero split"><div class="txt">' + kick + hh + badges + '</div><div class="art" role="img" aria-label="' + esc(sp.imagery) + '"><span class="blob"></span></div></section>',
      bigtype: '<section class="hero bigtype"><div class="shape s1"></div><div class="shape s2"></div>' + kick + hh + badges + '</section>',
      full: '<section class="hero full"><div class="veil">' + kick + hh + badges + '</div></section>',
      overlap: '<section class="hero overlap"><div class="art"></div><div class="card">' + kick + hh + '</div>' + badges + '</section>',
      banner: '<section class="hero banner"><div class="strip"></div>' + kick + hh + badges + '<div class="art"></div></section>' };
    var ic = iconsFor(t), n = 0;
    function items(s) { return s.items.map(function (i, k) { return '<div class="it"><span class="ico">' + ic[k % ic.length] + '</span><b>' + esc(i.name) + '</b>' + (i.price ? '<span class="pr">' + esc(i.price) + '</span>' : '') + '<small>' + esc(i.text) + '</small></div>'; }).join(''); }
    function sec(s) {
      n++; var h = '<h2>' + esc(s.title) + '</h2>' + (s.intro ? '<p class="intro">' + esc(s.intro) + '</p>' : ''), k = s.kind, v = s.variant, alt = ' alt' + (n % 3);
      if (k === 'services' || k === 'menu') return '<section class="s ' + k + ' v-' + v + alt + '">' + h + '<div class="items">' + items(s) + '</div></section>';
      if (k === 'gallery') return '<section class="s gallery' + alt + '">' + h + '<div class="gal">' + [0, 1, 2, 3, 4, 5].map(function (q) { return '<div class="g" style="background-image:url(\'' + (q === 0 && photo ? photo : illo(P, t, q)) + '\')"></div>'; }).join('') + '</div></section>';
      if (k === 'testimonials') return '<section class="s quotes">' + h + '<div class="strip-q">' + s.items.map(function (i) { return '<blockquote><span class="stars">★★★★★</span>“' + esc(i.text) + '”<cite>' + esc(i.name) + '</cite></blockquote>'; }).join('') + '</div></section>';
      if (k === 'about' || k === 'story') return '<section class="s about' + alt + '"><div class="ph" style="background-image:url(\'' + (photo || illo(P, t, 3)) + '\')"></div><div>' + h + '<p>' + esc(s.intro ? '' : sp.about) + '</p>' + items(s) + '</div></section>';
      if (k === 'stats') return '<section class="s stats">' + h + '<div class="items">' + s.items.map(function (i) { return '<div class="it"><b class="big">' + esc(i.name) + '</b><small>' + esc(i.text) + '</small></div>'; }).join('') + '</div></section>';
      if (k === 'map') return '<section class="s map' + alt + '">' + h + '<div class="mapbox"><span>📍 ' + esc(d.address || 'Find us') + '</span></div></section>';
      if (k === 'hours') return '<section class="s hours' + alt + '">' + h + '<p class="hrs">' + esc(d.hours || 'Mon–Sat 8am–6pm') + '</p>' + items(s) + '</section>';
      if (k === 'booking') return '<section class="s booking">' + h + '<p>' + esc(sp.cta.note || 'Call ' + (d.phone || 'us')) + '</p>' + cta + '</section>';
      if (k === 'faq') return '<section class="s faq' + alt + '">' + h + s.items.map(function (i) { return '<details open><summary>' + esc(i.name) + '</summary><p>' + esc(i.text) + '</p></details>'; }).join('') + '</section>';
      return '';
    }
    var list;
    if (cp) list = cp.sections || [];
    else { list = page === 'Home' ? sp.sections : sp.sections.filter(function (s) { return (PAGE_KINDS[page] || []).indexOf(s.kind) >= 0; });
      if (page === 'About' && !list.length) list = [{ kind: 'about', title: 'About ' + (d.name || 'us'), intro: '', items: [] }];
      if (page === 'Gallery' && !list.length) list = [{ kind: 'gallery', variant: 'grid', title: 'Gallery', intro: '', items: [] }];
      if (page === 'Menu' && !list.length) list = sp.sections.filter(function (s) { return s.items && s.items.length; }).slice(0, 1);
      if (page === 'Contact' && !list.length) list = [{ kind: 'booking', title: 'Visit or call', intro: '', items: [] }, { kind: 'map', title: 'Find us', intro: '', items: [] }]; }
    var phead = page === 'Home' ? (heroes[hero] || heroes.split) : '<section class="phead"><div class="shape s1"></div><p class="kick">' + name + '</p><h1>' + esc(page) + '</h1>' + (cp && cp.intro ? '<p class="sub">' + esc(cp.intro) + '</p>' : '') + '</section>';
    var body = phead + list.map(sec).join('');
    var dark = function (h) { var q = parseInt(h.slice(1), 16); return ((q >> 16) * 299 + ((q >> 8) & 255) * 587 + (q & 255) * 114) / 1000 < 140; };
    var onA = dark(P.accent) ? '#fff' : '#111', onB = dark(P.accent2) ? '#fff' : '#111', bgDark = dark(P.bg);
    var tint = 'color-mix(in srgb,' + P.accent + ' 12%,' + P.bg + ')', tex = 'radial-gradient(' + (bgDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)') + ' 1px,transparent 1.4px) 0 0/16px 16px';
    var sh = bgDark ? '0 10px 30px rgba(0,0,0,.45)' : '0 12px 32px rgba(20,20,40,.12)';
    var css = '*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}body{font-family:' + bf + ';background:' + P.bg + ';color:' + P.ink + ';line-height:1.6;font-size:16px}h1,h2,.logo,.big{font-family:' + hf + ';letter-spacing:-.01em}' +
      'header{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:6px 20px;padding:14px 26px;background:color-mix(in srgb,' + P.surface + ' 88%,transparent);backdrop-filter:blur(8px);box-shadow:0 1px 0 rgba(127,127,127,.2)}header .logo{font-weight:800;font-size:22px;margin-right:auto;display:flex;align-items:center;gap:10px}header .logo img{height:38px;width:auto;border-radius:8px}' +
      '.n{font-size:15px;padding:4px 2px;border-bottom:3px solid transparent;transition:border-color .2s}.n:hover{border-color:' + P.accent2 + '}.n.on{border-color:' + P.accent + '}' +
      '.b{display:inline-flex;gap:8px;align-items:center;background:' + P.accent + ';color:' + onA + ';padding:14px 28px;border-radius:' + r + 'px;font-weight:800;box-shadow:0 8px 22px color-mix(in srgb,' + P.accent + ' 40%,transparent);transition:transform .2s,box-shadow .2s}.b:hover{transform:translateY(-2px);box-shadow:0 14px 30px color-mix(in srgb,' + P.accent + ' 55%,transparent)}.b i{font-style:normal;transition:transform .2s}.b:hover i{transform:translateX(4px)}' +
      '.b.ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px currentColor}.ctas{display:flex;flex-wrap:wrap;gap:12px}' +
      '.hero{position:relative;overflow:hidden;padding:84px 28px}.hero h1,.phead h1{font-size:clamp(38px,7.4vw,80px);line-height:1;font-weight:800;max-width:15ch}.sub{margin:16px 0 26px;font-size:19px;opacity:.9;max-width:600px}.kick{text-transform:uppercase;letter-spacing:.22em;font-size:12px;font-weight:700;color:' + P.accent + ';margin-bottom:14px}' +
      '.badges{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.badges span{font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px;background:' + tint + ';border:1px solid color-mix(in srgb,' + P.accent + ' 30%,transparent)}' +
      '.split{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:center;background:' + tex + ',linear-gradient(160deg,' + P.bg + ',' + tint + ')}.split .art{position:relative;min-height:420px;border-radius:' + Math.max(r, 16) + 'px;background:' + art + ';box-shadow:' + sh + '}.split .blob{position:absolute;inset:auto -24px -24px auto;width:140px;height:140px;border-radius:50%;background:' + P.accent2 + ';opacity:.85;z-index:-1}' +
      '.bigtype{background:linear-gradient(135deg,' + P.accent + ',' + P.accent2 + ');color:' + onA + ';padding:110px 28px 90px}.bigtype .kick{color:inherit;opacity:.85}.bigtype h1{font-size:clamp(46px,9vw,104px)}.bigtype .b{background:' + P.bg + ';color:' + P.ink + '}.bigtype .badges span{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3)}' +
      '.shape{position:absolute;border-radius:50%;pointer-events:none}.s1{width:420px;height:420px;right:-120px;top:-140px;background:rgba(255,255,255,.14)}.s2{width:260px;height:260px;right:12%;bottom:-130px;border:40px solid rgba(255,255,255,.12)}' +
      '.full{background:' + art + ';padding:0}.full .veil{background:linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.25));color:#fff;padding:150px 28px 70px}.full .kick{color:' + P.accent2 + '}.full .badges span{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3)}' +
      '.overlap{padding:0 0 40px}.overlap .art{height:420px;background:' + art + '}.overlap .card{position:relative;margin:-150px 28px 0;max-width:720px;background:' + P.bg + ';padding:40px;border-radius:' + Math.max(r, 14) + 'px;box-shadow:' + sh + ';border-top:6px solid ' + P.accent + '}.overlap .badges{padding:0 28px}' +
      '.banner{background:' + P.accent2 + ';color:' + onB + ';display:grid;grid-template-columns:1.3fr 1fr;gap:0 30px}.banner>*:not(.art){grid-column:1}.banner .art{grid-column:2;grid-row:1/span 6;border-radius:' + r + 'px;background:' + art + ';min-height:340px;transform:rotate(2deg);box-shadow:' + sh + '}.banner .strip{height:10px;width:120px;background:' + P.accent + ';margin-bottom:18px}.banner .kick{color:inherit}' +
      '.phead{position:relative;overflow:hidden;padding:80px 28px 60px;background:linear-gradient(135deg,' + P.accent + ',' + P.accent2 + ');color:' + onA + '}.phead .kick{color:inherit;opacity:.8}' +
      '.s{padding:72px 28px;position:relative}.s h2{font-size:clamp(28px,4.4vw,44px);line-height:1.1;margin-bottom:12px;font-weight:800}.s h2:after{content:"";display:block;width:64px;height:5px;border-radius:3px;background:' + P.accent + ';margin-top:14px}.intro{opacity:.82;margin-bottom:22px;max-width:680px;font-size:17px}' +
      '.alt1{background:' + P.surface + '}.alt2{background:' + tex + ',' + tint + '}.alt0{background:' + P.bg + '}' +
      '.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:18px}.it{position:relative;background:' + P.bg + ';border:1px solid rgba(127,127,127,.18);border-radius:' + r + 'px;padding:22px;box-shadow:' + sh + ';transition:transform .25s,box-shadow .25s}.it:hover{transform:translateY(-4px)}.it b{display:block;font-size:18px;margin:6px 0 4px}.it small{opacity:.78;font-size:14.5px}.pr{position:absolute;top:18px;right:18px;color:' + onA + ';background:' + P.accent + ';font-weight:800;padding:2px 10px;border-radius:999px;font-size:14px}' +
      '.ico{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:14px;background:' + tint + ';font-size:22px}' +
      '.v-list .items{display:block}.v-list .it{box-shadow:none;border:0;border-bottom:1px dashed rgba(127,127,127,.4);border-radius:0;background:none}.v-band .it{background:' + P.accent + ';color:' + onA + '}' +
      '.gal{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:170px;gap:12px}.g{border-radius:' + r + 'px;background-size:cover;background-position:center;box-shadow:' + sh + ';transition:transform .3s}.g:hover{transform:scale(1.02)}.g:first-child{grid-row:span 2;grid-column:span 2}' +
      '.quotes{background:' + P.accent + ';color:' + onA + '}.quotes h2:after{background:' + P.bg + '}.strip-q{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,1fr);gap:18px;overflow-x:auto;padding-bottom:6px}blockquote{background:' + P.bg + ';color:' + P.ink + ';padding:24px;border-radius:' + r + 'px;font-size:17px;box-shadow:' + sh + '}.stars{display:block;color:' + P.accent2 + ';letter-spacing:2px;margin-bottom:8px}cite{display:block;margin-top:12px;font-style:normal;font-weight:800;font-size:14px}' +
      '.about{display:grid;grid-template-columns:minmax(220px,.8fr) 1.2fr;gap:40px;align-items:center}.about .ph{min-height:340px;border-radius:' + Math.max(r, 16) + 'px;background-size:cover;background-position:center;box-shadow:' + sh + ';outline:10px solid ' + tint + '}' +
      '.stats{background:' + P.ink + ';color:' + P.bg + '}.stats .it{background:transparent;border-color:rgba(127,127,127,.35);box-shadow:none;text-align:center}.big{font-size:52px;color:' + P.accent2 + ';line-height:1}' +
      '.mapbox{height:240px;border-radius:' + r + 'px;background:repeating-linear-gradient(45deg,' + P.surface + ' 0 14px,' + P.bg + ' 14px 28px);display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:' + sh + '}.hrs{font-size:22px;font-weight:800;margin-bottom:14px}' +
      '.booking{text-align:center;background:linear-gradient(135deg,' + P.accent2 + ',' + P.accent + ');color:' + onB + '}.booking h2:after{margin:14px auto 0;background:currentColor}.booking p{margin:0 auto 22px;max-width:560px}details{padding:14px 0;border-bottom:1px solid rgba(127,127,127,.3)}summary{font-weight:800;cursor:pointer}' +
      '.note{opacity:.6;font-size:13px;margin-top:14px}' +
      'footer{background:' + P.ink + ';color:' + P.bg + ';padding:56px 28px 26px}.fgrid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:28px}.fgrid h3{font-family:' + hf + ';font-size:22px;margin-bottom:10px}.fgrid p{opacity:.8;font-size:14.5px}.fmap{height:110px;border-radius:' + r + 'px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 10px,transparent 10px 20px);display:flex;align-items:center;justify-content:center;font-size:13px}.fine{margin-top:30px;font-size:12px;opacity:.55;text-align:center}' +
      '@keyframes rv{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}@supports (animation-timeline:view()){.s>*{animation:rv linear both;animation-timeline:view();animation-range:entry 0% cover 22%}}' +
      '@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}' +
      '@media(max-width:700px){.split,.banner,.about,.fgrid{grid-template-columns:1fr}.banner .art{grid-column:1;grid-row:auto;margin-top:24px;transform:none}.split .art{min-height:260px}.hero{padding:60px 22px}.full .veil{padding-top:110px}.overlap .card{margin:-90px 16px 0;padding:26px}.gal{grid-template-columns:1fr 1fr}.s{padding:56px 22px}}' +
      '.L-grid .s:not(.quotes):not(.stats):not(.booking){border-top:6px solid ' + P.accent + '}.L-grid .s h2{text-transform:uppercase;letter-spacing:.03em}' +
      '.L-editorial .s>*{max-width:820px;margin-left:auto;margin-right:auto}.L-editorial .s h2{font-weight:400;font-size:clamp(32px,5vw,52px)}.L-editorial .s h2:after{width:100%;height:1px;background:currentColor;opacity:.3}' +
      '.L-split .s:not(.quotes):not(.booking):not(.stats){display:grid;grid-template-columns:minmax(180px,1fr) 2.4fr;gap:8px 40px;align-items:start}.L-split .s>h2{grid-column:1;grid-row:1/span 4}.L-split .s>*:not(h2){grid-column:2}@media(max-width:700px){.L-split .s:not(.quotes){display:block}}';
    var font = [sp.fonts.head, sp.fonts.body].filter(function (f, i, a) { return GF[f] && a.indexOf(f) === i; }).map(function (f) { return 'family=' + GF[f]; }).join('&');
    var foot = '<footer><div class="fgrid"><div><h3>' + name + '</h3><p>' + esc(sp.subhead) + '</p><div class="ctas" style="margin-top:16px">' + cta + '</div></div><div><h3>Hours</h3><p>' + esc(d.hours || 'Mon–Sat 8am–6pm') + '</p><p>' + esc(d.phone || '') + '</p></div><div><h3>Visit</h3><div class="fmap">📍 ' + esc(d.address || 'Find us') + '</div></div></div><p class="fine">Draft by Elder World Studio · not published</p></footer>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + (font ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + font + '&display=swap">' : '') + '<style>' + css + '</style></head><body class="L-' + esc(sp.layout || 'grid') + '"><header><span class="logo">' + (logo ? '<img src="' + logo + '" alt="">' : '') + name + '</span>' + nav + '</header>' + body + foot + '</body></html>';
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

  /* ---- Preview before a design exists: carousel of 5 real AI samples, then the closest sample for the chosen type, then a quick luna design once type + name are in. ---- */
  var SAMPLES = (typeof window !== 'undefined' && window.EWS_SAMPLES) || [], ci = 0, timer = null, qTimer = null;
  var TYPE_SAMPLE = { salon: 3, bakery: 1, restaurant: 1, auto: 2, retail: 4, pro: 4 };
  var QUICK_MAX = 2, QUICK_MS = 1500, QUICK_OFF = typeof location !== 'undefined' && /[?&]quick=0\b/.test(location.search);
  function sampleIdx() { return S.d.type ? (TYPE_SAMPLE[S.d.type] != null ? TYPE_SAMPLE[S.d.type] : ci % SAMPLES.length) : ci % SAMPLES.length; }
  function paint() {
    var f = $('#preview'), u = $('#url'), d = S.d; if (!f) return;
    var sp = S.spec || S.qspec; if (S.spec && S.specStage === 'full') heroImage();
    if (sp) { f.srcdoc = renderSpec(sp, d, S.page, AIIMGS[sp.headline] && !IMG.photo ? Object.assign({}, IMG, { ai: AIIMGS[sp.headline] }) : IMG); f.dataset.mode = S.spec ? (S.specStage || 'full') : 'quick'; u.textContent = (suggestDomain(d.name) || 'yourbusiness.com') + (S.page === 'Home' ? '' : '/' + S.page.toLowerCase()); }
    else if (SAMPLES.length) { var x = SAMPLES[sampleIdx()]; f.srcdoc = renderSpec(x.spec, { name: x.name, pages: ['Home'] }, 'Home', {}); f.dataset.mode = 'sample'; f.dataset.sample = x.name;
      u.textContent = (S.d.type ? 'Example AI design · ' : 'AI-designed examples · ') + x.name + (S.d.type ? ' · yours is next' : ''); }
    else { f.srcdoc = render(d.type ? d : Object.assign({}, d, { type: 'other' }), S.page); f.dataset.mode = 'starter'; }
    if (!timer && typeof setInterval !== 'undefined') timer = setInterval(function () { if (!S.spec && !S.d.type && SAMPLES.length > 1) { ci++; paint(); } }, 3500);
  }
  function quickSoon() {
    if (QUICK_OFF || S.spec || (S.quick || 0) >= QUICK_MAX) return; clearTimeout(qTimer);
    qTimer = setTimeout(function () { var d = S.d; if (!d.type || (d.name || '').length < 3 || S.spec || busy) return;
      S.quick = (S.quick || 0) + 1; busy = true; $('#url').textContent = 'Designing ' + d.name + ' with AI…';
      ai({ action: 'generate', seed: Math.floor(Math.random() * 99999), spec: null, request: '' }).then(function (j) { busy = false;
        if (j && j.spec && j.source === 'ai' && !S.spec) { S.spec = j.spec; S.src = 'ai'; S.specStage = 'quick'; save(); paint(); } else paint(); }).catch(function () { busy = false; paint(); });
    }, QUICK_MS);
  }
  /* ---- AI page builder: owner-made pages in the same design system. Limits per plan (for Joshua to confirm; null = unlimited). ---- */
  var PAGE_LIMITS = { Starter: 5, Business: 10, Plus: null }, DRAFT_PAGE_MAX = 12;
  var IDEAS = { salon: ['Prices', 'Book an appointment', 'Gallery', 'Gift cards'], bakery: ['Menu', 'Custom cakes', 'Catering', 'Wholesale'], restaurant: ['Menu', 'Catering', 'Private events', 'Reservations'],
    auto: ['Services & prices', 'Book a repair', 'Reviews', 'Fleet service'], retail: ['Shop departments', 'Services', 'Gift cards', 'Events'], pro: ['Services', 'Get a quote', 'Projects', 'FAQ'], other: ['Book a lesson', 'Prices', 'FAQ', 'Gallery'] };
  function customs() { return S.d.custom = S.d.custom || []; }
  function curCustom() { return customs().filter(function (c) { return c.title === S.page; })[0]; }
  function allPages() { var base = S.d.pages.length ? S.d.pages : ['Home']; return base.concat(customs().map(function (c) { return c.title; })); }
  function uniqTitle(t, skip) { var n = t, k = 2; while (allPages().some(function (p) { return p.toLowerCase() === n.toLowerCase() && p !== skip; })) n = t + ' ' + k++; return n; }
  function planNote() { var n = allPages().length; return n + ' page' + (n === 1 ? '' : 's') + ' · Starter includes ' + PAGE_LIMITS.Starter + ', Business ' + PAGE_LIMITS.Business + ', Plus unlimited'; }
  function pageAI(req, cur, cb) {
    if (busy) return; busy = true; S.msg = cur ? 'Updating ' + cur.title + '…' : 'Designing your new page…'; draw();
    ai({ action: 'page', spec: S.spec, request: req, page: cur || null, count: customs().length }).then(function (j) { busy = false; S.msg = '';
      if (j && j.ok && j.page) cb(j.page); else S.msg = (j && j.error) || 'Couldn’t design that page. Try different words.'; draw();
    }).catch(function () { busy = false; S.msg = 'Could not reach the designer.'; draw(); });
  }
  function addPage(req) {
    if (!S.spec) return; if (customs().length >= DRAFT_PAGE_MAX) { S.msg = 'This draft has the most pages we can add for free. Tell us the rest when you get it built.'; draw(); return; }
    pageAI(req, null, function (pg) { var c = { id: 'p' + Date.now().toString(36), title: uniqTitle(pg.title), intro: pg.intro, sections: pg.sections, prompt: req };
      S.revs.push({ label: 'Added page: ' + c.title, before: clone(S.d) }); customs().push(c); S.page = c.title; });
  }
  function regenPage(c) { pageAI(c.prompt || ('A ' + c.title + ' page'), null, function (pg) { S.revs.push({ label: 'Fresh page: ' + c.title, before: clone(S.d) }); c.intro = pg.intro; c.sections = pg.sections; }); }
  function editPage(c, req) { pageAI(req, c, function (pg) { S.revs.push({ label: c.title + ': ' + req, before: clone(S.d) }); c.intro = pg.intro; c.sections = pg.sections; }); }
  var AIIMGS = {}, IMG_OFF = typeof location !== 'undefined' && /[?&]img=0\b/.test(location.search);
  function heroImage() { if (IMG_OFF || IMG.photo || !S.spec || S.src !== 'ai' || AIIMGS[S.spec.headline] != null) return; var key = S.spec.headline; AIIMGS[key] = '';
    fetch('/api/build-img', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: S.d.type, imagery: S.spec.imagery }) }).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok && /^data:image\/jpeg;base64,/.test(j.image)) { AIIMGS[key] = j.image; paint(); } }).catch(function () {}); }
  function design(action, req, retry) {
    if (busy) return; busy = true; S.msg = action === 'edit' ? 'Updating your design…' : 'Designing a site just for ' + (S.d.name || 'you') + '…'; draw();
    var seed = Math.floor(Math.random() * 99999);
    ai({ action: action, seed: seed, spec: S.spec || null, request: req || '' }).then(function (j) {
      busy = false; S.msg = '';
      if (j && j.source === 'fallback' && (j.reason === 'error' || j.reason === 'invalid') && !retry) { setTimeout(function () { design(action, req, true); }, 800); return; }
      if (j && j.spec) { if (S.spec) S.revs.push({ label: action === 'edit' ? 'Change: ' + req : action === 'regenerate' ? 'Fresh design' : 'New design', before: clone(S.d), spec: clone(S.spec), src: S.src }); S.spec = j.spec; S.src = j.source; S.specStage = 'full'; S.qspec = null; if (j.source === 'ai' && action !== 'edit') heroImage(); if (j.source === 'fallback') S.msg = j.error || 'Our AI designer is busy, so this is a starter layout. Try Regenerate in a bit.'; }
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
    ['Domain', 'From $13/yr', 'Your own .com, registered in your name'],
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
      '<label>Tagline<input id="f-tagline" maxlength="120" value="' + esc(d.tagline) + '" placeholder="' + esc((TYPES[d.type] || TYPES.other).tagline) + '"></label>' +
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
      '<h3>Pages</h3><p class="fine" id="page-note">' + planNote() + '</p>' +
      '<ul class="cpages" id="cpages">' + customs().map(function (c, i) { return '<li data-cid="' + esc(c.id) + '"' + (c.title === S.page ? ' class="on"' : '') + '><input class="cp-name" maxlength="32" value="' + esc(c.title) + '" aria-label="Page name">' +
        '<button type="button" class="ghost sm" data-cp="up"' + (i ? '' : ' disabled') + ' aria-label="Move up">↑</button><button type="button" class="ghost sm" data-cp="down"' + (i < customs().length - 1 ? '' : ' disabled') + ' aria-label="Move down">↓</button>' +
        '<button type="button" class="ghost sm" data-cp="regen" aria-label="Regenerate page">↻</button><button type="button" class="ghost sm" data-cp="del" aria-label="Delete page">✕</button></li>'; }).join('') + '</ul>' +
      '<div class="form"><label>Add a page with AI<input id="f-addpage" maxlength="200" placeholder="Add a Gallery page, a Prices page with my menu, an FAQ…"></label></div><button type="button" class="btn btn-primary sm" id="addpage"' + (busy || !S.spec ? ' disabled' : '') + '>+ Add page</button>' +
      '<div class="ideas">' + (IDEAS[d.type] || IDEAS.other).filter(function (t) { return allPages().indexOf(t) < 0; }).map(function (t) { return chip('idea', t, '+ ' + esc(t), false); }).join('') + '</div>' +
      '<h3>' + (curCustom() ? 'Change the ' + esc(S.page) + ' page' : 'Ask for a change') + '</h3><div class="form"><label>Describe it<input id="f-ask" maxlength="300" placeholder="Make it darker, add a gallery, move reviews to the top…"></label></div><button type="button" class="btn btn-primary sm" id="ask"' + (busy ? ' disabled' : '') + '>Apply change</button>' +
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
    var tabs = allPages(); if (tabs.indexOf(S.page) < 0) S.page = tabs[0];
    $('#tabs').innerHTML = tabs.map(function (p) { return '<button type="button" class="tab' + (p === S.page ? ' on' : '') + '" data-tab="' + esc(p) + '">' + esc(pageLabel(d, p)) + '</button>'; }).join('');
    $('#frame-wrap').className = 'frame ' + S.device;
    root.querySelectorAll('[data-device]').forEach(function (b) { b.classList.toggle('on', b.dataset.device === S.device); });
    $('#url').textContent = (suggestDomain(d.name) || 'yourbusiness.com') + (S.page === 'Home' ? '' : '/' + S.page.toLowerCase());
    paint();
    $('#rev-badge').textContent = 'v' + (S.revs.length + 1);
    save();
  }
  function readStory() { var el = $('#f-story'); if (el) S.d.story = el.value.trim(); }
  function readDetails() { ['name', 'tagline', 'phone', 'address', 'hours'].forEach(function (k) { var el = $('#f-' + k); if (el) S.d[k] = el.value.trim(); }); }
  root.addEventListener('change', function (e) { var el = e.target; if (!el.classList || !el.classList.contains('cp-name')) return;
    var c = customs().filter(function (x) { return x.id === el.closest('[data-cid]').dataset.cid; })[0], t = el.value.replace(/[^\p{L}\p{N} &'’,.!?-]/gu, '').trim().slice(0, 32);
    if (!c || !t || t === c.title) { draw(); return; } S.revs.push({ label: 'Renamed page: ' + c.title + ' → ' + t, before: clone(S.d) }); var was = S.page === c.title; c.title = uniqTitle(t, c.title); if (was) S.page = c.title; draw(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.type) { S.d.type = b.dataset.type; }
    else if (b.dataset.style) { S.d.style = b.dataset.style; S.d.accent = ''; }
    else if (b.dataset.page) { var i = S.d.pages.indexOf(b.dataset.page); if (i >= 0) { if (S.d.pages.length > 1) S.d.pages.splice(i, 1); } else S.d.pages = PAGES.filter(function (p) { return p === b.dataset.page || S.d.pages.indexOf(p) >= 0; }); }
    else if (b.dataset.tab) { S.page = b.dataset.tab; }
    else if (b.dataset.device) { S.device = b.dataset.device; }
    else if (b.dataset.vibe) { readStory(); var vs = S.d.vibes = S.d.vibes || [], vi = vs.indexOf(b.dataset.vibe); if (vi >= 0) vs.splice(vi, 1); else if (vs.length < 3) vs.push(b.dataset.vibe); }
    else if (b.id === 'regen') { design('regenerate'); return; }
    else if (b.id === 'ask') { var q = ($('#f-ask').value || '').trim(); if (!q || !S.spec) return; var cc = curCustom(); if (cc) editPage(cc, q); else design('edit', q); return; }
    else if (b.id === 'addpage') { var ap = ($('#f-addpage').value || '').trim(); if (ap) addPage(ap); return; }
    else if (b.dataset.idea) { addPage('Add a ' + b.dataset.idea + ' page'); return; }
    else if (b.dataset.cp) { var li = b.closest('[data-cid]'), cs = customs(), ix = cs.findIndex(function (c) { return c.id === li.dataset.cid; }), c = cs[ix]; if (!c) return;
      if (b.dataset.cp === 'regen') { regenPage(c); return; }
      S.revs.push({ label: (b.dataset.cp === 'del' ? 'Deleted page: ' : 'Moved page: ') + c.title, before: clone(S.d) });
      if (b.dataset.cp === 'del') { cs.splice(ix, 1); if (S.page === c.title) S.page = 'Home'; }
      else { var j2 = ix + (b.dataset.cp === 'up' ? -1 : 1); cs.splice(ix, 1); cs.splice(j2, 0, c); } }
    else if (b.dataset.change) { S.revs.push({ label: CHANGES[b.dataset.change].label, before: clone(S.d) }); CHANGES[b.dataset.change].apply(S.d); }
    else if (b.id === 'undo') { var r = S.revs.pop(); if (r) { S.d = r.before; if (r.spec) { S.spec = r.spec; S.src = r.src; } S.msg = ''; } }
    else if (b.id === 'next') { if (S.step === 0 && !S.d.type) { var t0 = root.querySelector('.tile'); if (t0) t0.focus(); return; } if (S.step === 2) { readDetails(); if (!S.d.name) { $('#err').hidden = false; $('#f-name').focus(); return; } } if (S.step === 3) { readStory(); if (S.d.story.length < 10) { $('#err').hidden = false; $('#f-story').focus(); return; } S.step = 4; S.revs = []; S.qspec = S.specStage === 'quick' ? S.spec : null; S.spec = null; draw(); design('generate'); window.scrollTo(0, root.offsetTop - 70); return; } S.step = Math.min(5, S.step + 1); window.scrollTo(0, root.offsetTop - 70); }
    else if (b.id === 'back') { if (S.step === 2) readDetails(); if (S.step === 3) readStory(); S.step = Math.max(0, S.step - 1); }
    else if (b.id === 'restart') { S = { quick: S.quick, step: 0, d: blank(), revs: [], page: 'Home', device: S.device, sid: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) }; IMG = {}; }
    else return;
    draw();
  });
  root.addEventListener('input', function (e) {
    if (e.target.id && e.target.id.indexOf('f-') === 0 && e.target.id !== 'f-accent') { readDetails(); paint(); save(); if (e.target.id === 'f-name') quickSoon(); }
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
  S.t0 = S.t0 || Date.now(); S.sent = S.step === 5 ? S.sent : null; busy = false; if (S.step === 4 && (!S.spec || S.specStage === 'quick')) design('generate');
  draw();
})();
