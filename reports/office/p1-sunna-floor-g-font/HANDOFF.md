# P1 Sunna floor-G font screenshot handoff

The checkout contains no `audit.js`; the active office screenshot audit is `tools/office/playtest_gate.py`. Its screenshot calls now use [probe_screenshot.py](../../../tools/office/probe_screenshot.py), which waits up to 2 seconds for `document.fonts.ready` and then captures directly through CDP with a 15-second timeout. This avoids Playwright's screenshot font synchronization. Candidate, live, and recheck captures retain font states, font resource durations, wait time, method, total capture time, path, and bytes in the gate report.

## Evidence

- [Floor-G screenshot](after-floor-g.jpg): local 1280x720 office scene, captured through CDP after Playwright's screenshot wait timed out. The screenshot shows the existing stylized office scene; no scene or leased-lot content was changed.
- [Browser evidence](browser-evidence.json): complete run timing, font states, resource durations, screenshot bytes, and page errors.
- Local run from navigation to screenshot completed in **18,975 ms**, under the 30-second requirement. Direct CDP capture took **8,009 ms**; the bounded font readiness wait measured **3 ms**. A prior Playwright capture on the same local scene timed out after **5,000 ms** while its log said `fonts loaded`. Local font requests took **19–29 ms** each; no page errors were recorded.

## Verification

- `python3 -m py_compile tools/office/probe_screenshot.py tools/office/playtest_gate.py` — passed.
- `git diff --check` — passed.
- Pending-font fallback exercised with a fake page/CDP session — selected CDP and wrote the expected image bytes.
- A real Chromium local-office run captured floor G through CDP under 30 seconds. The Python Playwright package is unavailable in this build container, so the actual gate was not run end to end here.
- No deployment or production checks were run.
