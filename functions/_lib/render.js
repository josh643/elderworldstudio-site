// Server-side static HTML from a site spec + draft. Escapes all owner text.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FONT = {
  playfair: 'Georgia, serif', fraunces: 'Georgia, serif', bebas: 'Impact, sans-serif', oswald: '"Arial Narrow", sans-serif',
  poppins: 'Arial, sans-serif', inter: 'Arial, sans-serif', lora: 'Georgia, serif', dmserif: 'Georgia, serif',
  archivo: '"Arial Black", sans-serif', pacifico: 'cursive', space: 'Arial, sans-serif', nunito: 'Arial, sans-serif',
  cormorant: 'Garamond, Georgia, serif', worksans: 'Verdana, sans-serif',
};

function parseDraft(site) {
  try { return JSON.parse(site.draft || '{}'); } catch { return {}; }
}
function parseSpec(site) {
  if (!site.spec) return null;
  try { return typeof site.spec === 'string' ? JSON.parse(site.spec) : site.spec; } catch { return null; }
}

export function renderPage(site, page = 'Home') {
  const d = parseDraft(site);
  const spec = parseSpec(site);
  const name = esc(d.name || site.name || 'Your Business');
  const pages = ['Home'].concat((d.pages || []).filter((p) => p !== 'Home')).concat((d.custom || []).map((c) => c.title).filter(Boolean));
  if (!pages.includes(page)) page = pages[0] || 'Home';
  const P = (spec && spec.palette) || { bg: '#ffffff', ink: '#1a1a1a', accent: '#2f6df6', accent2: '#111111', surface: '#f4f4f6' };
  const hf = FONT[(spec && spec.fonts && spec.fonts.head) || 'inter'];
  const bf = FONT[(spec && spec.fonts && spec.fonts.body) || 'inter'];
  const nav = pages.map((p) => `<a href="${p === 'Home' ? 'index.html' : slug(p) + '.html'}"${p === page ? ' aria-current="page"' : ''}>${esc(p)}</a>`).join('');
  const headline = esc((spec && spec.headline) || name);
  const sub = esc((spec && spec.subhead) || d.tagline || '');
  const about = esc((spec && spec.about) || d.story || '');
  const cta = esc((spec && spec.cta && spec.cta.label) || 'Get in touch');
  const sections = ((spec && spec.sections) || []).map((s) => {
    const items = (s.items || []).map((i) => `<li><strong>${esc(i.name)}</strong> ${esc(i.text || '')}${i.price ? ` <em>${esc(i.price)}</em>` : ''}</li>`).join('');
    return `<section><h2>${esc(s.title)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ''}${items ? `<ul>${items}</ul>` : ''}</section>`;
  }).join('');
  const custom = (d.custom || []).find((c) => c.title === page);
  const extra = custom ? `<section><h2>${esc(custom.title)}</h2>${custom.intro ? `<p>${esc(custom.intro)}</p>` : ''}</section>` : '';
  const hero = page === 'Home'
    ? `<header class="hero"><p class="kick">${esc(d.tagline || d.address || '')}</p><h1>${headline}</h1><p>${sub}</p><p><a class="btn" href="contact.html">${cta}</a></p></header>`
    : `<header class="hero"><h1>${esc(page)}</h1></header>`;
  const contact = page === 'Contact' || page === 'Home'
    ? `<section><h2>Visit or call</h2><p>${esc(d.phone || '')}</p><p>${esc(d.address || '')}</p><p>${esc(d.hours || '')}</p></section>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${page === 'Home' ? name : esc(page) + ' · ' + name}</title>
<style>
body{margin:0;font-family:${bf};background:${P.bg};color:${P.ink};line-height:1.55}
h1,h2{font-family:${hf}} nav{display:flex;flex-wrap:wrap;gap:12px 20px;padding:16px 24px;border-bottom:1px solid rgba(127,127,127,.25)}
nav a{color:inherit;text-decoration:none} nav a[aria-current=page]{color:${P.accent};font-weight:700}
.hero{padding:48px 24px;background:${P.accent};color:#fff}.hero h1{font-size:clamp(32px,6vw,64px);line-height:1.05;margin:0 0 12px}
.kick{text-transform:uppercase;letter-spacing:.12em;font-size:12px}
section{padding:32px 24px;max-width:880px} .btn{display:inline-block;background:${P.accent2};color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:700}
footer{padding:24px;font-size:13px;opacity:.7}
</style></head><body>
<nav><strong>${name}</strong>${nav}</nav>
${hero}
${page === 'Home' || page === 'About' ? `<section><h2>About</h2><p>${about}</p></section>` : ''}
${page === 'Home' ? sections : ''}
${extra}
${contact}
<footer>© ${new Date().getFullYear()} ${name}</footer>
</body></html>`;
}

function slug(p) { return String(p || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'; }

export function sitePages(site) {
  const d = parseDraft(site);
  const custom = (d.custom || []).map((c) => c.title).filter(Boolean);
  const pages = ['Home'].concat((d.pages || []).filter((p) => p !== 'Home')).concat(custom);
  return [...new Set(pages.length ? pages : ['Home'])];
}

export function siteFiles(site) {
  const pages = sitePages(site);
  const files = pages.map((p) => ({
    name: p === 'Home' ? 'index.html' : slug(p) + '.html',
    data: renderPage(site, p),
  }));
  files.push({
    name: 'README.txt',
    data: [
      'Your website files from Elder World Studio',
      '',
      'Upload these HTML files to your host (the folder that serves your domain).',
      'index.html is the home page. Other files are extra pages.',
      'No monthly fee is included with Take it with you. Edits and support are not included.',
      '',
      'Need help? Email annaews@agentmail.to',
    ].join('\n'),
  });
  return files;
}

export { esc };
