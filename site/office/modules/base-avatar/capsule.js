// Shared base avatar (one body for everyone; team colour tint + Norse name/job tag). Provides 'avatar' and 'agents'.
// Later: swap this module for a glTF rig loader with the same API (make(a, colour) -> Group; animate(group, dt, t, cam)).
const STAGE_POSE = { plan: 'type', build: 'type', 'self-check': 'type', QA: 'inspect', review: 'hold', ready: 'hold', released: 'cheer' };
const capsule = {
  setup(ctx) {
    const { THREE, M, mat } = ctx, skin = M(0xe8c8a8);
    const geo = { body: new THREE.CapsuleGeometry(0.17, 0.5, 4, 12), head: new THREE.SphereGeometry(0.115, 16, 12), arm: new THREE.CapsuleGeometry(0.045, 0.58, 3, 8), hand: new THREE.SphereGeometry(0.05, 10, 8), leg: new THREE.CapsuleGeometry(0.065, 0.78, 3, 8), bar: new THREE.PlaneGeometry(0.9, 0.07), flag: new THREE.OctahedronGeometry(0.12) };
    const red = new THREE.MeshBasicMaterial({ color: 0xff4a4a }), barBg = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .6 });
    const agents = new Map(); const all = new Set();
    function make(a, col, onPick) {
      const g = new THREE.Group(), cm = M(col);
      const body = new THREE.Mesh(geo.body, cm); body.position.y = 1.2; body.scale.set(1, 1, 0.65); g.add(body);
      const head = new THREE.Mesh(geo.head, skin); head.position.y = 1.66; head.scale.set(0.9, 1.1, 1); g.add(head);
      const arms = [-1, 1].map(s => { const sh = new THREE.Group(); sh.position.set(s * 0.22, 1.45, 0); const ar = new THREE.Mesh(geo.arm, cm); ar.position.y = -0.33; const hd = new THREE.Mesh(geo.hand, skin); hd.position.y = -0.7; sh.add(ar, hd); g.add(sh); return sh; });
      const legs = [-1, 1].map(s => { const l = new THREE.Mesh(geo.leg, mat.dark); l.position.set(s * 0.09, 0.46, 0); g.add(l); return l; });
      const tag = ctx.label(a.name, a.role); tag.position.y = 2.1; g.add(tag);
      const bar = new THREE.Mesh(geo.bar, mat.glow); bar.position.y = 2.32; bar.visible = false; g.add(bar);
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.11), barBg); bg.position.set(0, 2.32, -0.01); bg.visible = false; g.add(bg);
      const flag = new THREE.Mesh(geo.flag, red); flag.position.y = 2.6; flag.visible = false; g.add(flag);
      g.userData = { a, arms, legs, bar, bg, flag, body, state: {}, target: null, home: null, phase: Math.random() * 6, pose: null };
      if (onPick) { ctx.onClick(body, onPick); ctx.onClick(head, onPick); }
      all.add(g); if (a.id) agents.set(a.id, g); return g;
    }
    const tmp = new THREE.Vector3();
    function animate(av, dt, t) {
      const u = av.userData, s = u.state || {}, ph = u.phase + t, [la, ra] = u.arms; let walking = false;
      if (u.target) { tmp.set(u.target.x - av.position.x, 0, u.target.z - av.position.z); const L = tmp.length();
        if (L > 0.08) { tmp.normalize(); const step = Math.min(L, dt * 1.6), physics = ctx.use('worldPhysics'), result = physics?.move(av, tmp.x * step, tmp.z * step); walking = (result?.actual ?? step) > 0.001; av.rotation.y = Math.atan2(tmp.x, tmp.z); }
        else if (u.home && u.target.equals(u.home)) av.rotation.y = u.homeRot ?? Math.PI; }
      const pose = walking ? 'walk' : u.pose || STAGE_POSE[s.stage] || 'idle';
      la.rotation.set(0, 0, 0); ra.rotation.set(0, 0, 0); u.legs[0].rotation.x = u.legs[1].rotation.x = 0;
      if (pose === 'walk') { la.rotation.x = Math.sin(ph * 8) * 0.6; ra.rotation.x = -la.rotation.x; u.legs[0].rotation.x = -la.rotation.x * 0.8; u.legs[1].rotation.x = la.rotation.x * 0.8; }
      else if (pose === 'type') { la.rotation.x = -1.1 + Math.sin(ph * 14) * 0.12; ra.rotation.x = -1.1 + Math.cos(ph * 13) * 0.12; }
      else if (pose === 'inspect') { ra.rotation.x = -1.4; la.rotation.x = -0.3; }
      else if (pose === 'hold') { la.rotation.x = ra.rotation.x = -0.9; }
      else if (pose === 'cheer') { la.rotation.z = -2.6; ra.rotation.z = 2.6; }
      else if (pose === 'wave') { ra.rotation.z = 2.4 + (Math.sin(t * 0.5) > 0.6 ? Math.sin(ph * 4) * 0.3 : 0); }
      else { la.rotation.x = Math.sin(ph) * 0.05; ra.rotation.x = -la.rotation.x; }
      u.body.position.y = 1.2 + Math.sin(ph * 2) * 0.01;
      const p = s.progress; u.bar.visible = u.bg.visible = p != null && !!s.stage;
      if (u.bar.visible) { u.bar.scale.x = Math.max(0.02, p); u.bar.position.x = -0.45 * (1 - p); u.bar.quaternion.copy(ctx.cam.quaternion); u.bg.quaternion.copy(ctx.cam.quaternion); }
      u.flag.visible = !!s.blocked; if (s.blocked) u.flag.rotation.y = t * 2;
      
    }
    ctx.provide('avatar', { make, animate, all }); ctx.provide('agents', agents);
    this._all = all; this._animate = animate;
  },
  onFrame(dt, t) { for (const av of this._all) this._animate(av, dt, t); },
};
export default capsule;
