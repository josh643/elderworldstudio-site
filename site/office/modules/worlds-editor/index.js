// In-world build mode. Capability comes from the server (/api/worlds/me). Visitors never get edit tools.
// Catalog ids match the host allowlist. No names of people in this file.

const CATALOG = [
  { id: 'block', label: 'Block' }, { id: 'pad', label: 'Pad' }, { id: 'tree', label: 'Tree' },
  { id: 'shrub', label: 'Shrub' }, { id: 'arch', label: 'Arch' }, { id: 'bench', label: 'Bench' },
  { id: 'lot-small', label: 'Lot pad' }, { id: 'well', label: 'Well' }, { id: 'shrine', label: 'Shrine' },
];

function meshFor(T, id) {
  const M = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.7 });
  if (id === 'tree') return new T.Mesh(new T.ConeGeometry(0.7, 2.4, 6), M(0x2f4a3a));
  if (id === 'shrub') return new T.Mesh(new T.SphereGeometry(0.45, 8, 6), M(0x3f7a3a));
  if (id === 'arch') return new T.Mesh(new T.TorusGeometry(1.2, 0.12, 6, 16), M(0xb8c0c8));
  if (id === 'bench') return new T.Mesh(new T.BoxGeometry(1.2, 0.4, 0.4), M(0x6b4a2e));
  if (id === 'lot-small') return new T.Mesh(new T.BoxGeometry(4, 0.08, 4), M(0x8a8478));
  if (id === 'well') return new T.Mesh(new T.CylinderGeometry(0.5, 0.55, 0.6, 10), M(0x6e6560));
  if (id === 'shrine') return new T.Mesh(new T.BoxGeometry(0.3, 1.4, 0.3), M(0xb8c0c8));
  if (id === 'pad') return new T.Mesh(new T.CylinderGeometry(1.4, 1.5, 0.1, 16), M(0x1a2430));
  return new T.Mesh(new T.BoxGeometry(1.2, 1.2, 1.2), M(0x3a6d8c));
}

export default {
  async setup(ctx) {
    if (!ctx.worlds) return;
    this.ctx = ctx; this.T = ctx.THREE; this.group = new ctx.THREE.Group(); this.group.name = 'worlds-editor'; this.group.userData.keep = 1;
    ctx.scene.add(this.group); this.nodes = new Map(); this.moderator = false; this.tool = 'place'; this.catalog = 'block'; this.region = 'town';
    ctx.provide('worldsEditor', this);
    try {
      const me = await (await fetch('/api/worlds/me', { credentials: 'same-origin' })).json();
      this.moderator = !!me.moderator;
    } catch { this.moderator = false; }
    if (this.moderator) this.bar();
    this.pull();
    try {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/office/world');
      ws.addEventListener('message', ev => { try { const m = JSON.parse(ev.data); if (m.t === 'editor' && m.state) this.apply(m.state); if (m.t === 'snap' && m.editor) this.apply(m.editor); } catch {} });
      this.ws = ws;
    } catch { /* static-only host */ }
    const api = window.__ewsWorlds || (window.__ewsWorlds = {});
    api.editor = {
      isModerator: () => this.moderator,
      login: tok => this.login(tok),
      place: (catalog, x, z, region) => this.send({ type: 'prop.place', catalog, x, y: 0, z, ry: 0, region: region || this.region }),
      move: (id, x, z) => this.send({ type: 'prop.move', id, x, z }),
      remove: id => this.send({ type: 'prop.delete', id }),
      sculpt: (mode, x, z, r, amt, region) => this.send({ type: 'terrain.sculpt', mode, x, z, r, amt, region: region || this.region }),
      water: (level, region) => this.send({ type: 'water.set', level, region: region || this.region }),
      undo: () => this.send({ op: 'undo' }),
      state: () => this.last,
    };
  },
  async login(token) {
    const r = await fetch('/api/worlds/session', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ token }) });
    const j = await r.json();
    if (j.ok) { this.moderator = true; this.sid = j.sid; if (!this.ui) this.bar(); }
    return j;
  },
  async pull() {
    try { const s = await (await fetch('/api/worlds/editor')).json(); this.apply(s); } catch { this.last = { props: {}, terrain: {}, water: {} }; }
  },
  async send(body) {
    const r = await fetch('/api/worlds/edit', { method: 'POST', headers: { 'content-type': 'application/json', ...(this.sid ? { authorization: 'Bearer ' + this.sid } : {}) }, credentials: 'same-origin', body: JSON.stringify(body) });
    const j = await r.json();
    if (j.state) this.apply(j.state);
    return j;
  },
  apply(state) {
    this.last = state;
    const seen = new Set();
    for (const p of Object.values(state.props || {})) {
      if (p.region && p.region !== 'town') continue;
      seen.add(p.id);
      let n = this.nodes.get(p.id);
      if (!n) { n = meshFor(this.T, p.catalog); n.userData.propId = p.id; n.userData.keep = 1; this.group.add(n); this.nodes.set(p.id, n); }
      n.position.set(p.x, p.y || 0.6, p.z); n.rotation.y = p.ry || 0;
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) { n.removeFromParent(); this.nodes.delete(id); }
    this.ctx.worldEdit = state;
    this.ctx.use('worldsLod')?.applyTerrain?.(state);
  },
  bar() {
    const ui = document.createElement('div');
    ui.className = 'ew-build';
    ui.innerHTML = `<div class="ew-build-bar">
      <b>BUILD</b>
      <select data-k="catalog">${CATALOG.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}</select>
      <button type="button" data-t="place">Place</button>
      <button type="button" data-t="raise">Raise</button>
      <button type="button" data-t="lower">Lower</button>
      <button type="button" data-t="flatten">Flatten</button>
      <button type="button" data-t="smooth">Smooth</button>
      <button type="button" data-t="water">Water +</button>
      <button type="button" data-t="undo">Undo</button>
    </div>`;
    this.ctx.root.append(ui); this.ui = ui;
    ui.addEventListener('click', e => {
      const t = e.target.getAttribute('data-t'); if (!t) return;
      if (t === 'undo') return this.send({ op: 'undo' });
      if (t === 'water') return this.send({ type: 'water.set', region: 'town', level: ((this.last?.water?.town?.level) ?? -2) + 0.4 });
      this.tool = t; this.catalog = ui.querySelector('[data-k=catalog]').value;
    });
    this.ctx.renderer.domElement.addEventListener('pointerdown', e => {
      if (!this.moderator || this.ctx.menuOpen || e.button) return;
      if (e.target.closest?.('.ew-ui, .ew-build')) return;
      const r = this.ctx.renderer.domElement.getBoundingClientRect();
      const ndc = new this.T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new this.T.Raycaster(); ray.setFromCamera(ndc, this.ctx.cam);
      const hit = new this.T.Vector3();
      if (!ray.ray.intersectPlane(new this.T.Plane(new this.T.Vector3(0, 1, 0), 0), hit)) return;
      if (this.tool === 'place') this.send({ type: 'prop.place', catalog: this.catalog, x: +hit.x.toFixed(2), y: 0, z: +hit.z.toFixed(2), ry: 0, region: 'town' });
      else if (['raise', 'lower', 'flatten', 'smooth'].includes(this.tool)) {
        const sh = this.ctx.shell, bw = 350;
        const u = (hit.x + bw / 2) / bw, v = (hit.z + bw / 2) / bw;
        this.send({ type: 'terrain.sculpt', region: 'town', mode: this.tool, x: u, z: v, r: 0.08, amt: 0.7 });
      }
    });
  },
};
