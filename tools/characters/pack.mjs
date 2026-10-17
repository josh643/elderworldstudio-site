// meshopt-compress the character GLBs; report per-part attributes (so the runtime merge has matching sets)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, reorder, quantize } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [inp, out] = process.argv.slice(2); const doc = await io.read(inp);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const s of p.listSemantics()) if (/^COLOR_/.test(s)) p.setAttribute(s, null);   // leftover bake layers
const Q = { pattern: /^(?!POSITION).*/, patternTargets: /^$/, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8, quantizeGeneric: 8 };   // POSITION + morph deltas stay float: parts merge at runtime (one space) and quantised morph deltas came out mis-scaled
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  const a = p.listSemantics().join(','), t = p.listTargets().length;
  if (!/_zone/i.test(a) || !/_ao/i.test(a)) console.log('MISSING attr', m.getName(), a);
  console.log(m.getName(), a, 'targets', t, 'verts', p.getAttribute('POSITION').getCount());
}
await doc.transform(dedup(), prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder, target: 'size' }), quantize(Q))
// meshopt() would re-quantise POSITION with its own pattern; add the extension ourselves on top of our quantisation
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await (async()=>{})();
await io.write(out, doc); console.log('packed', out);
