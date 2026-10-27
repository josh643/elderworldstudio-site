export function nearDoor(position, center, radius) {
  return Math.hypot(position.x - center.x, position.z - center.z) < radius;
}

export function nextDoorOpen(open, near, dt, speed = 5) {
  const step = Math.max(0, Math.min(1, dt * speed));
  return open + ((near ? 1 : 0) - open) * step;
}

export function registerSlidingDoors(ctx, leaves, { centerX, centerZ, width, depth = 0.08, radius = 3, travel = 0.72 }) {
  const colliders = ctx.extraCols ||= [];
  let open = 0;
  const panels = leaves.map((leaf, i) => {
    const side = i === 0 ? -1 : 1;
    const homeX = leaf.position.x;
    leaf.traverse?.(part => { if (part.isMesh) part.userData.noCollide = 1; });
    if (leaf.isMesh) leaf.userData.noCollide = 1;
    const collider = [homeX - width / 2, centerZ - depth / 2, homeX + width / 2, centerZ + depth / 2];
    collider.src = 'proximity-door';
    colliders.push(collider);
    return { leaf, side, homeX, collider };
  });

  return {
    update(dt, position = ctx.player?.pos) {
      open = nextDoorOpen(open, !!position && nearDoor(position, { x: centerX, z: centerZ }, radius), dt);
      for (const { leaf, side, homeX, collider } of panels) {
        leaf.position.x = homeX + side * open * travel;
        collider[0] = leaf.position.x - width / 2;
        collider[2] = leaf.position.x + width / 2;
      }
      return open;
    },
    get open() { return open; },
  };
}
