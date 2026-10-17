// node tools/world-lease-selftest.mjs : leased-lot protection selftest (Joshua hard rule 2026-10-17)
import { leaseGuard } from '../workers/office-limiter/world.js';
import { clean } from '../functions/api/office/world-event.js';
const w = { ents: { 'lot:5': { id: 'lot:5', kind: 'site', lot: 5, leased: true, tenantId: 'capbar' }, 'lot:11': { id: 'lot:11', kind: 'site', lot: 11, arch: true } } };
const t = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok', m); };
t(leaseGuard(w, { type: 'site.progress', lot: 5, overall: 0.5 }), 'agent progress on leased lot refused');
t(leaseGuard(w, { type: 'lot.lease', lot: 5, tenant: 'X', style: {} }), 'agent re-lease/restyle of leased lot refused');
t(leaseGuard(w, { type: 'lot.release', lot: 5 }), 'agent release of leased lot refused');
t(!leaseGuard(w, { type: 'site.progress', lot: 5, overall: 0.5, lease_ok: true }), 'client/owner-authorized edit allowed');
t(!leaseGuard(w, { type: 'site.progress', lot: 11, overall: 0.1 }), 'unleased arch lot still workable');
t(leaseGuard(w, { type: 'lot.lease', lot: 20, leased: true, tenantId: 'x' }), 'agents cannot create a client lease');
t(!leaseGuard(w, { type: 'agent.pose', poses: [] }), 'agent poses unaffected');
const c = clean({ type: 'site.progress', lot: 5, overall: 0.2, lease_ok: true }); t(c && !('lease_ok' in c), 'clean() strips forged lease_ok');
console.log('lease selftest OK');
