// keep: rotation on all bones, translation only on root/pelvis; drop scale + other translations; resample; meshopt
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const [inp,out]=process.argv.slice(2); const doc=await io.read(inp); let n=0;
for(const a of doc.getRoot().listAnimations()) for(const ch of a.listChannels()){ const p=ch.getTargetPath(), nm=ch.getTargetNode()?.getName()||'';
  if(p==='scale'){ ch.getSampler().dispose(); ch.dispose(); n++; } }
await doc.transform(resample(), dedup(), prune(), meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(out,doc); console.log('stripped',n,out);
