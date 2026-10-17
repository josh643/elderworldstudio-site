import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const m of doc.getRoot().listMeshes().slice(0, 40)) { const p = m.listPrimitives()[0]; const out = [m.getName()];
  for (const t of p.listTargets()) { const a = t.getAttribute('POSITION'); let mx = 0; const v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); mx = Math.max(mx, Math.hypot(...v)); } out.push(mx.toFixed(3)); }
  console.log(out.join(' ')); }
