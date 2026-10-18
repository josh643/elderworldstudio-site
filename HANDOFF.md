# Office character performance fix handoff

**Status: QA FAIL; no safe fix for the reported world-gate failures was verified.**

The character asset audit passes: the shared atlas is **512×512**; maximum outfit budgets are **3,739 triangles** at LOD0 and **2,130** at LOD1, under the **15,000** cap. Runtime character LOD is configured in [index.js](site/office/modules/base-avatar/index.js#L249): detail switches at 6.5/7.5 m with 1 m hysteresis, and the instanced pawn cutoff is 45 m. The no-pop-in appearance was not independently measured.

The prior QA report's lobby and lake failures remain unresolved. The local lobby screenshot (`/tmp/office-current.png`) shows walls and a roof; no unfinished lobby geometry was reproduced. The local lake run measured **141 draw calls / 428,215 triangles**, but is not directly comparable to the QA run (**68 / 488,823**). The local static server returns **HTTP 404** for `/api/office/world?op=state`, so the supplied office gate cannot verify the candidate against its world API. The lake screenshot is `/tmp/office-lake-before.png`. These failures concern world geometry/rendering and need a valid gate run plus scoped world-owner review before a render change can be verified.

## Verification

- `python3 tools/characters/check_budgets.py` — PASS; metrics above.
- JavaScript module syntax checks and `git diff --check HEAD^ HEAD` — PASS.
- Browser screenshots at 390×844 and 1440×900 — no page errors or document horizontal overflow; screenshots are `/tmp/sv-office-390.png` and `/tmp/sv-office-1440.png`.
- Linkinator — PASS, 6 local links scanned.
- Lighthouse — performance **55**, accessibility **100**; performance is below the 80 target (local static server, no world API).
- No `package.json` or repository build/test script is present; no build or test suite was run. The office gate was not run because its local world API is unavailable.
