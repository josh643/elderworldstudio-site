# Lake water shader benchmark

## Change

`site/office/core/exterior.js` now generates one repeating 128×128 tangent-space normal tile per exterior build. The lake shader samples it once at every quality tier and samples a second scrolling scale when `WAVES4` is enabled. The decoded slopes perturb the normal used by the existing Fresnel sky, sun, moon, and lamp/building reflection response. This adds no render pass and keeps the water as one mesh/draw call.

## Visual comparison

Matched local captures use Chromium at 1280×720, `?time=13:00&xtier=2`, camera `(-12, 5, 65)` aimed at `(-12, 0, 38)`. The before image uses the checkout's original shader; the after image uses the normal-mapped shader.

- Before: `screenshots/lake-before.jpg`
- After: `screenshots/lake-after.jpg`
- Observed: fine, moving normal-map ripples break up the formerly smooth surface; the reflected sky and existing glint response remain visible. No shader compilation error was observed.

## Performance measurements

| Run | Renderer and view | FPS | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: |
| Before | local Chromium SwiftShader, 1280×720, exterior override tier 2 | 3.02 | 145 | 557,585 |
| After | local Chromium SwiftShader, 1280×720, exterior override tier 2 | 3.04 | 145 | 557,585 |

Each FPS sample counted animation frames for about 4 seconds. The low result reflects this full exterior's software-rendered test environment and is not an estimate of GPU performance. The requested pve-mini-3070 45+ FPS benchmark was **not run**: this checkout has no attached GPU device (`/dev/dri` is absent and `nvidia-smi` is unavailable). Do not treat the local SwiftShader result as a pass for that target; the office QA stage must run the target-device benchmark and confirm reflections/assets there.

## Regression test

`python3 -m unittest discover -s tests -v` checks the sampled normal map reaches the normal used by Fresnel reflections, with the second sample gated to the higher quality shader variant.

<!-- RUNLOG -->
# Lake water shader benchmark

## Change

`site/office/core/exterior.js` now generates one repeating 128×128 tangent-space normal tile per exterior build. The lake shader samples it once at every quality tier and samples a second scrolling scale when `WAVES4` is enabled. The decoded slopes perturb the normal used by the existing Fresnel sky, sun, moon, and lamp/building reflection response. This adds no render pass and keeps the water as one mesh/draw call.

## Visual comparison

Matched local captures use Chromium at 1280×720, `?time=13:00&xtier=2`, camera `(-12, 5, 65)` aimed at `(-12, 0, 38)`. The before image uses the checkout's original shader; the after image uses the normal-mapped shader.

- Before: `screenshots/lake-before.jpg`
- After: `screenshots/lake-after.jpg`
- Observed: fine, moving normal-map ripples break up the formerly smooth surface; the reflected sky and existing glint response remain visible. No shader compilation error was observed.

## Performance measurements

| Run | Renderer and view | FPS | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: |
| Before | local Chromium SwiftShader, 1280×720, exterior override tier 2 | 3.02 | 145 | 557,585 |
| After | local Chromium SwiftShader, 1280×720, exterior override tier 2 | 3.04 | 145 | 557,585 |

Each FPS sample counted animation frames for about 4 seconds. The low result reflects this full exterior's software-rendered test environment and is not an estimate of GPU performance. The requested pve-mini-3070 45+ FPS benchmark was **not run**: this checkout has no attached GPU device (`/dev/dri` is absent and `nvidia-smi` is unavailable). Do not treat the local SwiftShader result as a pass for that target; the office QA stage must run the target-device benchmark and confirm reflections/assets there.

## Regression test

`python3 -m unittest discover -s tests -v` checks the sampled normal map reaches the normal used by Fresnel reflections, with the second sample gated to the higher quality shader variant.
