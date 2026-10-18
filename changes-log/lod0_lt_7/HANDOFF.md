# `lod0_lt_7` fix validation

## Change

`site/office/modules/base-avatar/index.js` now selects a global wardrobe-rig budget of 6 on tier 0 and 12 on other tiers. Only the nearest selected rigs render as skeletons; excess rigs continue through the existing instanced pawn path. LOD0 selection now uses a fixed 7 m radius, independent of the adaptive `ctx.lod` scale. The audit counts visible LOD0 rigs that are actually inside 7 m.

## Before and after

Captured locally at 1280×720 with Chromium/SwiftShader, `?office=1&chars=all`, tier 0, LOD scale 1, and the camera at `(392, 1.6, -8)` looking toward `(392, 1.2, -13)`. Both shots show the same team-games hall.

| Metric | Before | After |
| --- | ---: | ---: |
| Visible wardrobe rigs | 8 | 6 / 6 budget |
| `lod0_lt_7` | 4 | 4 (inside the fixed 7 m radius) |
| Draw calls | 68 | 68 |
| Triangles | 162,776 | 159,842 |

Triangles fell by 2,934 in this view. Draw calls were unchanged. The screenshots are [before](fix-before-team-games.png) and [after](fix-after-team-games.png).

## Leased content check

Only the avatar renderer source and this evidence log/screenshots changed. No lot definitions, world layout, signage, or client data were edited. SHA-256 hashes match HEAD for `site/office/data/site.json` (`94ada4f8…db88`), `site/office/data/roster.json` (`f14d8e83…3dc6d`), and `site/office/modules/world-live/index.js` (`1d2c28fa…8904c`).

## Validation limits

- `node --input-type=module --check` passed for `site/office/modules/base-avatar/index.js`.
- `git diff --check` passed.
- The site rendered in local Chromium and the before/after scene metrics were collected through `__ewsOffice.lodAudit()` and `__ewsOffice.info()`.
- The local static server does not host the Pages Functions; local `/api/office/world` and `/api/office/state` requests returned 404, so the world API was not validated in this run.
- The local static server uses SwiftShader; it cannot establish 45+ FPS on the pve-mini-3070. That hardware FPS check remains outstanding.
- No deployment was performed, so the post-deploy `/api/office/world` curl was not run.
