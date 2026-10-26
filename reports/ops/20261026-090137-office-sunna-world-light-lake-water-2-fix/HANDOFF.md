# Lake water shader performance follow-up

<!-- RUNLOG -->
## Change
Removed the second normal-map texture lookup from the high-quality lake shader. Each tier now samples the shared normal map once; higher tiers keep their analytic wave detail. The normal still perturbs the Fresnel reflection normal.

## Verification
- Approved `test.run`: `python3 -m pytest -q` — **2 passed**.
- Local Chromium render at 1280×720, `?xtier=2&time=13:00`, camera `(-12, 5, 65)` toward `(-12, 0, 38)`: loaded successfully and reported no page or shader errors.
- After screenshot: `reports/ops/20261026-090137-office-sunna-world-light-lake-water-2-fix/screenshots/lake-after.png`.
- Comparison before: `reports/ops/20261026-090137-office-sunna-world-light-lake-water-0-build/screenshots/lake-before.jpg`.
- Local animation-frame sample: **1.18 FPS** with Chromium forced to SwiftShader. This is software rendering and does not measure the pve-mini-3070 target.
- Target hardware validation was unavailable: `/dev/dri` is absent and `nvidia-smi` is unavailable. The 45+ FPS acceptance gate and target-device floating-asset/reflection QA remain unverified. No target result is claimed.

## Pre-flight
- `git status --short`: source, regression test, screenshot, and this handoff are changed/new.
- `test.run`: passed, 2 tests.
- `git diff --check`: clean before handoff.
- Visual evidence: the before and after screenshot paths above. Local render had no page or shader errors; target-device scene QA was not run.
