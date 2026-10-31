/** Unit-vector ↔ octahedral [0,1]². Used for impostor views and packed normals. */

export function octEncode(x, y, z) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const inv = 1 / Math.max(1e-8, ax + ay + az);
  let u = x * inv, v = z * inv;
  if (y < 0) {
    const ou = u, ov = v;
    u = (1 - Math.abs(ov)) * (ou >= 0 ? 1 : -1);
    v = (1 - Math.abs(ou)) * (ov >= 0 ? 1 : -1);
  }
  return [(u + 1) * 0.5, (v + 1) * 0.5];
}

export function octDecode(u, v) {
  const x = u * 2 - 1, z = v * 2 - 1;
  const y = 1 - Math.abs(x) - Math.abs(z);
  let ox = x, oz = z;
  if (y < 0) {
    const ox0 = ox;
    ox = (1 - Math.abs(oz)) * (ox >= 0 ? 1 : -1);
    oz = (1 - Math.abs(ox0)) * (oz >= 0 ? 1 : -1);
  }
  const len = Math.hypot(ox, y, oz) || 1;
  return [ox / len, y / len, oz / len];
}

export function octViewDir(i, j, n) {
  return octDecode((i + 0.5) / n, (j + 0.5) / n);
}

export function ditherThreshold(px, py) {
  // 4×4 Bayer, 0..1. Used for impostor crossfades so the swap stays above the SSIM gate.
  const bayer = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  return (bayer[(py & 3) * 4 + (px & 3)] + 0.5) / 16;
}

export function impostorBlend(projPx, lastSse, pixelLimit, impostorPx) {
  if (lastSse >= pixelLimit) return 0;
  if (projPx >= impostorPx) return 0;
  const t = 1 - projPx / impostorPx;
  return Math.min(1, Math.max(0, t));
}
