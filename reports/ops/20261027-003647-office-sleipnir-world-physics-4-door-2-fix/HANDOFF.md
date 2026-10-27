# [office] fix: Sleipnir world-physics doors

<!-- RUNLOG -->
## Summary

Made the B1 client gate fail closed unless `/api/office/b1/access` returns HTTP 200 with `{allowed: true}`; updated the receptionist import version so browsers fetch the changed floor code. Added a route-level regression test for B1 allow/deny and KV attempt logging.

## Verification

- Approved `test.run`: `python3 -m subroutines run test.run --json '{"repo":"elderworldstudio-site","agent":"coder"}'` — **3 passed**.
- The B1 handler was exercised with in-memory KV: the unauthorized request returned HTTP 403, set `b1:seen` to an `ok:false` attempt, and added an `access` record to `b1:denied`; an allowlisted request returned HTTP 200.
- Door interaction screenshots: [before](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/door-before.png), [after](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/door-after.png), and [B1 denied](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/b1-denied.png). Existing local playtest log covers ground and floors 2–5; the B1 API test uses a mock KV, not live KV.
- `git diff --check` was clean. No pve-mini-3070 FPS measurement was run; no deployment was performed.
