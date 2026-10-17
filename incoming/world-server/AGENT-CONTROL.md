# Office agent control API (for the live-world worker / CT119 world server)

Module: `site/office/modules/world-agents/index.js` (registered after `arch-studio`, before `monitors`).
Joshua 2026-10-16: every agent becomes a live entity driven by the world server. The office does **not** tween
server positions. It turns each pose into a target for its own walk/seat system, so:

- Agents walk along the room routes (around desks, through doorways) at the walk clip's measured ground speed
  (1.29 m/s male, 1.24 female, scaled by height). The playback rate follows the actual speed, so feet don't slide. `v` is ignored.
- Agents turn to face where they're going and blend idle → walk → stand → sit-in → seated.
- y is always 0, so nobody hangs in mid-air.
- Agents only sit in **their own reserved chair** (`core/chairs.js` owner lock). If that chair is held, they wait in the aisle.
  Nobody else's chair is ever used, and every chair takes one agent.

## Entry points
In-page: `ctx.use('agentControl')` (or `ctx.agentControl`). From the console/CDP: `window.__ewsOffice.agents`.

| call | effect |
|---|---|
| `apply(poses)` | One DELTA-SCHEMA v1 `agent.pose` batch: `[{id, zone, x, z, h, act, to?, v?, lot?}]`. Returns how many agents it matched. |
| `moveTo(id, {zone, x, z, h})` | Walk to that zone-local point and stand there facing `h` (radians, 0 = +z). If the agent is seated, it stands up first. |
| `sit(id)` | Walk to the agent's own chair, then sit-in, tuck and work (the clip follows the live stage). |
| `stand(id)` | Untuck, sit-out, and stand in the aisle beside the chair. |
| `release(id)` / `gone(id)` | Hand the agent back to the office's room logic. |
| `state(id)` | `{id, act, server, p, ry, phase, seat, clip}` for checks. |

`id` can be `agent:<id>` or `<id>` (roster id, e.g. `game-coder`, `lead-arch`).

## How `act` maps
- `desk`: `sit(id)`. x/z are ignored, because the seat is the agent's own chair.
- `walk`: `moveTo` to `to` (`{zone,x,z,h}`) if present, else to `x,z`.
- `idle`: `moveTo(x,z,h)`, then stand.
- `meet`: `moveTo(x,z,h)`, then the talk clip on arrival.
- `field`, `away`, or `zone:'town'`: the agent is out of the building. The office avatar is parked unseen at its desk
  (no duplicate person). Your world-live field figure shows them outside.

## Zones (zone-local → world)
- `team:<key>`: that team's room centre (`ctx.teamSpot[key]`, from team-halls). `team:architecture` is the Floor 3 studio centre (`ctx.archStudio`).
- `lobby`: the lobby centre (`ctx.lobbyAt`).
- `town`: the exterior frame (`ctx.town.X0/Z0`, the lobby entrance centre, +z away from the building; same as spec.json master.frame).

## Ownership and timeout
While an agent has a pose less than 90 s old, team-halls wandering and arch-studio stage placement leave it alone. The
live state feed still drives its desk screen and seated work clip. With no pose for 90 s, the agent goes back to the room logic.
Please send a keepalive pose (the 30 s keepalive in DELTA-SCHEMA is enough) for agents you want to keep.

## Hookup
In world-live, call this for each `agent.pose` message:
`ctx.use('agentControl')?.apply(msg.poses)`, and on `agent.gone`: `ctx.use('agentControl')?.gone(msg.id)`.
Verified locally: `game-coder` was sent a `walk` pose. He untucked, sat out, walked the side lane and stood at the
point. A `desk` pose then brought him back to his own chair (sit-in → tuck → seated). seatAudit showed 0 duplicate holders and 0 seated-without-chair.
