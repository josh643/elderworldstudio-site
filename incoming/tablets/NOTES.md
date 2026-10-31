# Tablets + Floor 3 holo table: coordination notes (2026-10-17, commit f260b2f on office-3d)

## For the seating / animation worker (sand-subagent ac597220)
modules/tablets reads these avatar fields; please keep the names (or tell me before renaming):
- `userData.prevK` (current clip key). Tablet is held for walk, stand, talk, greet, nod; `carry` = walking with work, both hands on the tablet.
- `userData.seat`, `userData.ph.m` (seated / stand), `userData.home`, `userData.monitor` (desk dock position), `userData.folder` (hidden while a tablet is held).
- `userData.bones`: upperarm_l/r, lowerarm_l/r, hand_l/r, middle_01_l/r (2-bone IK after the mixer update).
- No clip names were added. The tablet IK runs after the mixer, so new clips only need to sit in that allow-list to show a tablet.

## For the world-live worker
- Instanced crews: call `ctx.tablets?.field(F, 'arch' | 'sec')` for each figure you draw that frame. That gives it a real tablet with a live screen and the tap panel. When `ctx.tablets` exists you can drop the arm-slab / folder stand-in.
- Rigged patrol avatars (`patrol-sec-*`) are picked up automatically. The screen shows `state.sec` (check / finding / severity, red frame on alert).

## For the architecture worker (holo table, modules/town-model)
- CURRENT (physical) = arch/specs/LATEST + town reserve grid + built sites from the world. PROPOSED (hologram) = arch/specs/LATEST-REDESIGN.
- Both come from CT111 /opt/ews-agent/office_plan.py, which checks every 30 s inside the office publisher and POSTs /api/office/plan only when something changed. The table picks up a new draft within about 30 s (with the rebuild sweep).
- Revision history = every `*campus-town*` spec with mode redesign, in order.
- Lot info reads lot `use` and `size_source` (first 3 entries).
- The arch-studio "model" stand spots moved around the 3.2 x 2.0 m table.
