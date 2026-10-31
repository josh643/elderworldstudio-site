// Worlds travel: campus launch pad ↔ space (Elderworld + Omnivael) ↔ Omnivael landing (Valtoria frontier).
// Office/town stay on the main scene. Space and Omnivael are separate scenes sharing the engine camera.
// Visuals are EWS-authored / procedural. Unity store-pack assets from josh643/omnivael-wayfarers are not used.
// Lore names (Valtoria, Duskfall Hollow, Whispering Well) are EWS IP from incoming/omnivael/.

function fade(root, on) {
  let el = root.querySelector('.ew-fade');
  if (!el) { el = document.createElement('div'); el.className = 'ew-fade'; root.append(el); }
  el.classList.toggle('on', !!on);
}

function makeVisitor(THREE, mat) {
  const g = new THREE.Group(); g.name = 'visitor';
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x1b3a4a, roughness: 0.55, metalness: 0.15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3ee8ff, roughness: 0.35, metalness: 0.4, emissive: 0x0a2a33, emissiveIntensity: 0.4 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 10), bodyM); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin); head.position.y = 1.62; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.08), accent); visor.position.set(0, 1.64, 0.1); g.add(visor);
  const arms = [-1, 1].map(s => { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 3, 6), bodyM); a.position.set(s * 0.28, 1.15, 0); g.add(a); return a; });
  const legs = [-1, 1].map(s => { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 3, 6), bodyM); a.position.set(s * 0.1, 0.42, 0); g.add(a); return a; });
  g.userData = { arms, legs, body, moving: false, phase: 0 };
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  return g;
}

function starfield(THREE, n) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 80 + Math.random() * 420, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    a[i * 3] = r * Math.sin(p) * Math.cos(t); a[i * 3 + 1] = r * Math.cos(p); a[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
  }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8f2ff, size: 0.9, sizeAttenuation: true }));
}

function planet(THREE, r, c1, c2, clouds = 0) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.85, metalness: 0.05 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), m); g.add(ball);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(r * 1.04, 32, 20), new THREE.MeshBasicMaterial({ color: c2, transparent: true, opacity: 0.18, side: THREE.BackSide }));
  g.add(atm);
  if (clouds) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(r * 1.015, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: clouds, depthWrite: false }));
    g.add(cl); g.userData.clouds = cl;
  }
  g.userData.radius = r;
  return g;
}

function buildSpace(THREE, quality) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02040a); scene.fog = null;
  scene.add(new THREE.AmbientLight(0x88aacc, 0.85));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.1); sun.position.set(40, 20, 10); scene.add(sun);
  scene.add(starfield(THREE, quality?.stars || 2200));
  const elder = planet(THREE, 12, 0x3d6b4a, 0x7fb2e0, 0.12); elder.position.set(-36, -2, -28); elder.name = 'elderworld'; scene.add(elder);
  const omni = planet(THREE, 10, 0x6b8f4e, 0x87afd4, 0.08); omni.position.set(42, 6, -22); omni.name = 'omnivael'; scene.add(omni);
  // thin ring around Omnivael (Bishop-ring silhouette from incoming/omnivael/ringworld-reference.jpg)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.18, 8, 80), new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.75, roughness: 0.28 }));
  ring.rotation.x = 0.7; omni.add(ring);
  const ship = new THREE.Group(); ship.name = 'ship';
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.6, roughness: 0.3 }));
  hull.rotation.z = Math.PI / 2; ship.add(hull);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: 0x3ee8ff, emissive: 0x123, emissiveIntensity: 0.5 }));
  fin.position.set(0, 0.15, 0.55); ship.add(fin);
  scene.add(ship);
  return { scene, elder, omni, ship };
}

