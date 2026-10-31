# EWS Render — perceptually lossless distance

Owner goal: everything stays visible from very far away with **no visible loss in quality**. A LOD swap must never be noticeable. This document splits that work into two phases so Phase 1 can ship on the current three.js office stack while Phase 2 builds a dedicated renderer.

## Measure “no visible loss”

A candidate frame is lossless at distance when, from the same camera:

| Check | Pass |
|---|---|
| SSIM vs a max-detail (LOD0 / `forceMaxLod`) reference of the same view | **≥ 0.98** |
| Mean absolute pixel difference (8-bit RGB) | tiny; used as a sanity companion, not the gate |
| Swap itself | no pop: screen-space geometric error of the chosen cluster **< ~1.0 pixel** at the current resolution, or a dithered/crossfade transition that stays above the SSIM gate |
| Fog | **no** distance fog wall. Atmosphere is scattering only |
| Draw distance | horizon on the ground; planets remain visible from space |

FPS is reported next to the SSIM numbers. Targets (not gates for Phase 1):

- Mid-range laptop (iGPU, 1920×1080, medium/auto): **≥ 50 fps** in town at horizon, **≥ 40 fps** in space looking at both planets.
- Mid-range Android (Adreno-class, 1080p CSS, low/auto): **≥ 30 fps** town, **≥ 24 fps** space.

Phase 1 records whatever the three.js path actually gets on CI (often SwiftShader) and on a real device when one is attached. Phase 2 is accepted only when the SSIM gate holds **and** those FPS targets are met on the two reference devices.

## Phase 1 — this PR (three.js / WebGL2)

Lives in `site/office/modules/worlds-lod` and small engine hooks. The office `/office/` path is unchanged for visitors.

- **Screen-space error LOD.** `sse = geomErr * H / (d * 2 tan(fov/2))`. Switch to a coarser cluster only when that value is **< 1 pixel**. Offline metrics: `tools/worlds-lod-build.mjs` → `site/office/assets/worlds/lod-clusters.json`.
- **CDLOD / clipmap terrain** with geomorphing between a ring and its parent. Heightfield is the editor’s 48² map (town / Omnivael). Vertex morph factor comes from SSE, not a fixed distance.
- **Logarithmic depth buffer** on the worlds WebGLRenderer (`logarithmicDepthBuffer: true`) so a 5 km far plane and a 0.1 m near plane coexist.
- **Floating origin** in space: when the ship leaves ~2.2 km from the current origin, planets and the ship are rebased. Town stays at the campus origin (hundreds of metres — float32 is fine).
- **Textures:** mipmaps + anisotropic filtering (up to device max). No fog-driven blur.
- **Atmosphere:** a back-face sky sphere with Rayleigh-ish scatter. `scene.fog` is **null** in worlds mode and on Omnivael/space scenes.
- **Impostors:** not used for a visible swap in Phase 1. Existing exterior tree impostors stay behind the 1-pixel SSE rule. Octahedral impostors with depth+normals are Phase 2; using a billboard earlier would fail the SSIM gate.
- **WebGPU:** detected and reported (`backend: webgpu-ready`) but not used. vendored three r169 is WebGL.

Honest limits of Phase 1: no meshlet DAG, no GPU-driven culling, no visibility buffer, no bindless texture streaming, no cube-sphere planets, no baked high-poly→LOD normal-map pipeline. Those are Phase 2.

## Phase 2 — `packages/ews-render` (separate PR)

A dedicated EWS renderer that can sit beside or replace `THREE.WebGLRenderer` while keeping glTF / cluster JSON / heightfield formats.

```
CPU (offline)                    GPU (runtime)
─────────────                    ─────────────
meshlet hierarchy +              compute: frustum / Hi-Z / occlusion cull
  per-cluster geomErr            compute: pick coarsest cluster with sse < 1px
normal-map bake LOD0→LODn        visibility buffer (or clustered forward)
octahedral impostor atlas        bindless-style texture stream + mips + aniso
  (color, depth, normals)        CDLOD/clipmap terrain, geomorph in VS
cube-sphere planet meshes        atmospheric scattering (view ray)
KTX2 / basis texture mips        log depth + floating origin (same as Phase 1)
```

**Backends:** WebGPU first (compute + storage buffers + preferred depth). WebGL2 fallback: transform-feedback or CPU cluster pick (Phase 1 path) so mid-range Android still runs.

**Milestones**

1. Package skeleton (`packages/ews-render`) with a headless SSE unit test and the same `lod-clusters.json` schema.
2. Offline cluster builder that reads EWS glTF and writes meshlets + geomErr + baked normals.
3. WebGPU path: GPU cull + LOD select + visibility buffer of the campus + town.
4. Terrain: GPU clipmap/CDLOD, full-resolution heightfield on the horizon via SSE.
5. Cube-sphere planets + scattering; impostors only past the pixel-identical point, dithered crossfade.
6. WebGL2 fallback; drop-in adapter so `engine.js` can `R = ewsRender.create({ fallback: 'webgl2' })`.
7. Device lab: SSIM ≥ 0.98 and the FPS targets above on the laptop and the phone.

Scene/asset compatibility: keep glTF + Draco/meshopt, the editor heightfield, and the cluster JSON. Do not require a Unity or custom binary that the static host cannot serve.

## How this PR tests it

`tests/worlds/lod-ssim.spec.js` renders the same distant campus view at `forceMaxLod` and at the SSE path, writes both PNGs, asserts SSIM ≥ 0.98, and prints before/after FPS into `docs/worlds-lod-metrics.json` for the PR body.
