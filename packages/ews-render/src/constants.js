/** Shared Phase 1 / Phase 2 constants. Do not drift from docs/ews-render-design.md. */

export const PIXEL_LIMIT = 1.0;
export const IMPOSTOR_PX = 2.0;
export const SCHEMA_VERSION = 1;
export const MESHLET_TRIS = 64;
export const CLIPMAP_RINGS = 6;
export const HEIGHT_N = 48;
export const HEIGHT_COVER = 320;
export const SPACE_REBASE_M = 2200;
export const SPACE_FAR = 5000;
export const DEFAULT_FOV = 62;

export const QUALITY = {
  auto: { aniso: 8, far: 2400, clips: 6, streamBudget: 96 << 20 },
  low: { aniso: 4, far: 900, clips: 5, streamBudget: 32 << 20 },
  medium: { aniso: 8, far: 1800, clips: 6, streamBudget: 64 << 20 },
  high: { aniso: 16, far: 3200, clips: 7, streamBudget: 128 << 20 },
  ultra: { aniso: 16, far: 5000, clips: 8, streamBudget: 192 << 20 },
};

export const CATALOG_DEFAULT = [
  ['block', 1.0, [0, 0.04, 0.12, 0.35]],
  ['tree', 1.4, [0, 0.06, 0.18, 0.5]],
  ['shrub', 0.6, [0, 0.03, 0.1, 0.28]],
  ['arch', 1.6, [0, 0.05, 0.16, 0.42]],
  ['bench', 0.8, [0, 0.03, 0.09, 0.24]],
  ['lot-small', 2.8, [0, 0.02, 0.08, 0.2]],
  ['lot-medium', 3.6, [0, 0.02, 0.08, 0.22]],
  ['well', 0.7, [0, 0.03, 0.1, 0.26]],
  ['shrine', 0.8, [0, 0.03, 0.1, 0.28]],
  ['pad', 1.6, [0, 0.02, 0.06, 0.16]],
  ['awning', 1.2, [0, 0.04, 0.12, 0.3]],
];
