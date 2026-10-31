// Mean SSIM (Y channel) between two PNG buffers. Window 8, k1=0.01, k2=0.03.
import { PNG } from 'pngjs';

function luma(d, i) {
  return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
}

export function decodePng(buf) {
  return PNG.sync.read(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
}

export function ssimPng(aBuf, bBuf) {
  const A = decodePng(aBuf), B = decodePng(bBuf);
  if (A.width !== B.width || A.height !== B.height) {
    throw new Error(`size mismatch ${A.width}x${A.height} vs ${B.width}x${B.height}`);
  }
  const w = A.width, h = A.height, win = 8;
  const L = 255, k1 = 0.01, k2 = 0.03, c1 = (k1 * L) ** 2, c2 = (k2 * L) ** 2;
  let acc = 0, n = 0, mad = 0, px = 0;
  for (let y = 0; y + win <= h; y += win) {
    for (let x = 0; x + win <= w; x += win) {
      let s1 = 0, s2 = 0, sq1 = 0, sq2 = 0, s12 = 0, c = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
        const p = ((y + j) * w + (x + i)) * 4;
        const u = luma(A.data, p), v = luma(B.data, p);
        s1 += u; s2 += v; sq1 += u * u; sq2 += v * v; s12 += u * v; c++;
        mad += Math.abs(A.data[p] - B.data[p]) + Math.abs(A.data[p + 1] - B.data[p + 1]) + Math.abs(A.data[p + 2] - B.data[p + 2]);
        px++;
      }
      const m1 = s1 / c, m2 = s2 / c;
      const v1 = sq1 / c - m1 * m1, v2 = sq2 / c - m2 * m2, cov = s12 / c - m1 * m2;
      acc += ((2 * m1 * m2 + c1) * (2 * cov + c2)) / ((m1 * m1 + m2 * m2 + c1) * (v1 + v2 + c2));
      n++;
    }
  }
  return { ssim: acc / n, mad: mad / (px * 3), width: w, height: h };
}

export function dataUrlToBuf(url) {
  const i = url.indexOf(',');
  return Buffer.from(url.slice(i + 1), 'base64');
}
