/**
 * Bindless-style texture streaming. WebGPU uses a texture array + residency table.
 * WebGL2 uses the same table with a 2D atlas / discrete slots. Mips + aniso, no fog blur.
 */

export function createStreamer(opts = {}) {
  const budget = opts.budget || (96 << 20);
  const slots = opts.slots || 64;
  const table = new Array(slots).fill(null);
  let used = 0;
  const wait = new Map();

  return {
    budget,
    slots,
    used() { return used; },
    table,
    request(id, bytes, mipCount, priority = 0) {
      const existing = table.find(s => s && s.id === id);
      if (existing) { existing.priority = Math.max(existing.priority, priority); existing.last = now(); return existing.slot; }
      if (used + bytes > budget) evict(bytes);
      let slot = table.findIndex(s => !s);
      if (slot < 0) { evict(bytes); slot = table.findIndex(s => !s); }
      if (slot < 0) return -1;
      table[slot] = { id, bytes, mipCount, priority, slot, last: now(), resident: true };
      used += bytes;
      return slot;
    },
    release(id) {
      const i = table.findIndex(s => s && s.id === id);
      if (i < 0) return;
      used -= table[i].bytes;
      table[i] = null;
    },
    residency() {
      return table.filter(Boolean).map(s => ({ id: s.id, slot: s.slot, bytes: s.bytes, mips: s.mipCount }));
    },
    desiredMips(projPx, maxMips) {
      // Full-res when the projection is large; drop mips as the object shrinks. Never a fog wall.
      if (projPx >= 256) return maxMips;
      if (projPx >= 64) return Math.max(1, maxMips - 1);
      if (projPx >= 16) return Math.max(1, maxMips - 2);
      return 1;
    },
    markWanted(id) { wait.set(id, now()); },
    pending() { return [...wait.keys()]; },
  };

  function evict(need) {
    const live = table.map((s, i) => s && { i, ...s }).filter(Boolean);
    live.sort((a, b) => (a.priority - b.priority) || (a.last - b.last));
    for (const s of live) {
      if (used + need <= budget) break;
      used -= s.bytes;
      table[s.i] = null;
    }
  }
  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
}
