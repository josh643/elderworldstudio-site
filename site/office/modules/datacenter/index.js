// Datacenter wing: one rack per node in roster.json nodes (tools/office/nodes.json). New server = new rack.
export default {
  setup(ctx, cfg, [x0, z0]) {
    const { box, roster, THREE } = ctx, nodes = roster.nodes, z1 = z0 - 2; this.leds = [];
    ctx.panel(ctx.textCanvas(['Datacenter', `${nodes.length} servers`], { w: 768, h: 180, size: 60 }), 4, 0.95, x0, 3.6, z0 + 0.4);
    nodes.forEach((n, i) => {
      const x = x0 + (i % 4 - 1.5) * 3, z = z1 - Math.floor(i / 4) * 4; const rb = box(1.2, 2.6, 1, ctx.mat.rack, x, 1.3, z); rb.userData.keep = 1; (this.racks ||= []).push(rb);
      if (ctx.mat.glass) box(1.22, 2.5, 0.02, ctx.mat.glass, x, 1.3, z + 0.53);
      for (let k = 0; k < 6; k++) { const l = box(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: n.online ? 0x4cff7a : 0x552222 }), x - 0.4 + (k % 3) * 0.1, 1 + Math.floor(k / 3) * 0.9, z + 0.51); l.userData.on = n.online; this.leds.push(l); }
      const lb = ctx.label(n.name, n.online ? 'online' : 'offline'); lb.position.set(x, 3, z); ctx.scene.add(lb);
    });
    ctx.provide('racks', this.racks || []);
    const minZ = z1 - Math.ceil(nodes.length / 4) * 4; ctx.extend(x0 - 8, minZ - 1, x0 + 8, z0 + 2);
    ctx.spot('datacenter', [x0, 2.2, z0 + 3], [x0, 1.2, z1 - 3], 'Datacenter'); return { minZ };
  },
  onFrame(dt, t) { this.leds.forEach((l, i) => { l.userData.keep = 1; if (l.userData.on) l.visible = Math.sin(t * (3 + (i % 5)) + i) > -0.6; }); },
};
