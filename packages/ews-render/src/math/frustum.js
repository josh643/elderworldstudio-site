/** View-frustum planes from a column-major 4×4 view-projection matrix. */

export function planesFromVP(m) {
  const p = [];
  const row = (r) => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const add = (a, s, b) => {
    const n = [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    p.push([n[0] / len, n[1] / len, n[2] / len, n[3] / len]);
  };
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  add(r3, 1, r0); add(r3, -1, r0);
  add(r3, 1, r1); add(r3, -1, r1);
  add(r3, 1, r2); add(r3, -1, r2);
  return p;
}

export function sphereInFrustum(planes, x, y, z, r) {
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
  }
  return true;
}

export function coneBackfacing(coneAxis, coneCutoff, viewX, viewY, viewZ) {
  // coneCutoff = cos(angle). Cluster faces away if view·axis > cutoff.
  return viewX * coneAxis[0] + viewY * coneAxis[1] + viewZ * coneAxis[2] > coneCutoff;
}

export function lookAtVP(eye, target, up, fovDeg, aspect, near, far) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / zl, z1 = zy / zl, z2 = zz / zl;
  let xx = up[1] * z2 - up[2] * z1, xy = up[2] * z0 - up[0] * z2, xz = up[0] * z1 - up[1] * z0;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const y0 = z1 * xz - z2 * xy, y1 = z2 * xx - z0 * xz, y2 = z0 * xy - z1 * xx;
  const view = [
    xx, y0, z0, 0,
    xy, y1, z1, 0,
    xz, y2, z2, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ];
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  const proj = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ];
  return mul4(proj, view);
}

function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
  }
  return o;
}

export function logDepth(z, near, far) {
  const c = 2 / Math.log2(far / near);
  return Math.log2(z / near) * c - 1;
}
