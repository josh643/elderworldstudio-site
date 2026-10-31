/**
 * EWS Render — Phase 2 public API.
 * Browser: import from `/packages/ews-render/src/index.js` (served by worlds-host).
 * Node: `import { create, screenSpaceError } from '@ews/render'`.
 * No CDN, no secrets, no client names.
 */
export { create, flagEnabled, pickBackend } from './adapter.js';
export { screenSpaceError, pickLodLevel, clusterLodVisible, PIXEL_LIMIT } from './math/sse.js';
export { rebase, shouldRebase } from './math/origin.js';
export { octEncode, octDecode, impostorBlend, ditherThreshold } from './math/octahedral.js';
export { parseClusterDoc, defaultCatalogDoc, flattenGpuClusters, findCluster } from './format/clusters.js';
export { buildMeshlets, geometricError } from './build/meshlets.js';
export { buildLodHierarchy, primitiveMesh, box, icosphere } from './build/hierarchy.js';
export { bakeNormalMap, computeVertexNormals } from './build/normals.js';
export { bakeOctahedralImpostor, shouldUseImpostor } from './build/impostors.js';
export { cullClusters, packClusterRecords } from './gpu/cull.js';
export { buildHiZ } from './gpu/hiz.js';
export { createStreamer } from './gpu/bindless.js';
export { sampleHeight, morphClipRing, makePlane } from './scene/terrain.js';
export { cubeSphereGeometry, toThreeGeometry } from './scene/planet.js';
export { scatterSky, fogWallForbidden, ATMOSPHERE_VERT, ATMOSPHERE_FRAG } from './scene/atmosphere.js';
export { QUALITY, IMPOSTOR_PX, SCHEMA_VERSION } from './constants.js';
