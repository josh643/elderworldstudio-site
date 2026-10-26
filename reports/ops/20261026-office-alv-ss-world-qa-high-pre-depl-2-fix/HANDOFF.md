# HANDOFF

<!-- RUNLOG -->
**Status: FAIL; no promotion.** The gate implementation now records and returns promptly on an office document/bootstrap failure, including HTTP 404, and fails closed with the response or bootstrap error in gate.json.

## Gate run

- Candidate: https://playtest.elderworldstudio.pages.dev
- Live: https://office-3d.elderworldstudio.pages.dev
- Result: FAIL, with no candidate or live HTTP errors (zero 404s). Both /api/office/world checks returned HTTP 200.
- Joshua regression checks: all 16 recorded probes passed, including arcade and false lease-toast checks, ground-floor doorway walks, elevator-core walks on floors 2 through 5, and floor 3 reload persistence.
- Performance check: FAIL because this run used SwiftShader, not a verified pve-mini-3070. Candidate measured 2.75 FPS (samples 3, 2.75, 2.25); the 45 FPS tier requirement cannot be verified here. Both candidate and live measured 129 draw calls and 583,892 triangles in this run.
- Visual check: FAIL closed because /home/ews/bin/ct111-put is unavailable. No style or prop judgment is claimed.
- Additional warnings: isolated unreachable pockets (6.4 to 22 m2); the gate reports these as warnings.

Evidence: /tmp/20261026-office-gate-fix/out/gate.json and screenshots in /tmp/20261026-office-gate-fix/out/.

## Support needed

Rerun on the pve-mini-3070 tier and restore the approved vision transfer/judge toolchain before promotion. No contact or deployment was performed in this run.

## Verification

- Approved test.run: pytest -q — 5 passed.
- git diff --check — clean.
