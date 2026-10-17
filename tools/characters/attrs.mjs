import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const p = m.listPrimitives()[0];
  console.log(n.getName(), p.listSemantics().map(s => s + ':' + p.getAttribute(s).getComponentType() + (p.getAttribute(s).getNormalized() ? 'n' : '')).join(' '), 'T', p.listTargets().length, p.listTargets()[0]?.listSemantics().join('+')); }
