# Sunna world audit: patrol rig demand

## Findings

The `wantRig_lt_12` pattern had one executable instance in `site/office/modules/world-live/index.js` (patrol rendering, formerly line 436): `dc < 12` requested a full rig for a nearby patrol and hid the instanced patrol figure. No other `wantRig` condition or `dc < 12` rig-demand condition was found in the codebase outside vendored files.

The 12 m cutoff did not track the avatar animator's quality-scaled limits in `site/office/modules/base-avatar/index.js`: a rig is visible within `15 * max(0.8, LOD)` but its mixer receives regular updates only within `16 * LOD`. At LOD 0.5, those limits are 12 m and 8 m. A moving patrol 8–12 m away could therefore have its pawn hidden while its rig's walk animation only received rare off-screen updates.

## Fix

The patrol rig limit is now the intersection of those two avatar limits. This keeps a full rig in use at distances where its pose is animated and visible, while the existing instanced pawn remains the fallback outside the limit. The isolated policy is in `site/office/modules/world-live/patrol-rig-policy.js` and is used by the patrol demand check in `world-live/index.js`.

Examples across the engine's LOD range: LOD 0.5 → 8 m; 0.8 → 12 m; 1.0 → 15 m. Rig demand remains strict (`distance < limit`), and remains disabled below LOD 0.5.

## Validation

- Policy boundary checks passed for LOD 0.5, 0.8 and 1.0, including just-inside, exact-limit and just-outside distances.
- JavaScript syntax checks and `git diff --check` passed.
- `python3 tools/build.py` exited successfully and generated 19 HTML files; no unrelated tracked files changed.
- Local browser preview rendered the office at 390×844 (touch emulation) and 1440×900 with zero page errors and no horizontal overflow. Screenshots: `/tmp/sunna-390.png` and `/tmp/sunna-1440.png`.
- The static preview has no office API backend: `/api/office/*` requests returned 404, so this run did not exercise live patrol snapshots. No remote staging deploy occurred. A live staging world pass and sustained 45+ FPS measurement on pve-mini-3070 remain for pipeline QA.
- Lighthouse and Linkinator were not installed in this checkout environment; no dependency installation was attempted. The repo has no package manifest or office build/test scripts.
