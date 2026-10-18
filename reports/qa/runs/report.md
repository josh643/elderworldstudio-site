# P0 Sunna LOD handoff

## Change

The requested `src/character/design/lod0_lt_7.js` path is not in this checkout. The equivalent distance LOD logic is in `site/office/modules/base-avatar/index.js`. The `origin/office-3d` baseline already uses the intended 7 m LOD0, 15 m rig, and 34 m pawn boundaries. An older sibling task ref (`d6b7be1`) widened these to 34/70/100 m; those limits are not present on this branch and were not brought in.

| Before | After |
| --- | --- |
| LOD0 `< 7 m`; rig render cutoff `15 m`; pawn cutoff `34 m`. Normal skeleton work and tags could continue to `16 m`, beyond the visible rig. | LOD0 `< 7 m`; rig render cutoff `15 m`; pawn cutoff `34 m`. The same visibility decision now controls rig rendering, tags, and progress; normal skeleton updates are capped at the smaller of the visible range and the former update range. |

This removes the extra normal update range for hidden rigs and does not increase update work at LOD scales 0.5, 0.8, 1, or 1.5. Off-screen rigs retain the existing periodic state update.

## Evidence

- `node tools/office/lod0-lt-7-selftest.mjs` passed. It locks the 7/15/34 m cutoffs, checks their boundary behavior, and asserts the normal update range cannot exceed the former range.
- `node --input-type=module --check < site/office/modules/base-avatar/index.js`, `node --check tools/office/lod0-lt-7-selftest.mjs`, and `git diff --check` passed.
- Browser character lineup loaded both LOD modes with zero page or console errors. Runtime mesh counts were 3,144–3,679 triangles for LOD0 and 1,589–1,981 for LOD1.
- [LOD0 (<7 m) lineup screenshot](lod0-under-7m.png) and [LOD1 (7–15 m) lineup screenshot](lod1-7-to-15m.png) were captured at 1440×900. The LOD1 screenshot shows stretched facets in the existing mesh; this patch does not modify character geometry.
- Linkinator scanned the local character QA page and passed (1 link). Lighthouse did not produce a result: it stopped with `NO_FCP` on this canvas-only QA page. No repository package/build script is present.

## Remaining verification

No pve-mini-3070 FPS run was available, so 45+ FPS is not claimed. A human should review the pre-existing LOD1 mesh artifact and run the target-device FPS check before promotion. No deployment was performed.
