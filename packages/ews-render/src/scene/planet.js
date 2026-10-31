/** Cube-sphere: 6 faces, each `div × div` quads, vertices normalized onto a sphere. */

export function cubeSphereGeometry(radius = 1, div = 16) {
  const faces = [
    [1, 0, 0, 0, 0, 1, 0, 1, 0],   // +X
    [-1, 0, 0, 0, 0, -1, 0, 1, 0], // -X
    [0, 1, 0, 1, 0, 0, 0, 0, 1],   // +Y
    [0, -1, 0, 1, 0, 0, 0, 0, -1], // -Y
    [0, 0, 1, -1, 0, 0, 0, 1, 0],  // +Z
    [0, 0, -1, 1, 0, 0, 0, 1, 0],  // -Z
  ];
  const vertsPer = (div + 1) * (div + 1);
  const positions = new Float32Array(6 * vertsPer * 3);
  const normals = new Float32Array(6 * vertsPer * 3);
  const uvs = new Float32Array(6 * vertsPer * 2);
  const indices = new Uint32Array(6 * div * div * 6);
  let po = 0, uo = 0, io = 0, base = 0;
  for (const f of faces) {
    const ox = f[0], oy = f[1], oz = f[2];
    const ux = f[3], uy = f[4], uz = f[5];
    const vx = f[6], vy = f[7], vz = f[8];
    for (let j = 0; j <= div; j++) for (let i = 0; i <= div; i++) {
      const su = i / div * 2 - 1, sv = j / div * 2 - 1;
      let x = ox + ux * su + vx * sv;
      let y = oy + uy * su + vy * sv;
      let z = oz + uz * su + vz * sv;
      const len = Math.hypot(x, y, z) || 1;
      x /= len; y /= len; z /= len;
      positions[po] = x * radius; normals[po] = x; po++;
      positions[po] = y * radius; normals[po] = y; po++;
      positions[po] = z * radius; normals[po] = z; po++;
      uvs[uo++] = i / div; uvs[uo++] = j / div;
    }
    for (let j = 0; j < div; j++) for (let i = 0; i < div; i++) {
      const a = base + j * (div + 1) + i;
      const b = a + 1, c = a + (div + 1), d = c + 1;
      indices[io++] = a; indices[io++] = c; indices[io++] = b;
      indices[io++] = b; indices[io++] = c; indices[io++] = d;
    }
    base += vertsPer;
  }
  return { positions, normals, uvs, indices, radius, div, faces: 6 };
}

export function toThreeGeometry(THREE, geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(geo.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(geo.indices, 1));
  return g;
}

/** Cube-sphere is smoother than a UV sphere of the same vertex budget at the poles. */
export function polarStretch(uvSpherePositions, cubePositions, radius) {
  // Max |r - radius| — cube-sphere should stay closer to the true sphere on a coarse grid.
  const err = (p) => {
    let m = 0;
    for (let i = 0; i < p.length; i += 3) m = Math.max(m, Math.abs(Math.hypot(p[i], p[i + 1], p[i + 2]) - radius));
    return m;
  };
  return { cube: err(cubePositions), uv: err(uvSpherePositions) };
}
