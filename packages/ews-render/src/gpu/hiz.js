/** Build a min Hi-Z pyramid from a linear depth buffer (CPU reference of the compute downsample). */

export function buildHiZ(depth, width, height) {
  const size = 1 << Math.ceil(Math.log2(Math.max(width, height)));
  const levels = [];
  let cur = new Float32Array(size * size);
  cur.fill(1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    cur[y * size + x] = depth[y * width + x];
  }
  levels.push(cur);
  let w = size;
  while (w > 1) {
    const nw = w >> 1;
    const next = new Float32Array(nw * nw);
    for (let y = 0; y < nw; y++) for (let x = 0; x < nw; x++) {
      const i00 = (y * 2) * w + (x * 2);
      const i10 = i00 + 1;
      const i01 = (y * 2 + 1) * w + (x * 2);
      const i11 = i01 + 1;
      next[y * nw + x] = Math.min(cur[i00], cur[i10], cur[i01], cur[i11]);
    }
    levels.push(next);
    cur = next;
    w = nw;
  }
  return { size, levels };
}
