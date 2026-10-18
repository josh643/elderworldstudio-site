import assert from 'node:assert/strict';
import { createWorldNav } from '../../site/office/core/world_nav.js';
import { lineClear, moveWithCollision, separateFromAgents } from '../../site/office/core/collision.js';
import { createAgentMovement } from '../../site/office/core/agent_movement.js';

const wall = [-0.3, -1.5, 0.3, 1.5]; wall.src = 'wall';
const nav = createWorldNav(() => [wall]);
const route = nav.route({ x: -2, z: 0 }, { x: 2, z: 0 });
assert.ok(route?.length, 'A* routes around the wall');
let from = { x: -2, z: 0 };
for (const waypoint of route) {
  assert.ok(lineClear(from, waypoint, [wall], 0.32), 'smoothed segment remains clear');
  from = waypoint;
}

const blocked = nav.route({ x: -2, z: 0 }, { x: 0, z: 0 });
assert.ok(blocked?.snapped, 'blocked destination is reported as snapped');
assert.ok(lineClear({ x: -2, z: 0 }, blocked.at(-1), [wall], 0.32));

const door = [0.9, -1, 1.1, 1]; door.src = 'dynamic-door';
const stopped = moveWithCollision({ x: 0, z: 0 }, 1, 0, [door], 0.1);
assert.ok(stopped.x <= 0.802, `closed door stops the capsule (x=${stopped.x})`);

const other = { position: { x: 0, z: 0 }, parent: {}, userData: { a: { id: 'other' } } };
const self = { position: { x: -0.5, z: 0 }, parent: {}, userData: { a: { id: 'self' } } };
const gap = p => Math.hypot(p.x - other.position.x, p.z - other.position.z);
assert.ok(gap(separateFromAgents({ x: -0.1, z: 0 }, [other], self, 0.58)) >= 0.58);
const movement = createAgentMovement({ use: () => ({ all: [self, other] }), getColliders: () => [] });
self.position = { x: -1, z: 0 };
movement.move(self, 1, 0, 0.35);
assert.ok(gap(self.position) >= 0.58 - 1e-6);

const detour = route.reduce((sum, p, i) => sum + Math.hypot(p.x - (i ? route[i - 1].x : -2), p.z - (i ? route[i - 1].z : 0)), 0);
console.log(JSON.stringify({
  routeWaypoints: route.length,
  wallDetourMeters: +detour.toFixed(2),
  blockedGoalSnapped: blocked.snapped,
  blockedGoalGap: +Math.hypot(blocked.at(-1).x, blocked.at(-1).z).toFixed(2),
  closedDoorStopX: +stopped.x.toFixed(3),
  avoidanceGap: +gap(self.position).toFixed(3),
}));
