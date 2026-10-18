# Sunna day/night engine handoff

Status: implementation ready for QA review. No deployment was performed.

## Changes

- `site/office/core/daynight.js` now walks the scene while pruning subtrees marked with `userData.a`, which are agent/avatar branches without day/night materials. It reports visited scene nodes, pruned branches, updated materials, and elapsed apply time in `ctx.dayNight` for QA evidence.
- `site/office/core/engine.js` bumps the day/night module URL from `?v=2` to `?v=3` so browsers load the changed module.
- The tracked diff contains only those two engine files. No leased-lot or client content files changed.

## Screenshots

No prior screenshots were present in the checkout. The `before-*` captures were taken from the unmodified checkout immediately before editing; `after-*` captures use the same local server, browser, time override, and viewports.

- Before: [390×844](before-390x844.png), [1440×900](before-1440x900.png)
- After: [390×844](after-390x844.png), [1440×900](after-1440x900.png)
- Night look: [1440×900](night-after-1440x900.png)
- Lighthouse report: [lighthouse.json](lighthouse.json)

The lobby remains visible in both viewport pairs. Browser checks found no page errors and no horizontal overflow (390/390 px and 1440/1440 px). At noon, the final mobile and desktop runs reported 41 `userData.a` branches pruned, 12 day/night materials updated, and 0.8 ms apply time. The midnight run reported `look: night`, sun elevation −62.5°, the same 12 updated materials, and 0.7 ms apply time with no page errors. The 41 count is a traversal counter, not a validated active-rig cap.

## Verification and limits

- `node --check site/office/core/daynight.js` and `node --check site/office/core/engine.js`: passed.
- `node tools/world-lease-selftest.mjs`: passed all eight protection checks, including refusal of agent edits to a leased lot.
- `git diff --check`: passed.
- Linkinator: passed, 6 links scanned.
- Lighthouse: accessibility 100; performance 52 (target 80). The screenshot browser uses SwiftShader/software rendering and reported 1–3 fps at tier 0, so these runs do not establish the 45+ fps target on `pve-mini-3070`.
- No package build/test scripts are present. `tools/build.py` regenerates public static pages and was not run because this change is an office module and the task requires byte-identical client content.
- The live leased-lot dataset is not in this checkout. The repository diff confirms other tracked content is unchanged, but it cannot prove byte identity of the external leased lot. No world endpoint was queried. QA needs the approved LEASED LOT analysis before asserting that acceptance check.
- No deployment checks were run: deployment is prohibited for this stage. The `wantRig_lt_12` hardware/source gate still needs QA clarification against the avatar branch count and a real `pve-mini-3070` run.

## QA next steps

Run the approved read-only LEASED LOT analysis and the office performance gate on `pve-mini-3070`. Confirm whether `wantRig_lt_12` means a limit on active rigs or on the day/night traversal; this patch prunes avatar branches from that traversal but does not change the character rig population.
