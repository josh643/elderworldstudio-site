// Offline self-test (no network): schema clean/apply parity + construction never runs ahead of real progress + agents reach desks.
import assert from 'node:assert';
import { applyEvent, clean, World, BUILD } from './schema.js';
import { Construction } from './construction.js';
import { Agents, deskOf } from './agents.js';
const w: World = { seq: 0, ents: {} }, sent: any[] = [];
assert.equal(clean({ type: 'lot.lease', lot: 2.5 }, false), null);
assert.equal(clean({ type: 'agent.pose', poses: [] }, false), null);
assert.ok(clean({ type: 'agent.pose', poses: [{ id: 'coder', zone: 'team:games', x: 1, z: 2, h: 0, act: 'walk' }] }, true));
const c = new Construction(w, e => sent.push(e)); c.lease({ lot: 5, tenant: 'Test', public: true, real: 0 });
c.report('lot:5', 0.3); let t = Date.now(); for (let i = 0; i < 200; i++) { c.tick(t += 2000); assert.ok(c.jobs['lot:5'].shown <= 0.3 + 1e-9); }
assert.ok(Math.abs(c.jobs['lot:5'].shown - 0.3) < 1e-6); assert.equal(BUILD[w.ents['lot:5'].si], 'foundation');
c.report('lot:5', 1); for (let i = 0; i < 100; i++) c.tick(t += 2000); assert.equal(w.ents['lot:5'].si, BUILD.length - 1); assert.ok(c.jobs['lot:5'].done);
const ws: World = { seq: 0, ents: {} }; for (const ev of sent) applyEvent(ws, ev, 0); assert.equal(ws.ents['lot:5'].si, w.ents['lot:5'].si, 'replayed deltas match server state');
const a = new Agents('', ''); a.sims.coder = { id: 'coder', team: 'games', zone: 'team:games', slot: 2, x: 4, z: 4, h: 0, act: 'idle', to: null, goal: 'idle', lot: null, waitUntil: 0, dirty: true, lastSent: 0 };
a.work.coder = { agent: 'coder', task: 'Fix the bug' }; for (let i = 0; i < 30; i++) a.tick(1);
assert.equal(a.sims.coder.act, 'desk'); assert.deepEqual([a.sims.coder.x, a.sims.coder.z], deskOf(2));
console.log('selftest PASS');
