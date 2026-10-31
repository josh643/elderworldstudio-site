# `@ews/render` — EWS Phase 2 renderer

Dedicated WebGPU renderer for Elderverse worlds. Goal: everything stays visible from very far away with **no visible loss in quality** (SSIM ≥ 0.98 vs max-detail, screen-space geometric error &lt; 1 px).

Served from this repo by `worlds-host.mjs` at `/packages/ews-render/`. No third-party runtime CDN. Self-hostable on the EWS datacenter path (Docker / systemd) from Phase 1.

## Backends

1. **WebGPU** — compute frustum / Hi-Z / cone cull + per-cluster LOD, visibility buffer, bindless-style texture streaming.
2. **WebGL2 fallback** — same cluster JSON, CPU (or transform-feedback) cluster pick, forward shading. Mid-range Android still runs.

```js
import { create } from '/packages/ews-render/src/index.js';
const R = await create({ canvas, fallback: 'webgl2' });
R.render(view);
```

## Feature flag

The `/worlds/` app stays on the Phase 1 three.js path unless:

- URL: `?ewsrender=1`
- `localStorage.ews-render === '1'`

`/office/` is unchanged. Scene and asset formats stay glTF + `lod-clusters.json` + the editor heightfield.

## Offline build

```bash
node packages/ews-render/src/build/cli.mjs --catalog site/office/assets/worlds/lod-clusters.json
npm run worlds:lod
```

Writes meshlets, per-cluster `geomErr`, baked LOD normals, and octahedral impostor atlases (color + depth + normals). Impostors are used at runtime only when they are pixel-identical with the last mesh LOD (projected size &lt; 2 px and SSE &lt; 1 px), with a dithered crossfade.

## Tests

```bash
node --test packages/ews-render/test/*.test.mjs
npx playwright test tests/worlds/ews-render.spec.js
```
