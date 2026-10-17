// node tools/layout-approve-selftest.mjs : unit checks for the DO's Odin layout-approval guard (approveCheck)
import { approveCheck } from '../workers/office-limiter/world.js';
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok', m); };
const w = { ents: { 'lot:7': { id: 'lot:7', lot: 7, leased: true, tenantId: 'acme' } } };
const good = { id: 'S1', verdict: 'PASS', genuine: true, lots: [{ n: 7, rect: [0, 0, 10, 10], tenant: 'acme' }] };
ok(approveCheck(w, null, 'S1') !== null, 'unregistered spec refused');
ok(/PASS/.test(approveCheck(w, { ...good, verdict: 'FAIL' }, 'S1')), 'Ve FAIL refused');
ok(/genuine/.test(approveCheck(w, { ...good, genuine: false }, 'S1')), 'non-genuine refused');
ok(/LATEST/.test(approveCheck(w, good, 'S0')), 'not-latest refused');
ok(/moves/.test(approveCheck(w, good, 'S1', { 7: [0, 0, 12, 10] })), 'moved/resized leased lot refused');
ok(/reassigns/.test(approveCheck(w, { ...good, lots: [{ n: 7, rect: [0, 0, 10, 10], tenant: 'other' }] }, 'S1')), 'reassigned leased lot refused');
ok(/missing/.test(approveCheck(w, { ...good, lots: [] }, 'S1')), 'dropped leased lot refused');
ok(approveCheck(w, good, 'S1', { 7: [0, 0, 10, 10] }) === null, 'passing spec accepted');
