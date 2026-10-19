# Nerthus world exterior sign visibility fix

Status: booth position adjusted; visual screenshots are available from the inherited build-stage correction. The current local browser run did not reach the office QA hooks, so this report does not claim a fresh gate pass.

## Change and measurement

In [exterior.js](/var/lib/ews-agent/work/20261018-020017-office-nerthus-world-exterior-playte-1-fix/site/office/core/exterior.js:413), the guard booth center moved from `X0 - 4.6` to `X0 - 6.5`. The sign is centered at `X0 + 9` and is 7.4 m wide, so its left edge is `X0 + 5.3`. The booth is 2.1 m wide, putting its right edge at `X0 - 5.45` and leaving **10.75 m** of lateral clearance. The prior booth position at `X0 + 4.6` extended 0.35 m across the sign's left edge.

## Before and after screenshots

These captures were committed by the previous build stage. They show the original obstruction and the corrected sign from front and reverse views; its after position was `X0 - 4.6`. This fix moves it another 1.9 m farther left, increasing the measured clearance above.

- [Before: gate view with booth obstructing the sign](20261018-020017-office-nerthus-world-exterior-playte-0-build/before-gate.png)
- [After: gate view](20261018-020017-office-nerthus-world-exterior-playte-0-build/after-gate.png)
- [After: reverse view](20261018-020017-office-nerthus-world-exterior-playte-0-build/after-gate-reverse.png)
- [After: desktop view](20261018-020017-office-nerthus-world-exterior-playte-0-build/after-gate-desktop.png)
- [After: mobile view](20261018-020017-office-nerthus-world-exterior-playte-0-build/after-gate-mobile.png)

## Verification

- `node --input-type=module --check < site/office/core/exterior.js` — passed.
- `git diff --check` — passed.
- Position/footprint calculation — 10.75 m sign-to-booth edge clearance.
- No `package.json` or repository build/test entry point was present, so a project build/test was not run.
- Fresh local Playwright capture — not completed: the page loaded office assets but did not expose `window.__ewsOffice` within 180 seconds. The remote playtest gate was not run; this stage does not deploy.
