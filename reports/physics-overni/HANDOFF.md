# Office world physics fix handoff

## Changes

- A* now counts settled cells rather than duplicate priority-queue entries against its search bound, so duplicate heap records cannot terminate an otherwise valid route early.
- A blocked near-target now ends at the nearest clear waypoint. A failed or blocked route no longer appends the obstructed destination or subsequent path legs, preventing an agent from trying to walk through the obstacle.
- When a stair/elevator path needs replanning after a blocked step, the remaining waypoints retain their explicit floor handoffs instead of collapsing to a straight route to the final floor coordinate.
- The diagnostic state records whether the destination was blocked or no clear route was found.

Files changed: `site/office/core/world_nav.js`, `site/office/modules/base-avatar/index.js`.

## Verification

- Reproducible fixture passed: `node --experimental-default-type=module reports/physics-overni/fixture-check.mjs`. A* produced a four-waypoint detour around an expanded wall; each smoothed segment passed `lineClear`; a blocked destination was safely snapped (0.87 m from the blocked target); collision stopped a capsule at x=0.798 m before a closed door; avoidance + separation left 0.65 m between agents against a 0.58 m minimum.
- JavaScript syntax checks for both changed modules passed. `git diff --check` passed.
- The baseline local browser run captured in [runtime.json](runtime.json) exposed the floor-handoff loss: the stair trip remained on floor G and attempted a route from `(-1.86, -10.26)` to `(385.4, -6.1)` after replanning. The replan now preserves remaining handoff waypoints. This browser run predates the fix and is diagnostic evidence, not a post-fix pass.
- Visualized the deterministic fixture results in [nav-collision-check.svg](nav-collision-check.svg). This is a fixture diagram, not a screenshot from the office renderer. [stairs-start.png](stairs-start.png) records the incomplete dark browser view and is not evidence of a completed stair traversal.
- The local static server returned 404 for `/api/office/world` and `/api/office/state`. The captured SwiftShader rate was 1.12 FPS and the entrance test ended before crossing; this is not a PVE-tier performance result. Therefore post-fix stair/ramp transitions, door opening in the rendered scene, 390×844 / 1440×900 screenshots, link checks, and 45+ FPS on pve-mini-3070 remain unverified. No deployment was performed.

## QA follow-up

Run the office scene on pve-mini-3070 and capture the stairs, ramp/landing, and entrance door transitions. Confirm agents move between floors without midair/stuck states and record sustained FPS at or above 45 before promotion.
