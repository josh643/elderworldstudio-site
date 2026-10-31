/**
 * Minimal GLB reader (JSON + BIN, POSITION / NORMAL / indices).
 * No Draco/meshopt decode here — worlds-host already serves decoded/baked GLBs
 * and the office loader handles compressed ones. This path is for the offline bake.
 */
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

export function parseGLB(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off + 8 <= u8.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const slice = u8.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(slice));
    if (type === 0x004E4942) bin = slice;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB missing JSON');
  return { json, bin: bin || new Uint8Array(0) };
}

function accessorData(gltf, accIndex) {
  const acc = gltf.json.accessors[accIndex];
  const view = gltf.json.bufferViews[acc.bufferView];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const n = acc.count * (TYPES[acc.type] || 1);
  const width = COMP[acc.componentType];
  const slice = gltf.bin.buffer.slice(gltf.bin.byteOffset + start, gltf.bin.byteOffset + start + n * width);
  if (acc.componentType === 5126) return new Float32Array(slice);
  if (acc.componentType === 5123) return new Uint16Array(slice);
  if (acc.componentType === 5125) return new Uint32Array(slice);
  if (acc.componentType === 5121) return new Uint8Array(slice);
  throw new Error('unsupported accessor ' + acc.componentType);
}

export function extractFirstMesh(glbBuf) {
  const gltf = parseGLB(glbBuf);
  const mesh = gltf.json.meshes?.[0];
  if (!mesh) throw new Error('GLB has no meshes');
  const prim = mesh.primitives[0];
  const positions = new Float32Array(accessorData(gltf, prim.attributes.POSITION));
  const normals = prim.attributes.NORMAL != null ? new Float32Array(accessorData(gltf, prim.attributes.NORMAL)) : null;
  let indices;
  if (prim.indices != null) {
    const raw = accessorData(gltf, prim.indices);
    indices = raw instanceof Uint32Array ? raw : Uint32Array.from(raw);
  } else {
    indices = new Uint32Array(positions.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  return { positions, normals, indices, name: mesh.name || 'mesh' };
}
