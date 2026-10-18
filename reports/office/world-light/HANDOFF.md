# World-light build handoff

Implemented Sunna’s lighting station at her existing B1 roster post. She now faces a compact read-only console showing the shared day/night look, time, sun elevation, and local FPS when available. The screen refreshes at most once per second and uses emissive materials without adding real-time lights or animation. B1 imports were versioned to `v=4`.

## Evidence

- Before: [before.png](before.png)
- After: [after.png](after.png)
- In an isolated Playwright render of the checked-in B1 builder and roster, the `world-light` probe reported position `(-8, 0, 13)` and yaw `1.57`. Changing the mocked shared state from day to dusk updated the probe to `dusk`, `19:12`, and `-2.4°`; browser page errors: `0`.
- The same isolated render measured `41` draw calls / `1,070` triangles before and `45` / `1,108` after (`+4` calls, `+38` triangles). The harness used simple mock avatars and disabled network requests; these measurements are scene-level evidence, not pve-mini-3070 FPS results.

## Verification and remaining QA

- ES module syntax checks for `site/office/b1/b1.js`, `site/office/core/floors.js`, `site/office/modules/receptionist/index.js`, and `site/office/modules/tablets/index.js`: passed.
- `python3 -m json.tool site/office/data/roster.json`: passed.
- `git diff --check`: passed.
- No `package.json` or repo build command was found. The staging playtest gate and pve-mini-3070 run were not run: this build stage does not deploy, and the isolated mock does not verify the restricted B1 experience or target-device frame rate. Run those checks through the authorized office QA pipeline before promotion.
