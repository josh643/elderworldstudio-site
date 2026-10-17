// WebXR (VR) feature module. Costs nothing on phones: it only adds a button when navigator.xr reports immersive-vr
// support (Quest Browser, PC VR), and the controller code runs only while a VR session is active.
// Locomotion: teleport (point controller at the floor, pull trigger). Comfort: snap turn (thumbstick, 30° default),
// seated/standing height, and a short fade on teleport. Settings persist in localStorage.
export default {
  async setup(ctx, cfg) {
    if (!navigator.xr || !(await navigator.xr.isSessionSupported?.('immersive-vr').catch(() => false))) return;
    const { THREE, renderer: R, rig, scene } = ctx;
    const store = JSON.parse(localStorage.getItem('ews-vr') || '{}');
    const comfort = { snap: store.snap ?? cfg.snapDegrees ?? 30, seated: store.seated ?? false, fade: store.fade ?? true };
    const save = () => localStorage.setItem('ews-vr', JSON.stringify(comfort));
    R.xr.enabled = true; R.xr.setReferenceSpaceType('local-floor');
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.32, 24), new THREE.MeshBasicMaterial({ color: 0xd9b45a }));
    marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
    const fade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
    fade.renderOrder = 999; ctx.cam.add(fade);
    const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), m4 = new THREE.Matrix4(); this.ctrls = [];
    for (let i = 0; i < 2; i++) {
      const c = R.xr.getController(i); rig.add(c);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xd9b45a })); line.scale.z = 8; c.add(line);
      c.userData.aim = null;
      c.addEventListener('selectend', () => { if (!c.userData.aim) return; const p = c.userData.aim; if (comfort.fade) fade.material.opacity = 1; ctx.player.teleport(p.x, p.z); });
      c.addEventListener('connected', e => { c.userData.gp = e.data.gamepad; }); this.ctrls.push(c);
    }
    this.tick = () => {
      marker.visible = false;
      for (const c of this.ctrls) {
        m4.identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(m4);
        c.userData.aim = ray.ray.intersectPlane(floor, hit) && ray.ray.origin.distanceTo(hit) < 12 ? hit.clone() : null;
        if (c.userData.aim) { marker.position.copy(c.userData.aim).setY(0.01); marker.visible = true; }
        const ax = c.userData.gp?.axes?.[2] ?? 0;                                  // snap turn on thumbstick
        if (Math.abs(ax) > 0.7 && !c.userData.turned) { ctx.player.yaw -= Math.sign(ax) * comfort.snap * Math.PI / 180; c.userData.turned = true; }
        if (Math.abs(ax) < 0.3) c.userData.turned = false;
      }
      if (fade.material.opacity > 0) fade.material.opacity = Math.max(0, fade.material.opacity - 0.08);
      rig.position.y = comfort.seated ? 0.45 : 0;
    };
    const enter = async () => { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); R.xr.setSession(s); };
    const b = ctx.hudButton('Enter VR', enter); ctx.sign('Enter VR', 'Headset detected', -5.2, 1.25, 5.2, 0.45, enter, 1.5);
    const comfortCard = () => {
      const c = ctx.card(`<h3>VR comfort</h3><div class="office-lead"><label>Snap turn<select name="snap">${[15, 30, 45, 90].map(d => `<option ${d === comfort.snap ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label><span><input type="checkbox" name="seated" ${comfort.seated ? 'checked' : ''}> Seated mode (raises you to standing height)</span></label>
        <label><span><input type="checkbox" name="fade" ${comfort.fade ? 'checked' : ''}> Fade when teleporting</span></label></div>`);
      c.querySelector('[name=snap]').onchange = e => { comfort.snap = +e.target.value; save(); };
      c.querySelector('[name=seated]').onchange = e => { comfort.seated = e.target.checked; save(); };
      c.querySelector('[name=fade]').onchange = e => { comfort.fade = e.target.checked; save(); };
    };
    ctx.hudButton('VR comfort', comfortCard); ctx.sign('VR comfort', 'Turning, seated mode', -5.2, 0.8, 5.2, 0.45, comfortCard, 1.2);
    b.setAttribute('aria-label', 'Enter virtual reality');
  },
  onFrame() { if (this.tick && this.ctrls?.length && this.ctrls[0].parent) this.tick(); },
};
