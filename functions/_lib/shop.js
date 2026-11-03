// In-memory + D1 shop store. Same interface so unit tests and the E2E harness do not need Cloudflare.
import { PLAN_IDS } from './plans.js';

const nowIso = () => new Date().toISOString();
const id = (p = '') => (p ? p + '-' : '') + crypto.randomUUID();

export const SHOP_SCHEMA = `
CREATE TABLE IF NOT EXISTS shop_customers (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, created TEXT NOT NULL,
  stripe_customer_id TEXT, stripe_subscription_id TEXT, plan TEXT, status TEXT NOT NULL DEFAULT 'none'
);
CREATE TABLE IF NOT EXISTS shop_sessions (
  token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL, expires TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_login_tokens (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, customer_id TEXT, expires TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_sites (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, name TEXT, plan TEXT, status TEXT NOT NULL DEFAULT 'draft',
  slug TEXT UNIQUE, draft TEXT, spec TEXT, published_html TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY, customer_id TEXT, email TEXT, stripe_session_id TEXT UNIQUE, plan TEXT, kind TEXT,
  amount_cents INTEGER, status TEXT, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_invoices (
  id TEXT PRIMARY KEY, customer_id TEXT, stripe_invoice_id TEXT UNIQUE, amount_cents INTEGER,
  description TEXT, status TEXT, hosted_url TEXT, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_events (
  stripe_event_id TEXT PRIMARY KEY, type TEXT, created TEXT NOT NULL
);
`;

export function createMemoryShop() {
  const customers = new Map();
  const sessions = new Map();
  const tokens = new Map();
  const sites = new Map();
  const orders = new Map();
  const invoices = new Map();
  const events = new Set();
  const byEmail = new Map();
  const byStripe = new Map();
  const bySlug = new Map();
  const bySession = new Map();

  return {
    kind: 'memory',
    async ensure() { return true; },
    async findCustomerByEmail(email) { return byEmail.get(String(email || '').toLowerCase()) || null; },
    async findCustomerById(cid) { return customers.get(cid) || null; },
    async findCustomerByStripe(sid) { return byStripe.get(sid) || null; },
    async upsertCustomer(c) {
      const row = { ...c, email: String(c.email).toLowerCase() };
      customers.set(row.id, row);
      byEmail.set(row.email, row);
      if (row.stripe_customer_id) byStripe.set(row.stripe_customer_id, row);
      return row;
    },
    async createSession(customerId, tokenHash, expires) {
      sessions.set(tokenHash, { token_hash: tokenHash, customer_id: customerId, expires });
    },
    async getSession(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s || s.expires < nowIso()) return null;
      return s;
    },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },
    async createLoginToken(email, tokenHash, expires, customerId = null) {
      tokens.set(tokenHash, { token_hash: tokenHash, email: String(email).toLowerCase(), customer_id: customerId, expires });
    },
    async consumeLoginToken(tokenHash) {
      const t = tokens.get(tokenHash);
      tokens.delete(tokenHash);
      if (!t || t.expires < nowIso()) return null;
      return t;
    },
    async listSites(customerId) {
      return [...sites.values()].filter((s) => s.customer_id === customerId).sort((a, b) => b.updated.localeCompare(a.updated));
    },
    async findSite(siteId) { return sites.get(siteId) || null; },
    async findSiteBySlug(slug) { return bySlug.get(slug) || null; },
    async upsertSite(site) {
      sites.set(site.id, site);
      if (site.slug) bySlug.set(site.slug, site);
      return site;
    },
    async findOrderBySession(sid) { return bySession.get(sid) || null; },
    async insertOrder(order) {
      orders.set(order.id, order);
      if (order.stripe_session_id) bySession.set(order.stripe_session_id, order);
      return order;
    },
    async insertInvoice(inv) { invoices.set(inv.id, inv); return inv; },
    async listInvoices(customerId) {
      return [...invoices.values()].filter((i) => i.customer_id === customerId).sort((a, b) => b.created.localeCompare(a.created));
    },
    async seenEvent(eid) { return events.has(eid); },
    async markEvent(eid, type) { events.add(eid); return { stripe_event_id: eid, type, created: nowIso() }; },
    // test helpers
    _dump() { return { customers, sessions, tokens, sites, orders, invoices, events }; },
  };
}

function first(db, sql, args) {
  return db.prepare(sql).bind(...args).first();
}
function run(db, sql, args = []) {
  return db.prepare(sql).bind(...args).run();
}
function all(db, sql, args = []) {
  return db.prepare(sql).bind(...args).all().then((r) => (r && r.results) || []);
}

