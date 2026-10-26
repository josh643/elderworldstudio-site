# Office playtest gate fix and support findings

<!-- RUNLOG -->
## Goal
Fix the office pre-deploy playtest gate so HTTP failures and incomplete visual coverage cannot pass, while retaining Joshua regression checks.

## Changes
- Candidate and live HTTP errors now both block PASS; live-side errors are no longer treated as nonblocking debt.
- All eight required candidate and live screenshots are required. Missing views now produce a visual_coverage failure, including the formerly silent empty-view case.
- Existing Joshua walks, arcade and false-lease probes, floor 3 reload check, style rules, and pve-mini-3070 FPS floor remain in place.

## Gate rerun
Command: /opt/ews-agent/pwenv/bin/python tools/office/playtest_gate.py https://playtest.elderworldstudio.pages.dev --live https://office-3d.elderworldstudio.pages.dev --out /tmp/ews-office-gate-4/out --state-dir /tmp/ews-office-gate-4/state --no-file
Result: FAIL, correctly fail-closed.
- Candidate and live HTTP errors: zero; both /api/office/world checks returned HTTP 200.
- Candidate and live captured all eight required views: lobby, lobby-left-door, g-stairs, f3-core, f2-hall, front-road, front-lawn, gate.
- All 16 Joshua regression probes passed, including doorway and elevator-core walks on floors 2 through 5; floor 3 reload state passed.
- Performance could not be verified on the required tier: SwiftShader measured 2.75 FPS, with 129 draw calls and 583,892 triangles for candidate and live.
- Vision judgment failed closed because ct111-put is unavailable (ENOENT); no visual PASS is claimed.
- Seven small unreachable-pocket warnings remain, between 6.4 and 22 m2.

Gate report: /tmp/ews-office-gate-4/out/gate.json
Screenshots: /tmp/ews-office-gate-4/out/ and /tmp/ews-office-gate-4/out/live/
Support needed from world-ops: rerun on the pve-mini-3070 tier and restore the approved CT111 transfer/gatejudge toolchain, then rerun the gate. No direct contact or deployment was performed; this handoff records the support request.

## Verification
- Approved test.run: 6 passed in 0.09s.
- git diff --check: clean.
