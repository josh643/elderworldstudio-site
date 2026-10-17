// Attract-mode loops for games without store art yet: small self-playing simulations drawn on a 512x400 canvas.
export function attract(title, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 400; const g = c.getContext('2d');
  const hex = '#' + col.toString(16).padStart(6, '0'), t0 = { t: 0 }, key = title.toLowerCase();
  const head = () => { g.fillStyle = '#07040e'; g.fillRect(0, 0, 512, 400); g.fillStyle = '#fff'; g.font = '700 30px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(title.toUpperCase(), 256, 38);
    g.font = '500 16px Inter, system-ui, sans-serif'; g.fillStyle = '#c9bfae'; g.fillText('COMING SOON · ATTRACT MODE', 256, 388); };
  let draw;
  if (key.includes('snake')) { let s = [[8, 8], [7, 8], [6, 8]], d = [1, 0], f = [14, 10], k = 0;
    draw = () => { if ((k = (k + 1) % 3)) { } else { const h = s[0]; if (Math.random() < 0.15 || h[0] + d[0] < 1 || h[0] + d[0] > 22 || h[1] + d[1] < 1 || h[1] + d[1] > 15) { const o = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(v => v[0] !== -d[0] || v[1] !== -d[1]); d = o[(Math.random() * o.length) | 0]; if (h[0] + d[0] < 1 || h[0] + d[0] > 22 || h[1] + d[1] < 1 || h[1] + d[1] > 15) d = [-d[0], -d[1]]; }
        const n = [h[0] + d[0], h[1] + d[1]]; s.unshift(n); if (n[0] === f[0] && n[1] === f[1]) f = [2 + (Math.random() * 19) | 0, 2 + (Math.random() * 12) | 0]; else if (s.length > 4 + (t0.t / 3 | 0) % 14) s.pop(); }
      head(); g.shadowBlur = 14; g.shadowColor = hex; g.fillStyle = hex; for (const [x, y] of s) g.fillRect(x * 21 + 12, y * 21 + 30, 18, 18); g.fillStyle = '#ffe35a'; g.shadowColor = '#ffe35a'; g.fillRect(f[0] * 21 + 15, f[1] * 21 + 33, 12, 12); g.shadowBlur = 0; };
  } else if (key.includes('stack')) { let blocks = [{ x: 156, w: 200 }], cur = { x: 0, w: 200, v: 160 };
    draw = dt => { cur.x += cur.v * dt; if (cur.x < 40 || cur.x + cur.w > 472) cur.v *= -1; const top = blocks[blocks.length - 1];
      if (Math.abs(cur.x - top.x) < 6 || Math.random() < dt * 0.9) { const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w); if (r - l > 20) { blocks.push({ x: l, w: r - l }); cur = { x: 40, w: r - l, v: 160 + blocks.length * 6 }; } else { blocks = [{ x: 156, w: 200 }]; cur = { x: 40, w: 200, v: 160 }; } if (blocks.length > 11) blocks = [{ x: 156, w: 200 }]; }
      head(); blocks.forEach((b, i) => { g.fillStyle = `hsl(${(i * 28 + 280) % 360} 90% 60%)`; g.fillRect(b.x, 350 - i * 26, b.w, 24); }); g.fillStyle = hex; g.fillRect(cur.x, 350 - blocks.length * 26, cur.w, 24); };
  } else if (key.includes('2048')) { const v = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]; let grid = Array.from({ length: 16 }, () => Math.random() < 0.5 ? 0 : v[(Math.random() * 5) | 0]), k = 0;
    draw = dt => { if ((k += dt) > 0.6) { k = 0; const i = (Math.random() * 16) | 0; grid[i] = grid[i] ? Math.min(2048, grid[i] * 2) : 2; if (grid.every(Boolean)) grid = grid.map(() => 0); }
      head(); grid.forEach((n, i) => { const x = 116 + (i % 4) * 72, y = 60 + (i >> 2) * 72; g.fillStyle = n ? `hsl(${30 + Math.log2(n) * 22} 80% ${70 - Math.log2(n) * 3}%)` : '#1d1630'; g.fillRect(x, y, 66, 66); if (n) { g.fillStyle = '#111'; g.font = '700 22px Inter, sans-serif'; g.fillText(n, x + 33, y + 41); } }); };
  } else { // generic: neon runner through gates / spiral / flip
    let y = 200, vy = 0, gates = [600, 860], gy = [180, 230], k = 0;
    draw = dt => { k += dt; gates = gates.map(x => x - 180 * dt); gates.forEach((x, i) => { if (x < -40) { gates[i] = 560; gy[i] = 120 + Math.random() * 160; } });
      const tgt = gy[gates[0] < gates[1] ? 0 : 1]; vy += (tgt - y) * dt * 6 - vy * dt * 3; y += vy * dt * 6;
      head(); gates.forEach((x, i) => { g.fillStyle = hex; g.fillRect(x, 50, 26, gy[i] - 50 - 40); g.fillRect(x, gy[i] + 40, 26, 360 - gy[i] - 40); });
      g.shadowBlur = 16; g.shadowColor = '#fff'; g.fillStyle = '#fff'; g.beginPath(); g.arc(130, y, 14 + Math.sin(k * 8) * 2, 0, 7); g.fill(); g.shadowBlur = 0; };
  }
  draw(0.016);
  return { canvas: c, step: dt => { t0.t += dt; draw(Math.min(dt, 0.1)); } };
}
