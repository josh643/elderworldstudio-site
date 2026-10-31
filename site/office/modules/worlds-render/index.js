// Phase 2 hook: load packages/ews-render behind the ewsrender flag.
// Off by default — /worlds/ stays on the Phase 1 three.js path.
// When on: GPU/CPU cluster pick, cube-sphere planets, scattering sky, streamed mips.

export default {
  async setup(ctx) {
    if (!ctx.worlds) return;
    this.ctx = ctx;
    if (!ctx.ewsRenderFlag) {
      ctx.provide('ewsRender', null);
      return;
    }
    try {
      const { create } = await import('/packages/ews-render/src/index.js');
      const r = await create({
        fallback: 'webgl2',
        adapter: true,
        quality: ctx.qualityMode || 'auto',
        clustersUrl: '/office/assets/worlds/lod-clusters.json',
      });
      this.r = r;
      ctx.ewsRender = r;
      ctx.provide('ewsRender', r);
      const api = window.__ewsWorlds || (window.__ewsWorlds = {});
      api.ewsRenderMetrics = () => r.metrics();
      api.ewsRenderBackend = () => r.backend;
      this.patchTravel();
    } catch (e) {
      console.warn('ews-render unavailable, staying on Phase 1', e);
      ctx.provide('ewsRender', null);
    }
  },
  patchTravel() {
    const travel = this.ctx.use('worldsTravel');
    const r = this.r;
    if (!travel || !r) return;
    travel.ensure?.();
    if (travel.space && !travel.space._ewsPatched) {
      upgradePlanet(this.ctx.THREE, travel.space.elder, r, 12, 0x3d6b4a);
      upgradePlanet(this.ctx.THREE, travel.space.omni, r, 10, 0x6b8f4e);
      travel.space._ewsPatched = 1;
    }
    if (travel.omni && !travel.omni._ewsPatched) {
      const scene = travel.omni.scene;
      scene.fog = null;
      scene.traverse(o => {
        if (o.isMesh && o.material?.isShaderMaterial && o.geometry?.type === 'SphereGeometry') {
          o.material = new this.ctx.THREE.ShaderMaterial({
            side: this.ctx.THREE.BackSide,
            depthWrite: false,
            uniforms: {
              sunDir: { value: new this.ctx.THREE.Vector3(0.4, 0.7, 0.3) },
              altitude: { value: 2 },
            },
            vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: [
              'varying vec3 vDir; uniform vec3 sunDir; uniform float altitude;',
              'void main(){',
              'vec3 vd=normalize(vDir); float mu=clamp(dot(vd,normalize(sunDir)),-1.0,1.0);',
              'float pr=0.0596831*(1.0+mu*mu); float g=0.76; float g2=g*g;',
              'float pm=0.119366*(1.0-g2)/(2.0+g2)*(1.0+mu*mu)/pow(1.0+g2-2.0*g*mu,1.5);',
              'float od=exp(-max(altitude,0.0)/8000.0)*8000.0;',
              'vec3 RAYLEIGH=vec3(5.8e-6,13.5e-6,33.1e-6); vec3 tR=exp(-RAYLEIGH*od*1.0e5);',
              'float tM=exp(-21.0e-6*od*1.0e5); float lift=0.22+0.55*max(vd.y,0.0);',
              'vec3 sun=vec3(1.0,0.95,0.85);',
              'vec3 rgb=(sun*(1.0-tR)*pr+sun*(1.0-tM)*pm*0.4)*12.0+vec3(lift*0.25,lift*0.32,lift*0.48);',
              'gl_FragColor=vec4(clamp(rgb,0.0,1.5),1.0); }',
            ].join('\n'),
          });
        }
      });
      travel.omni._ewsPatched = 1;
    }
  },
  onFrame(dt) {
    if (!this.r || !this.ctx?.worlds) return;
    this.r.tick(dt);
    this.patchTravel();
    const editor = this.ctx.use('worldsEditor');
    if (editor?.nodes) {
      const inst = [];
      for (const [id, n] of editor.nodes) {
        inst.push({
          id, catalog: n.userData.catalog || 'block',
          x: n.position.x, y: n.position.y, z: n.position.z, ry: n.rotation.y,
        });
      }
      this.r.setInstances(inst);
    }
  },
};

function upgradePlanet(THREE, group, r, radius) {
  if (!group) return;
  const geo = r.toThreeGeometry(THREE, r.cubeSphere(radius, 20));
  group.traverse(o => {
    if (o.isMesh && o.geometry?.type === 'SphereGeometry' && !o.material.transparent) {
      o.geometry.dispose();
      o.geometry = geo;
    }
  });
}
