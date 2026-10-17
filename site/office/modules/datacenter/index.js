// Datacenter wing: one rack per node in roster.json nodes (tools/office/nodes.json). New server = new rack.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { box, roster, THREE } = ctx, nodes = roster.nodes, z1 = z0 - 2; this.leds = [];
    nodes.forEach((n, i) => {
      const x = x0 + (i % 4 - 1.5) * 3, z = z1 - Math.floor(i / 4) * 4; const rb = box(1.2, 2.6, 1, ctx.mat.rack, x, 1.3, z); rb.userData.keep = 1; (this.racks ||= []).push(rb);
      if (ctx.mat.glass) box(1.22, 2.5, 0.02, ctx.mat.glass, x, 1.3, z + 0.53);
      for (let k = 0; k < 6; k++) { const l = box(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: n.online ? 0x4cff7a : 0x552222 }), x - 0.4 + (k % 3) * 0.1, 1 + Math.floor(k / 3) * 0.9, z + 0.51); l.userData.on = n.online; this.leds.push(l); }
      if (!ctx.publicMode) { const lb = ctx.panel(ctx.textCanvas([n.name, n.online ? 'online' : 'offline'], { w: 512, h: 160, size: 64 }), 1.0, 0.31, x, 2.35, z + 0.535); lb.userData.plate = n.name; }   /* name plate on the rack door */
    });
    ctx.provide('racks', this.racks || []);
    const minZ = z1 - Math.ceil(nodes.length / 4) * 4;
    ctx.kit.room(ctx, { x: x0, z: (minZ - 1 + z0 + 2) / 2, w: 15, d: z0 + 3 - minZ, floor: 0x223344, title: 'Datacenter', sub: ctx.publicMode ? '' : `${nodes.length} servers`, enclose: true });   /* walled server room with a door plate */ ctx.extend(x0 - 8, minZ - 1, x0 + 8, z0 + 2);
    ctx.spot('datacenter', [x0, 2.2, z0 + 3], [x0, 1.2, z1 - 3], 'Datacenter'); return { minZ };
  },
  onFrame(dt, t) { this.leds.forEach((l, i) => { l.userData.keep = 1; if (l.userData.on) l.visible = Math.sin(t * (3 + (i % 5)) + i) > -0.6; }); },
};