export function createD1Shop(db) {
  return {
    kind: 'd1',
    async ensure() {
      for (const stmt of SHOP_SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
        await db.prepare(stmt).run();
      }
    },
    async findCustomerByEmail(email) {
      return first(db, 'SELECT * FROM shop_customers WHERE email = ?', [String(email || '').toLowerCase()]);
    },
    async findCustomerById(cid) { return first(db, 'SELECT * FROM shop_customers WHERE id = ?', [cid]); },
    async findCustomerByStripe(sid) { return first(db, 'SELECT * FROM shop_customers WHERE stripe_customer_id = ?', [sid]); },
    async upsertCustomer(c) {
      await run(db, `INSERT INTO shop_customers (id,email,name,created,stripe_customer_id,stripe_subscription_id,plan,status)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        email=excluded.email, name=excluded.name, stripe_customer_id=excluded.stripe_customer_id,
        stripe_subscription_id=excluded.stripe_subscription_id, plan=excluded.plan, status=excluded.status`,
        [c.id, c.email, c.name || '', c.created, c.stripe_customer_id || null, c.stripe_subscription_id || null, c.plan || null, c.status]);
      return c;
    },
    async createSession(customerId, tokenHash, expires) {
      await run(db, 'INSERT OR REPLACE INTO shop_sessions (token_hash,customer_id,expires) VALUES (?,?,?)', [tokenHash, customerId, expires]);
    },
    async getSession(tokenHash) {
      return first(db, 'SELECT * FROM shop_sessions WHERE token_hash = ? AND expires > ?', [tokenHash, nowIso()]);
    },
    async deleteSession(tokenHash) { await run(db, 'DELETE FROM shop_sessions WHERE token_hash = ?', [tokenHash]); },
    async createLoginToken(email, tokenHash, expires, customerId = null) {
      await run(db, 'INSERT OR REPLACE INTO shop_login_tokens (token_hash,email,customer_id,expires) VALUES (?,?,?,?)',
        [tokenHash, String(email).toLowerCase(), customerId, expires]);
    },
    async consumeLoginToken(tokenHash) {
      const t = await first(db, 'SELECT * FROM shop_login_tokens WHERE token_hash = ? AND expires > ?', [tokenHash, nowIso()]);
      if (t) await run(db, 'DELETE FROM shop_login_tokens WHERE token_hash = ?', [tokenHash]);
      return t || null;
    },
    async listSites(customerId) {
      return all(db, 'SELECT * FROM shop_sites WHERE customer_id = ? ORDER BY updated DESC', [customerId]);
    },
    async findSite(siteId) { return first(db, 'SELECT * FROM shop_sites WHERE id = ?', [siteId]); },
    async findSiteBySlug(slug) { return first(db, 'SELECT * FROM shop_sites WHERE slug = ?', [slug]); },
    async upsertSite(site) {
      await run(db, `INSERT INTO shop_sites (id,customer_id,name,plan,status,slug,draft,spec,published_html,created,updated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, plan=excluded.plan, status=excluded.status, slug=excluded.slug,
        draft=excluded.draft, spec=excluded.spec, published_html=excluded.published_html, updated=excluded.updated`,
        [site.id, site.customer_id, site.name, site.plan, site.status, site.slug, site.draft, site.spec, site.published_html, site.created, site.updated]);
      return site;
    },
    async findOrderBySession(sid) { return first(db, 'SELECT * FROM shop_orders WHERE stripe_session_id = ?', [sid]); },
    async insertOrder(order) {
      await run(db, `INSERT OR IGNORE INTO shop_orders (id,customer_id,email,stripe_session_id,plan,kind,amount_cents,status,created)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [order.id, order.customer_id, order.email, order.stripe_session_id, order.plan, order.kind, order.amount_cents, order.status, order.created]);
      return order;
    },
    async insertInvoice(inv) {
      await run(db, `INSERT OR IGNORE INTO shop_invoices (id,customer_id,stripe_invoice_id,amount_cents,description,status,hosted_url,created)
        VALUES (?,?,?,?,?,?,?,?)`,
        [inv.id, inv.customer_id, inv.stripe_invoice_id, inv.amount_cents, inv.description, inv.status, inv.hosted_url, inv.created]);
      return inv;
    },
    async listInvoices(customerId) {
      return all(db, 'SELECT * FROM shop_invoices WHERE customer_id = ? ORDER BY created DESC', [customerId]);
    },
    async seenEvent(eid) { return !!(await first(db, 'SELECT stripe_event_id FROM shop_events WHERE stripe_event_id = ?', [eid])); },
    async markEvent(eid, type) {
      await run(db, 'INSERT OR IGNORE INTO shop_events (stripe_event_id,type,created) VALUES (?,?,?)', [eid, type, nowIso()]);
    },
  };
}

export async function shopFromEnv(env) {
  if (env && env.SHOP) return env.SHOP;
  if (env && env.BUILD_LEADS) {
    const shop = createD1Shop(env.BUILD_LEADS);
    await shop.ensure();
    return shop;
  }
  return null;
}

export function newCustomer({ email, name = '', plan = null, status = 'none' }) {
  return {
    id: id('cus'),
    email: String(email).toLowerCase().trim(),
    name: String(name || '').slice(0, 120),
    created: nowIso(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan: plan && PLAN_IDS.includes(plan) ? plan : null,
    status,
  };
}

export function newSite({ customer_id, name, plan }) {
  const slug = slugify(name) + '-' + crypto.randomUUID().slice(0, 6);
  const t = nowIso();
  return {
    id: id('site'),
    customer_id,
    name: String(name || 'My site').slice(0, 150),
    plan: plan || 'starter',
    status: 'draft',
    slug,
    draft: '{}',
    spec: null,
    published_html: null,
    created: t,
    updated: t,
  };
}

export function newOrder(fields) {
  return { id: id('ord'), created: nowIso(), status: 'paid', ...fields };
}

export function slugify(name) {
  const s = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').slice(0, 32);
  return s || 'site';
}

export { id, nowIso };
