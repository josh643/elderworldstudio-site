# Lake water shader fix

<!-- RUNLOG -->
## Change
Fixed the three lake shader fades that used descending `smoothstep` edges. The replacement increasing-edge expressions preserve the intended low-reflection and shoreline fade while avoiding undefined GLSL behavior. Normal-map sampling, Fresnel reflection, and single-mesh water remain unchanged.

## Verification
- Approved `test.run`: `python3 -m unittest discover -s tests -v` — 2 tests passed.
- Local Chromium render at 1280×720 with `?time=13:00&xtier=2`: captured the lake after the fix. No shader compilation error appeared. The static-only local server logged missing API/WebSocket routes.
- Current lake capture: `reports/ops/20261026-090137-office-sunna-world-light-lake-water-1-fix/screenshots/lake-after.png`.
- Responsive captures: `screenshots/office-390.png` and `screenshots/office-1440.png`; both loaded, had no shader errors, and had no horizontal overflow.
- Matched comparison from the build stage: `reports/ops/20261026-090137-office-sunna-world-light-lake-water-0-build/screenshots/lake-before.jpg` and `lake-after.jpg`.

## Performance and visual QA
The pve-mini-3070 benchmark was not run: this environment has no `/dev/dri` device and `nvidia-smi` is unavailable. The prior build handoff recorded 3.02/3.04 FPS under local SwiftShader and explicitly says this is not target-device evidence. Therefore the required 45+ FPS acceptance gate remains unverified, and asset/reflection QA on the target device remains for the office QA stage.

## Pre-flight
- Working tree contains source, regression-test, screenshot, and handoff changes.
- `git diff --check`: clean before handoff.
