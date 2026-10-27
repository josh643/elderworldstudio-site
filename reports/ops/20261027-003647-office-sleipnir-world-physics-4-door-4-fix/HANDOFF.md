# Office doors and lake render fix

<!-- RUNLOG -->
## Summary

Reduced the exterior tree 3D LOD distance bands to target the reported lake render cost while retaining detailed meshes near the player. Tiers now switch to the baked 8-angle atlas beyond 22 m, 28 m, and 40 m respectively. Bumped the exterior import version so browsers fetch the updated module. The door and B1 implementation from the prior stage is retained.

## Verification

- Approved test routine: `python3 -m subroutines run test.run --json '{"repo":"elderworldstudio-site","agent":"coder"}'` — **3 passed**.
- Node module syntax checks passed for `site/office/core/exterior.js` and `site/office/core/engine.js`.
- `git diff --check` is clean.
- Reviewed existing door evidence: [before](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/door-before.png), [after](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/door-after.png), [B1 denied](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/b1-denied.png), [door playtest log](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/all-door-playtest.log), and [access attempt log](../20261027-003647-office-sleipnir-world-physics-4-door-0-build/access-attempt.log). The existing log records passage checks on G and floors 2–5, plus the mocked HTTP 403 denial state.
- The local static preview did not expose `window.__ewsOffice` within 60 seconds, so I did not capture post-change draw-call/triangle counts. No pve-mini-3070 FPS measurement was run. The next QA check must confirm the lake metrics; the prior reported values were 69 draw calls and 488,895 triangles against a 47 / 142,852 baseline.