function buildOmnivael(THREE, quality) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87afd4);
  scene.fog = null;   // no fog wall — atmosphere is the sky scatter shader only
  scene.add(new THREE.HemisphereLight(0xc8d8e8, 0x4a3f35, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.6); sun.position.set(18, 28, 8); scene.add(sun);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x87afd4) }, hor: { value: new THREE.Color(0xc8d8e8) } },
    vertexShader: 'varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 v; uniform vec3 top,hor; void main(){ gl_FragColor=vec4(mix(hor,top,smoothstep(-0.1,0.7,v.y)),1.0); }',
  }));
  scene.add(sky);
  const seg = quality?.terrainSeg || 48;
  const terrain = new THREE.PlaneGeometry(160, 160, seg, seg); terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = Math.sin(x * 0.07) * 1.4 + Math.cos(z * 0.05) * 1.1 + Math.sin((x + z) * 0.03) * 0.8;
    const d = Math.hypot(x, z); pos.setY(i, d < 14 ? h * 0.15 : h);
  }
  terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, new THREE.MeshLambertMaterial({ color: 0x6b8f4e, vertexColors: false }));
  ground.userData.noCollide = 1; scene.add(ground);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(8, 70), new THREE.MeshLambertMaterial({ color: 0x3d3428 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, 0.04, -8); dirt.userData.noCollide = 1; scene.add(dirt);
  const cols = [];
  const addBox = (w, h, d, c, x, y, z, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
    m.position.set(x, y, z); scene.add(m);
    if (collide) cols.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    return m;
  };
  // palisade + west gate (Duskfall Hollow approach) — procedural timber, not Unity packs
  for (let i = -10; i <= 10; i++) if (Math.abs(i) > 2) addBox(0.35, 3.2, 0.35, 0x5c4a3a, i * 1.15, 1.6, -18);
  addBox(1.2, 3.8, 0.4, 0x4a3a2c, -2.6, 1.9, -18); addBox(1.2, 3.8, 0.4, 0x4a3a2c, 2.6, 1.9, -18);
  addBox(5.4, 0.35, 0.35, 0x5c4a3a, 0, 3.5, -18);
  // Whispering Well
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.7, 12), new THREE.MeshLambertMaterial({ color: 0x6e6560 }));
  well.position.set(-6, 0.35, 4); scene.add(well); cols.push([-6.9, 3.1, -5.1, 4.9]);
  addBox(0.08, 1.1, 0.08, 0x5c4a3a, -6.55, 1.1, 4, false); addBox(0.08, 1.1, 0.08, 0x5c4a3a, -5.45, 1.1, 4, false);
  addBox(1.3, 0.08, 0.08, 0x5c4a3a, -6, 1.65, 4, false);
  // Elements shrine — four geometric pillars, no runes
  for (const [x, z] of [[8, 3], [10, 3], [8, 5], [10, 5]]) addBox(0.28, 1.6, 0.28, 0xb8c0c8, x, 0.8, z);
  addBox(1.6, 0.12, 1.6, 0x6e6560, 9, 0.08, 4, false);
  // logging camp
  for (let i = 0; i < 5; i++) addBox(1.6, 0.28, 0.28, 0x5c4a3a, -10 + i * 0.05, 0.25 + i * 0.12, 8 + i * 0.04, false);
  addBox(1.4, 1.1, 0.9, 0x4a3f35, -9.5, 0.55, 10);
  // landing pad + return portal
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.12, 28), new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.45, roughness: 0.4, emissive: 0x0a2030, emissiveIntensity: 0.3 }));
  pad.position.set(0, 0.07, 10); pad.userData.noCollide = 1; scene.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: 0x3ee8ff }));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.4, 10); scene.add(ring);
  const gate = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 28), new THREE.MeshBasicMaterial({ color: 0xd24bff, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
  gate.position.set(0, 2.4, 10); scene.add(gate);
  // pines (instanced)
  const pine = new THREE.ConeGeometry(1.1, 4.2, 6); const pineM = new THREE.MeshLambertMaterial({ color: 0x2f4a3a });
  const n = quality?.trees || 22; const pines = new THREE.InstancedMesh(pine, pineM, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 70 - 35, z = (Math.sin(i * 78.233) * 24634.863 % 1) * 70 - 45;
    if (Math.hypot(x, z) < 16) continue;
    p.set(x, 2.1, z); s.setScalar(0.8 + (i % 5) * 0.12); pines.setMatrixAt(k++, m4.compose(p, q, s));
  }
  pines.count = k; pines.userData.noCollide = 1; scene.add(pines);
  // distant spire district (ringworld-reference city, low lod)
  for (let i = 0; i < 6; i++) {
    const h = 8 + i * 1.7; addBox(1.1, h, 1.1, 0xe8eef5, 28 + i * 2.2, h / 2, -48, false);
  }
  const visitor = makeVisitor(THREE);
  scene.add(visitor);
  return { scene, cols, bounds: [-36, 36, -40, 32], visitor, gate, pad };
}

export default {
  async setup(ctx) {
    if (!ctx.worlds) return;
    this.ctx = ctx; this.T = ctx.THREE; this.zone = 'town'; this.placed = false;
    this.yaw = ctx.player.yaw; this.pitch = ctx.player.pitch;
    this.quality = { stars: [900, 2200, 4200][ctx.tier] || 2200, trees: [10, 22, 36][ctx.tier] || 22, terrainSeg: [24, 48, 64][ctx.tier] || 48 };
    ctx.provide('worldsTravel', this);
    try {
      const vis = makeVisitor(this.T); vis.visible = !!ctx.thirdPerson; ctx.scene.add(vis); ctx.visitor = vis;
      this.townVisitor = vis;
    } catch (e) { console.warn('worlds visitor', e); }
  },
  get scene() { return this.zone === 'space' ? this.space?.scene : this.zone === 'omnivael' ? this.omni?.scene : this.ctx.scene; },
  ensure() {
    if (!this.space) this.space = buildSpace(this.T, this.quality);
    if (!this.omni) this.omni = buildOmnivael(this.T, this.quality);
  },
  placePad() {
    if (this.placed || !this.ctx.shell) return;
    this.placed = true;
    const { THREE: T } = this.ctx, sh = this.ctx.shell, X0 = sh.EN?.x || 0, Z0 = sh.fZ;
    const x = X0, z = Z0 + 22; this.pad = { x, z };
    const g = new T.Group(); g.position.set(x, 0, z); g.userData.keep = 1; this.ctx.scene.add(g);
    const pad = new T.Mesh(new T.CylinderGeometry(2.6, 2.8, 0.14, 28), new T.MeshStandardMaterial({ color: 0x1a2430, metalness: 0.5, roughness: 0.35, emissive: 0x08202a, emissiveIntensity: 0.45 }));
    pad.position.y = 0.08; g.add(pad);
    const ring = new T.Mesh(new T.TorusGeometry(1.9, 0.06, 8, 28), new T.MeshBasicMaterial({ color: 0x3ee8ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 2.2; g.add(ring);
    const core = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 2.2, 8), new T.MeshBasicMaterial({ color: 0x3ee8ff }));
    core.position.y = 1.2; g.add(core);
    this.ctx.sign('Launch', 'Orbit · Omnivael', x, 3.1, z + 0.2, Math.PI, () => this.go('space'), 2.2);
    this.ctx.spot('launch', [x, 1.6, z + 4], [x, 1.4, z], 'Launch pad');
  },
  go(zone) {
    const z = zone === 'omnivael' || zone === 'space' || zone === 'town' ? zone : 'town';
    this.ensure();
    this.zone = z;
    fade(this.ctx.root, true);
    setTimeout(() => {
      const cam = this.ctx.cam;
      if (z === 'space') {
        cam.near = 0.2; cam.far = 5000; cam.updateProjectionMatrix();
        this.space.ship.position.set(0, 2, 40); this.yaw = Math.PI; this.pitch = -0.12;
        this.ctx.announce?.('Orbit');
      } else if (z === 'omnivael') {
        cam.near = 0.1; cam.far = 2000; cam.updateProjectionMatrix();
        const p = this.ctx.player.pos; p.set(0, 0, 12); this.yaw = Math.PI; this.pitch = 0.1;
        this.ctx.announce?.('Omnivael · Valtoria frontier');
      } else {
        cam.near = 0.1; cam.far = 4000; cam.updateProjectionMatrix();
        if (this.pad) this.ctx.player.teleport(this.pad.x, this.pad.z + 4);
        this.ctx.announce?.('Elderverse campus');
      }
      fade(this.ctx.root, false);
    }, 220);
    return z;
  },
  interact() {
    if (this.zone === 'town' && this.pad) {
      const p = this.ctx.player.pos; if (Math.hypot(p.x - this.pad.x, p.z - this.pad.z) < 4) this.go('space');
    } else if (this.zone === 'space') {
      const s = this.space.ship.position;
      if (s.distanceTo(this.space.omni.position) < 22) this.go('omnivael');
      else if (s.distanceTo(this.space.elder.position) < 24) this.go('town');
    } else if (this.zone === 'omnivael') {
      const p = this.ctx.player.pos; if (Math.hypot(p.x, p.z - 10) < 4) this.go('space');
    }
  },
  tick(dt, io) {
    const { keys, jv } = io;
    if (this.zone === 'space') {
      const ship = this.space.ship;
      this.yaw = io.yaw - (keys.arrowleft || keys.q ? dt * 1.4 : 0) + (keys.arrowright || keys.r ? dt * 1.4 : 0);
      this.pitch = Math.max(-1.1, Math.min(1.1, io.pitch));
      const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - (jv.y || 0);
      const r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + (jv.x || 0);
      const u = (keys[' '] ? 1 : 0) - (keys.c || keys.shift ? 0.35 : 0);
      const fwd = new this.T.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(-this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const right = new this.T.Vector3(-fwd.z, 0, fwd.x).normalize();
      const sp = keys.shift ? 28 : 14;
      ship.position.addScaledVector(fwd, f * dt * sp);
      ship.position.addScaledVector(right, r * dt * sp);
      ship.position.y += u * dt * 10;
      ship.rotation.set(this.pitch * 0.4, this.yaw, 0, 'YXZ');
      const cam = this.ctx.cam;
      cam.position.copy(ship.position).add(new this.T.Vector3(Math.sin(this.yaw) * 6, 2.2, Math.cos(this.yaw) * 6));
      cam.lookAt(ship.position);
      io.pos.copy(ship.position);
      if (keys.e) this.interact();
      this.space.elder.rotation.y += dt * 0.04; this.space.omni.rotation.y += dt * 0.03;
    } else if (this.zone === 'omnivael') {
      const p = io.pos;
      const f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - (jv.y || 0);
      const r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + (jv.x || 0);
      this.yaw = io.yaw; this.pitch = io.pitch;
      if (f || r) {
        const fwd = new this.T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new this.T.Vector3(-fwd.z, 0, fwd.x);
        const sp = keys.shift ? 7.5 : 4.2;
        p.addScaledVector(fwd, f * dt * sp); p.addScaledVector(right, r * dt * sp);
      }
      p.x = Math.max(this.omni.bounds[0] + 1, Math.min(this.omni.bounds[1] - 1, p.x));
      p.z = Math.max(this.omni.bounds[2] + 1, Math.min(this.omni.bounds[3] - 1, p.z));
      const PR = 0.35;
      for (const [x0, z0, x1, z1] of this.omni.cols) {
        if (p.x < x0 - PR || p.x > x1 + PR || p.z < z0 - PR || p.z > z1 + PR) continue;
        const l = p.x - (x0 - PR), rr = (x1 + PR) - p.x, b = p.z - (z0 - PR), ff = (z1 + PR) - p.z, m = Math.min(l, rr, b, ff);
        if (m === l) p.x = x0 - PR; else if (m === rr) p.x = x1 + PR; else if (m === b) p.z = z0 - PR; else p.z = z1 + PR;
      }
      p.y = 0;
      const vis = this.omni.visitor; vis.position.set(p.x, 0, p.z); vis.rotation.y = this.yaw + Math.PI;
      const cam = this.ctx.cam, dist = 4.1;
      cam.position.set(p.x + Math.sin(this.yaw) * dist, 2.2, p.z + Math.cos(this.yaw) * dist);
      cam.lookAt(p.x, 1.3, p.z);
      if (keys.e) this.interact();
    }
  },
  onFrame(dt) {
    if (!this.ctx?.worlds) return;
    this.placePad();
    if (this.townVisitor) {
      const u = this.townVisitor.userData, ph = (u.phase += dt);
      if (u.moving) {
        u.arms[0].rotation.x = Math.sin(ph * 8) * 0.6; u.arms[1].rotation.x = -u.arms[0].rotation.x;
        u.legs[0].rotation.x = -u.arms[0].rotation.x * 0.8; u.legs[1].rotation.x = u.arms[0].rotation.x * 0.8;
      } else { u.arms[0].rotation.x = u.arms[1].rotation.x = u.legs[0].rotation.x = u.legs[1].rotation.x = 0; }
    }
    if (this.zone === 'town' && this.pad && this.ctx.player.pos) {
      const p = this.ctx.player.pos;
      this.near = Math.hypot(p.x - this.pad.x, p.z - this.pad.z) < 4;
    }
  },
};
