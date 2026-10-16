// Realistic materials module: PBR (MeshStandardMaterial) with CC0 ambientCG textures (see tex/LICENSE.txt) and an
// image-based environment (three.js RoomEnvironment, generated on the GPU, no HDRI download). Swaps the shared
// ctx.mat entries in place, so every module gets the upgrade with no code change.
// Tier 0 (weak phones) keeps the cheap Lambert materials. Tier 1 uses 512 px textures, tier 2 uses 1024 px.
// Next (Blender pipeline on CT109): baked lightmaps (uv2) for each kit piece, KTX2/Basis textures, Draco meshes, LODs.
import { RoomEnvironment } from './RoomEnvironment.js?v=3';
export default {
  setup(ctx) {
    if (ctx.tier === 0) return;
    const { THREE, renderer: R, scene, mat } = ctx, q = ctx.tier >= 2 ? 'hi' : 'lo', L = new THREE.TextureLoader();
    const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.9;
    const tex = (n, k, rep, srgb) => { const t = L.load(`/office/modules/materials/tex/${n}-${k}-${q}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    const pbr = (n, rep, o = {}) => new THREE.MeshStandardMaterial({ map: tex(n, 'c', rep, true), normalMap: tex(n, 'n', rep), roughnessMap: tex(n, 'r', rep), envMapIntensity: 0.8, ...o });
    Object.assign(mat, {
      floor: pbr('floor', 30), wall: pbr('plaster', 6), wood: pbr('wood', 1), stone: pbr('concrete', 1),
      rack: pbr('rackmetal', 1, { metalness: 0.7, color: 0x555a60 }), trim: pbr('metal', 1, { metalness: 1, color: 0xd9b45a, roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.15, metalness: 0.2 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, thickness: 0.05, transparent: true, opacity: 0.35 }),
    });
    mat.fabric = pbr('fabric', 2, { color: 0x2a2a30 });
    const carpetMaps = { map: tex('carpet', 'c', 4, true), normalMap: tex('carpet', 'n', 4), roughnessMap: tex('carpet', 'r', 4) }, rugs = new Map();
    ctx.rug = (col, rep = 1) => { const k = col + ':' + rep; if (!rugs.has(k)) rugs.set(k, new THREE.MeshStandardMaterial({ ...carpetMaps, color: col, envMapIntensity: 0.5 })); return rugs.get(k); };
    ctx.M.standard = true;
  },
};
