# HANDOFF

<!-- RUNLOG -->

## Summary

Added proximity driven sliding leaves and moving collision rectangles for the ground elevator and floors 2–5. Removed the static center post and moved the lobby call button beside the passage; registered actual door meshes as click targets. B1 remains server guarded, and the client checks the access endpoint each time and shows the locked state on denial.

## Verification

- Approved test routine: `python3 -m subroutines run test.run --json '{"repo":"elderworldstudio-site","agent":"coder"}'` — `2 passed`.
- Local browser collision probe: G, 2, 3, 4, and 5 each had two moving door colliders and allowed a walk through 0.55 m beyond the doorway. Details: [all-door-playtest.log](all-door-playtest.log).
- B1 HTTP 403 mock displayed the restricted message and client denial log. The endpoint records seen attempts and denied attempts in KV (`functions/api/office/b1/[[op]].js:20-24`); live KV was not exercised.
- Before/after and denied-state images: [door-before.png](door-before.png), [door-after.png](door-after.png), [b1-denied.png](b1-denied.png).
- `git diff --check` clean. The local preview used SwiftShader; the pve-mini-3070 45+ FPS target was not measured.

