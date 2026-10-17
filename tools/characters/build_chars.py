# EWS agent characters v1 (2026-10-16). Headless Blender build:
#   blender -b --python build_chars.py -- <M|F> <out.glb>
# Input: the office's own rigged UBC bodies (site/office/assets/anims/human_{Male,Female}_v2.glb, Quaternius CC0) plus
# Quaternius UBC hairstyles (CC0). Output: one GLB per body type holding the SAME 65-bone armature (rest pose untouched,
# so every retargeted clip still plays) and a set of skinned PARTS, two LODs each:
#   body (zones: skin / top / bottom / shoes / forearm / shin), eyes+brows, hairstyles, beard, collar, vest, jacket,
#   hard hat, police cap, duty belt, badge.
# Every part carries the same attributes so the runtime merges an agent's parts into ONE skinned mesh:
#   _zone (palette slot, read by the wardrobe shader), _ao (baked vertex AO), UV into the shared 1024 atlas, and the
#   same 4 morph targets (Heavy, Jaw, Nose, Cheeks) for body shape / face variety.
import bpy, bmesh, sys, math, os, json
from mathutils import Vector
SEX, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
F = SEX == 'F'
ROOT = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
SRC = os.path.join(REPO, 'site/office/assets/anims', 'human_Female_v2.glb' if F else 'human_Male_v2.glb')
HAIRD = '/tmp/ubc/Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/'
Z = dict(skin=0, hair=1, eyes=2, top=3, bottom=4, shoes=5, forearm=6, shin=7, accent=8, hat=9, trim=10, brow=11, belt=12, sole=13)
# atlas rects in Blender UV space (v up): (u0, v0, size_u, size_v)
ATL = dict(skinM=(0, .5, .5, .5), skinF=(.5, .5, .5, .5), hair1=(0, 0, .5, .5), hair2=(.5, .25, .25, .25), eye=(.75, .375, .125, .125), flat=(.9, .47, 0, 0))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
B = arm.data.bones
def bh(n): return arm.matrix_world @ B[n].head_local
HEAD, NECK, PELV, SP3 = bh('Head'), bh('neck_01'), bh('pelvis'), bh('spine_03')
HANDX = abs(bh('hand_l').x); UA = B['upperarm_l']; SX = UA.head_local.x + 0.45 * (UA.tail_local - UA.head_local).length
body0 = [o for o in bpy.data.objects if o.type == 'MESH' and 'Shirt' in [m.name for m in o.data.materials]][0]
eyes0 = bpy.data.objects.get('Eyes')
brow0 = bpy.data.objects.get('Eyebrows_Female' if F else 'Eyebrows_Regular') or bpy.data.objects.get('Eyebrows')
keep = {arm, body0, eyes0, brow0}
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
for o in (body0, eyes0, brow0): o.name = 'src_' + o.name
def close_seams(o, snap=0.012):
    """The UBC body is several open pieces (head/neck, torso, hips, legs, feet) whose border loops nearly meet. Pushed
    garments and per-piece decimation opened those borders into visible slits (the neckline lines and Freyja's hip
    tear). Weld coincident verts, snap each remaining border vertex onto the nearest border vertex of ANOTHER piece
    (both ways, averaged), then weld again, so the body is one closed skin before anything else touches it."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    for _ in range(2):
        bm.verts.ensure_lookup_table()
        comp = {}; cid = 0
        for v in bm.verts:
            if v in comp: continue
            st = [v]; comp[v] = cid
            while st:
                x = st.pop()
                for e in x.link_edges:
                    y = e.other_vert(x)
                    if y not in comp: comp[y] = cid; st.append(y)
            cid += 1
        bv = [v for v in bm.verts if v.is_boundary and v.co.z > 0.02]
        from mathutils.kdtree import KDTree
        kd = KDTree(len(bv)); [kd.insert(v.co, i) for i, v in enumerate(bv)]; kd.balance()
        tgt = {}
        for v in bv:
            best = None
            for co, i, d in kd.find_range(v.co, snap):
                if comp[bv[i]] != comp[v] and (best is None or d < best[1]): best = (i, d)
            if best: tgt[v] = (v.co + bv[best[0]].co) / 2
        for v, c in tgt.items(): v.co = c
        bmesh.ops.remove_doubles(bm, verts=list(tgt), dist=snap * 0.6)
    nb = sum(1 for e in bm.edges if e.is_boundary and min(x.co.z for x in e.verts) > 0.02)
    for e in bm.edges: e.smooth = True          # no sharp edges: the exporter would split normals there (light lines down the legs)
    for f in bm.faces: f.smooth = True
    bm.to_mesh(o.data); bm.free(); o.data.update(); print('SEAMS open border edges after close:', nb)
    sel_only(o)
    try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as ex: print('splitnormals', ex)
REST = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in B}
STATS = {}

def sel_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o

def dup(o, name):
    n = o.copy(); n.data = o.data.copy(); n.name = name; bpy.context.collection.objects.link(n); return n

def welded_normals(cos, nos):
    """one normal per position: verts split at UV/zone seams share it, so pushing never opens cracks"""
    acc = {}
    for i, (c, n) in enumerate(zip(cos, nos)):
        k = (round(c.x, 4), round(c.y, 4), round(c.z, 4)); acc.setdefault(k, Vector()); acc[k] += n
    return [acc[(round(c.x, 4), round(c.y, 4), round(c.z, 4))].normalized() for c in cos]

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def decimate(o, ratio, protect=None, factor=1.0):
    if ratio >= 0.999: return
    if protect:
        g = o.vertex_groups.new(name='_keep')
        for v in o.data.vertices:
            w = protect(o.matrix_world @ v.co)
            if w > 0: g.add([v.index], w, 'REPLACE')
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.use_symmetry = True; m.symmetry_axis = 'X'
    if protect: m.vertex_group = '_keep'; m.invert_vertex_group = True; m.vertex_group_factor = factor
    sel_only(o)
    while o.modifiers[0] != m: bpy.ops.object.modifier_move_up(modifier=m.name)
    bpy.ops.object.modifier_apply(modifier=m.name)
    if protect: o.vertex_groups.remove(o.vertex_groups['_keep'])

def ensure_arm_mod(o):
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': o.modifiers.remove(m)
    o.parent = arm; o.matrix_parent_inverse = arm.matrix_world.inverted()
    md = o.modifiers.new('arm', 'ARMATURE'); md.object = arm

def set_zone_faces(o, fz):
    """fz: face index -> zone. Splits verts at zone borders, then writes the point attribute _zone."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
    zl = bm.faces.layers.int.get('zf') or bm.faces.layers.int.new('zf')
    for f in bm.faces: f[zl] = fz[f.index]
    border = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][zl] != e.link_faces[1][zl]]
    bmesh.ops.split_edges(bm, edges=border)
    bm.to_mesh(o.data); bm.free()
    me = o.data; att = me.attributes.get('_zone') or me.attributes.new('_zone', 'FLOAT', 'POINT')
    zf = me.attributes['zf'].data
    vals = [0.0] * len(me.vertices)
    for p in me.polygons:
        for v in p.vertices: vals[v] = float(zf[p.index].value)
    att.data.foreach_set('value', vals); me.attributes.remove(me.attributes['zf'])

def uv_to_rect(o, rect, faces=None):
    me = o.data; uv = me.uv_layers.active or me.uv_layers.new(name='UVMap')
    while len(me.uv_layers) > 1:
        me.uv_layers.remove([l for l in me.uv_layers if l != me.uv_layers.active][0])
    u0, v0, su, sv = rect
    for p in me.polygons:
        if faces is not None and p.index not in faces: continue
        for li in p.loop_indices:
            d = uv.data[li].uv
            if su == 0: d.x, d.y = u0, v0
            else: d.x, d.y = u0 + min(max(d.x, 0), 1) * su, v0 + min(max(d.y, 0), 1) * sv

def const_zone(o, z):
    set_zone_faces(o, [z] * len(o.data.polygons))

def bind_head(o, bone='Head'):
    o.vertex_groups.clear(); g = o.vertex_groups.new(name=bone); g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE'); ensure_arm_mod(o)

def transfer_weights(o, src):
    """skin an accessory like the body under it (nearest face, interpolated)"""
    o.vertex_groups.clear()
    for g in src.vertex_groups: o.vertex_groups.new(name=g.name)
    m = o.modifiers.new('dt', 'DATA_TRANSFER'); m.object = src; m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'; m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    sel_only(o)
    while o.modifiers[0] != m: bpy.ops.object.modifier_move_up(modifier=m.name)
    bpy.ops.object.modifier_apply(modifier=m.name)
    # normalise + keep 4 influences (glTF limit), drop empties
    me = o.data
    for v in me.vertices:
        gs = sorted(((g.group, g.weight) for g in v.groups), key=lambda t: -t[1])[:4]; s = sum(w for _, w in gs) or 1
        for g in list(v.groups): o.vertex_groups[g.group].remove([v.index])
        for gi, w in gs: o.vertex_groups[gi].add([v.index], w / s, 'REPLACE')
    ensure_arm_mod(o)

close_seams(body0)
# ---------------------------------------------------------------- body
def build_body(lod):
    o = dup(body0, f'body_L{lod}')
    # face/hands keep detail; feet, legs and back (under clothes) decimate hardest
    def protect(c):
        if c.z > NECK.z - 0.02 and c.y < HEAD.y + 0.02: return 1.0           # face front
        if c.z > NECK.z - 0.02: return 0.6                                    # back of head/ears
        if abs(c.x) > HANDX - 0.03: return 0.8                                # hands
        return 0.0
    decimate(o, [0.30, 0.135][lod], protect, [0.85, 0.6][lod])
    bm = bmesh.new(); bm.from_mesh(o.data)
    def cut(co, no, sel):
        geom = [f for f in bm.faces if sel(f.calc_center_median())]
        if not geom: return
        g = list({v for f in geom for v in f.verts}) + list({e for f in geom for e in f.edges}) + geom
        bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
    nk = NECK.z
    WRIST = HANDX - (0.035 if not F else 0.03)
    for s in (1, -1):
        cut(Vector((s * SX, 0, 0)), Vector((1, 0, 0)), lambda c: c.z > nk - 0.25 and abs(c.x - s * SX) < 0.07)
        cut(Vector((s * WRIST, 0, 0)), Vector((1, 0, 0)), lambda c: c.z > nk - 0.25 and abs(c.x - s * WRIST) < 0.07)
    # crew neck (as in tools/anims/shirt_fix.py): 16-plane ellipse + a tilted collar floor
    RX, RY, CY, N = (0.08, 0.072, 0.025, 16) if F else (0.085, 0.078, 0.025, 16)
    planes = []
    for i in range(N):
        th = 2 * math.pi * i / N; p = Vector((RX * math.cos(th), CY + RY * math.sin(th), 0)); n = Vector((math.cos(th) / RX, math.sin(th) / RY, 0)).normalized(); planes.append((p, n, th))
    for p, n, th in planes:
        cut(Vector((p.x, p.y, nk)), n, lambda c, th=th: 1.30 < c.z < nk + 0.15 and abs(((math.atan2((c.y - CY) / RY, c.x / RX) - th + math.pi) % (2 * math.pi)) - math.pi) < 2 * math.pi / N * 0.75)
    NCO = Vector((0, 0, nk - 0.035)); NNO = Vector((0, -0.35, 1)).normalized()
    cut(NCO, NNO, lambda c: nk - 0.15 < c.z < nk + 0.1 and (c.x / RX) ** 2 + ((c.y - CY) / RY) ** 2 < 1.6)
    WAIST = PELV.z + (0.05 if F else 0.045); ANK = 0.125 if not F else 0.115; SHIN = 0.30
    for zc in (WAIST, ANK, SHIN): cut(Vector((0, 0, zc)), Vector((0, 0, 1)), lambda c, zc=zc: abs(c.z - zc) < 0.08 and abs(c.x) < 0.35)
    bm.to_mesh(o.data); bm.free()
    me = o.data; mw = o.matrix_world
    def classify(ob):
        out = []
        for p in ob.data.polygons:
            c = ob.matrix_world @ p.center
            hole = all((c - Vector((q.x, q.y, c.z))).dot(n) < 0 for q, n, _ in planes) and (c - NCO).dot(NNO) > 0
            arm_ = abs(c.x) > 0.2 and c.z > 1.15
            if c.z < ANK: z = Z['shoes']
            elif c.z < SHIN: z = Z['shin']
            elif c.z < WAIST and not arm_: z = Z['bottom']
            elif arm_ and abs(c.x) > WRIST: z = Z['skin']
            elif arm_ and abs(c.x) > SX: z = Z['forearm']
            elif c.z < nk + 0.05 and not hole and not (abs(c.x) > 0.2 and c.z < 1.30): z = Z['top']
            else: z = Z['skin']
            out.append(z)
        return out
    fz = []
    for p in me.polygons:
        c = mw @ p.center
        hole = all((c - Vector((q.x, q.y, c.z))).dot(n) < 0 for q, n, _ in planes) and (c - NCO).dot(NNO) > 0
        arm_ = abs(c.x) > 0.2 and c.z > 1.15
        if c.z < ANK: z = Z['shoes']
        elif c.z < SHIN: z = Z['shin']
        elif c.z < WAIST and not arm_: z = Z['bottom']
        elif arm_ and abs(c.x) > WRIST: z = Z['skin']
        elif arm_ and abs(c.x) > SX: z = Z['forearm']
        elif c.z < nk + 0.05 and not hole and not (abs(c.x) > 0.2 and c.z < 1.30): z = Z['top']
        else: z = Z['skin']
        fz.append(z)
    # garments sit a few mm proud of the skin (no z-fight, a little bulk)
    push = {Z['top']: 0.006, Z['bottom']: 0.005, Z['shoes']: 0.011, Z['shin']: 0.004}
    pv = {}
    for p, z in zip(me.polygons, fz):
        if z in push:
            for v in p.vertices: pv[v] = max(pv.get(v, 0), push[z])
    # garment edges roll onto the skin instead of standing 6 mm proud: a vertex shared with an unpushed (skin) face is held
    # at 1.5 mm, so neckline / sleeve / ankle borders show no lip or sliver (close-up QA 2026-10-17)
    bare = {v for p, z in zip(me.polygons, fz) if z not in push for v in p.vertices}
    bk = {tuple(round(t, 4) for t in me.vertices[v].co) for v in bare}
    from mathutils.kdtree import KDTree
    kd = KDTree(len(bk)); [kd.insert(k, i) for i, k in enumerate(bk)]; kd.balance()
    for v in list(pv):   # ramp from 1.5 mm at the border to full push 3 cm in: no near-vertical sliver faces at the cut
        _, _, d = kd.find(me.vertices[v].co); d = 0 if d is None else d
        pv[v] = min(pv[v], 0.0015 + (pv[v] - 0.0015) * min(1.0, d / 0.03))
    wn = welded_normals([v.co.copy() for v in me.vertices], [v.normal.copy() for v in me.vertices])
    pw = {}
    for v, d in pv.items(): k = tuple(round(t, 4) for t in me.vertices[v].co); pw[k] = max(pw.get(k, 0), d)
    for v in me.vertices:
        k = tuple(round(t, 4) for t in v.co)
        if k in pw: v.co += wn[v.index] * pw[k]
    # feet -> shoes: the bare foot (toes) below the ankle is replaced by a convex-hull shoe per foot (closed toe box,
    # flat sole), skinned like the foot it replaces (Joshua 2026-10-16: Freyja was barefoot)
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    dead = [f for f in bm.faces if (mw @ f.calc_center_median()).z < ANK - 0.012]
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(me); bm.free()
    uv_to_rect(o, ATL['skinF' if F else 'skinM'])
    set_zone_faces(o, classify(o)); ensure_arm_mod(o)
    shoes = build_shoes(lod)
    return o, shoes

def build_shoes(lod):
    """convex hull of each bare foot (full-res source) below the ankle, pushed out a few mm, sole flattened"""
    src = body0; mw = src.matrix_world; ANK = 0.125 if not F else 0.115
    bm = bmesh.new()
    for side in (1, -1):
        pts = [mw @ v.co for v in src.data.vertices if (mw @ v.co).z < ANK + 0.01 and (mw @ v.co).x * side > 0.02]
        vs = [bm.verts.new(p) for p in pts]
        r = bmesh.ops.convex_hull(bm, input=vs)
        for g in r.get('geom_interior', []) + r.get('geom_unused', []):
            if isinstance(g, bmesh.types.BMVert) and g.is_valid and not g.link_faces: bm.verts.remove(g)
    for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * 0.006
    me = bpy.data.meshes.new(f'shoes_L{lod}'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(f'shoes_L{lod}', me); bpy.context.collection.objects.link(o); me.uv_layers.new(name='UVMap')
    decimate(o, [0.5, 0.25][lod])
    fz = [Z['sole'] if (p.normal.z < -0.6 or p.center.z < 0.004) else Z['shoes'] for p in o.data.polygons]
    uv_to_rect(o, ATL['flat']); set_zone_faces(o, fz); transfer_weights(o, body0); return o

def build_face(lod):
    out = []
    if lod == 0:
        e = dup(eyes0, 'eyes_L0'); decimate(e, 0.22); uv_to_rect(e, ATL['eye']); const_zone(e, Z['eyes']); ensure_arm_mod(e); out.append(e)
    return out

HAIRS = (['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale', 'Hair_SimpleParted'] if F else ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Long', 'Hair_Beard'])
HAIR_TEX = {'Hair_Long': 'hair2', 'Hair_Buns': 'hair2', 'Hair_BuzzedFemale': 'hair1', 'Hair_SimpleParted': 'hair1', 'Hair_Buzzed': 'hair1', 'Hair_Beard': 'hair1'}
FEM_HAIR = {'Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale'}
def build_hair(name, lod):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=HAIRD + name + '.gltf')
    new = [o for o in bpy.data.objects if o not in before]; h = [o for o in new if o.type == 'MESH'][0]
    for o in new:
        if o is not h: bpy.data.objects.remove(o)
    w = h.matrix_world.copy(); h.parent = None; h.matrix_world = w; sel_only(h); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    h.name = f'hair_{name}_L{lod}'
    # hairstyles authored for the other head: move/scale about the head bone
    other = (name in FEM_HAIR) != F
    if other and name != 'Hair_Beard':
        dz = (HEAD.z - (1.55 if F else 1.60)) if False else ((1.55 - 1.60) if F else (1.60 - 1.55))
        k = 0.965 if F else 1.04
        for v in h.data.vertices:
            v.co = Vector((v.co.x * k, v.co.y * k + (HEAD.y * (1 - k)), (v.co.z - HEAD.z + (0 if F else 0) - dz) * k + HEAD.z))
    tgt = {'Hair_Long': [460, 200], 'Hair_Buns': [600, 220], 'Hair_SimpleParted': [400, 180], 'Hair_Buzzed': [360, 150], 'Hair_BuzzedFemale': [360, 150], 'Hair_Beard': [200, 90]}[name][lod]
    decimate(h, min(1, tgt / max(1, tris(h))))
    uv_to_rect(h, ATL[HAIR_TEX[name]]); const_zone(h, Z['hair']); bind_head(h)
    return h

# ---------------------------------------------------------------- accessories
def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.uv_layers.new(name='UVMap'); return o

def ring_mesh(name, rings, seg, closed_top=False, closed_bottom=False):
    """rings: list of (z, rx, ry, cy). Builds a tube; optional caps."""
    vs, fs = [], []
    for z, rx, ry, cy in rings:
        for i in range(seg):
            t = 2 * math.pi * i / seg; vs.append((rx * math.cos(t), cy + ry * math.sin(t), z))
    for r in range(len(rings) - 1):
        for i in range(seg):
            a, b = r * seg + i, r * seg + (i + 1) % seg; fs.append((a, b, b + seg, a + seg))
    if closed_top:
        c = len(vs); z, rx, ry, cy = rings[-1]; vs.append((0, cy, z)); base = (len(rings) - 1) * seg
        for i in range(seg): fs.append((base + i, base + (i + 1) % seg, c))
    if closed_bottom:
        c = len(vs); z, rx, ry, cy = rings[0]; vs.append((0, cy, z))
        for i in range(seg): fs.append(((i + 1) % seg, i, c))
    return mesh_obj(name, vs, fs)

def head_top():
    co = [arm.matrix_world @ v.co for v in body0.data.vertices if (arm.matrix_world @ v.co).z > NECK.z]
    return max(c.z for c in co), min(c.y for c in co), max(c.y for c in co), max(abs(c.x) for c in co if c.z > HEAD.z + 0.08)

def body_section(src, z, band=0.015, pad=0.0):
    pts = [src.matrix_world @ v.co for v in src.data.vertices]
    s = [p for p in pts if abs(p.z - z) < band and abs(p.x) < 0.24]
    xs = [abs(p.x) for p in s]; ys = [p.y for p in s]
    return max(xs) + pad, (max(ys) - min(ys)) / 2 + pad, (max(ys) + min(ys)) / 2

def build_hardhat(lod):
    top, ymin, ymax, hx = head_top(); seg = [14, 8][lod]
    # sits on the crown above the brow line (close-up QA 2026-10-17: the first cut covered the eyes)
    cy = (ymin + ymax) / 2 + 0.004; RX = hx + 0.022; RY = (ymax - ymin) / 2 + 0.016; zb = top - 0.072
    rings = [(zb, RX + 0.026, RY + 0.034, cy - 0.01), (zb + 0.01, RX + 0.022, RY + 0.03, cy - 0.01), (zb + 0.014, RX, RY, cy)]
    for k in ([0.45, 0.75, 0.92] if lod == 0 else [0.7]):
        a = math.asin(k); rings.append((zb + 0.014 + 0.09 * k, RX * math.cos(a), RY * math.cos(a), cy))
    o = ring_mesh(f'hardhat_L{lod}', rings, seg, closed_top=True, closed_bottom=False)
    # ridge on top (trim colour) is skipped on LOD1
    uv_to_rect(o, ATL['flat']); const_zone(o, Z['hat']); bind_head(o); return o

def build_cap(lod):
    top, ymin, ymax, hx = head_top(); seg = [14, 8][lod]
    cy = (ymin + ymax) / 2 + 0.004; R = max(hx, (ymax - ymin) / 2) + 0.012; zb = top - 0.075
    rings = [(zb, R, R + 0.008, cy), (zb + 0.022, R + 0.004, R + 0.012, cy), (zb + 0.06, R + 0.018, R + 0.03, cy + 0.006), (zb + 0.072, R * 0.55, R * 0.6, cy + 0.004)]
    o = ring_mesh(f'cap_L{lod}', rings, seg, closed_top=True)
    fz = [Z['hat']] * len(o.data.polygons)
    for p in o.data.polygons:   # band above the brim = trim (gold/checker band reads as police)
        c = p.center
        if zb - 0.001 < c.z < zb + 0.022: fz[p.index] = Z['trim']
    # visor: half-ellipse plate at the front (-Y)
    n0 = len(o.data.vertices); vs = [v.co.copy() for v in o.data.vertices]; fs = [tuple(p.vertices) for p in o.data.polygons]
    vseg = [6, 3][lod]; front = []
    for i in range(vseg + 1):
        t = math.pi + math.pi * i / vseg
        inner = Vector((R * math.cos(t), cy + (R + 0.008) * math.sin(t), zb + 0.002)); outer = Vector((R * 1.05 * math.cos(t), cy + (R + 0.07) * math.sin(t), zb - 0.012))
        front.append((inner, outer))
    for i, (a, b) in enumerate(front): vs += [a, b]
    for i in range(vseg):
        a = n0 + 2 * i; fs.append((a, a + 2, a + 3, a + 1))
    me = o.data; me.clear_geometry(); me.from_pydata([tuple(v) for v in vs], [], fs); me.update(); me.uv_layers.new(name='UVMap')
    fz += [Z['accent']] * vseg
    uv_to_rect(o, ATL['flat']); set_zone_faces(o, fz); bind_head(o); return o

def shell_from_body(src, name, sel, off, zone, drop_front=0.0, hem=0.0, dec=1.0, vee=False):
    """duplicate the body faces picked by sel(centre) and push them out along the normal: vests, jackets"""
    o = dup(src, name)
    for a in list(o.data.attributes):
        if a.name == '_zone': o.data.attributes.remove(a); break
    bm = bmesh.new(); bm.from_mesh(o.data); mw = o.matrix_world
    dead = [f for f in bm.faces if not sel(mw @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    if drop_front:
        nk = NECK.z
        def opening(c):   # V when vee=True: width grows from the button point up to the collar
            if c.y > 0.0: return False
            if vee: zv = SP3.z - 0.06; return c.z > zv and abs(c.x) < drop_front * (c.z - zv) / (nk - zv)
            return abs(c.x) < drop_front
        cuts = [(Vector((s_ * drop_front, 0, 0)), Vector((1, 0, 0))) for s_ in (1, -1)] if not vee else \
               [(Vector((0, 0, SP3.z - 0.06)), Vector((-(nk - SP3.z + 0.06), 0, s_ * drop_front)).normalized()) for s_ in (1, -1)]
        for co, no in cuts:
            g = list(bm.verts) + list(bm.edges) + list(bm.faces); bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if opening(f.calc_center_median())], context='FACES')
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    wn = welded_normals([v.co.copy() for v in bm.verts], [v.normal.copy() for v in bm.verts])
    for v, n in zip(list(bm.verts), wn): v.co += n * off
    if hem:   # extend the bottom border loop downward (jacket/vest hem hangs below the waistband)
        edges = [e for e in bm.edges if e.is_boundary and min(v.co.z for v in e.verts) < PELV.z + 0.12]
        r = bmesh.ops.extrude_edge_only(bm, edges=edges); nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
        for v in nv: v.co.z -= hem; v.co += Vector((v.co.x, v.co.y - 0.03, 0)).normalized() * 0.006 if (v.co.x or v.co.y) else Vector()
    bm.to_mesh(o.data); bm.free()
    if dec < 1: decimate(o, dec)
    uv_to_rect(o, ATL['flat']); const_zone(o, zone); ensure_arm_mod(o); return o

def torso_sel(c, armhole=0.19, low=None):
    lo = (PELV.z + 0.03) if low is None else low
    return lo < c.z < NECK.z - 0.04 and abs(c.x) < armhole

def build_vest(src, lod, kind):
    o = shell_from_body(BODY[0], f'vest_{kind}_L{lod}', lambda c: torso_sel(c, 0.165 if F else 0.18), 0.016 + 0.006 * lod, Z['accent'], drop_front=0.022, hem=0.05, dec=[1, 0.3][lod])
    if kind == 'hivis':   # two reflective bands
        fz = []
        for p in o.data.polygons:
            c = o.matrix_world @ p.center; t = (c.z - PELV.z) / (NECK.z - PELV.z)
            fz.append(Z['trim'] if (0.26 < t < 0.36 or 0.56 < t < 0.66) else Z['accent'])
        set_zone_faces(o, fz)
    else:                 # field vest: pockets read as trim patches
        fz = []
        for p in o.data.polygons:
            c = o.matrix_world @ p.center; t = (c.z - PELV.z) / (NECK.z - PELV.z)
            fz.append(Z['trim'] if (c.y < 0 and 0.06 < abs(c.x) < 0.14 and (0.12 < t < 0.3 or 0.55 < t < 0.68)) else Z['accent'])
        set_zone_faces(o, fz)
    return o

def build_jacket(src, lod):
    WR = HANDX - 0.06
    def sel(c):
        if abs(c.x) > 0.19 and c.z > 1.15: return abs(c.x) < WR    # sleeves to just short of the shirt cuff
        return torso_sel(c, 0.21)
    return shell_from_body(BODY[0], f'jacket_L{lod}', sel, 0.012 + 0.008 * lod, Z['accent'], drop_front=0.085, hem=0.11, dec=[0.75, 0.3][lod], vee=True)

def build_collar(lod):
    nk = NECK.z; seg = [16, 8][lod]
    RX, RY, CY = (0.072, 0.066, 0.03) if F else (0.08, 0.074, 0.03)
    o = ring_mesh(f'collar_L{lod}', [(nk - 0.04, RX + 0.012, RY + 0.012, CY), (nk - 0.005, RX - 0.002, RY - 0.004, CY + 0.004), (nk + 0.01, RX + 0.004, RY + 0.004, CY + 0.006)], seg)
    # open the front (the shirt's placket)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < CY - RY * 0.8 and abs(f.calc_center_median().x) < RX * 0.45], context='FACES')
    bm.to_mesh(o.data); bm.free(); o.data.uv_layers.new(name='UVMap') if not o.data.uv_layers else None
    uv_to_rect(o, ATL['flat']); const_zone(o, Z['top']); transfer_weights(o, BODY[lod]); return o

def build_belt(lod):
    z = PELV.z + 0.035; rx, ry, cy = body_section(BODY[lod], z, pad=0.012)
    seg = [16, 8][lod]
    o = ring_mesh(f'belt_L{lod}', [(z - 0.025, rx, ry, cy), (z + 0.025, rx, ry, cy)], seg)
    vs = [v.co.copy() for v in o.data.vertices]; fs = [tuple(p.vertices) for p in o.data.polygons]
    if lod == 0:   # holster/pouch boxes on the hips
        for sx, w in ((1, 0.05), (-1, 0.04)):
            x0 = sx * (rx - 0.005); c = Vector((x0 + sx * 0.012, cy + 0.01, z - 0.02)); d = Vector((0.018, w / 2, 0.045))
            n0 = len(vs)
            for i in (-1, 1):
                for j in (-1, 1):
                    for k in (-1, 1): vs.append(c + Vector((i * d.x, j * d.y, k * d.z)))
            for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)): fs.append(tuple(n0 + t for t in q))
    me = o.data; me.clear_geometry(); me.from_pydata([tuple(v) for v in vs], [], fs); me.update(); me.uv_layers.new(name='UVMap')
    uv_to_rect(o, ATL['flat']); const_zone(o, Z['belt']); transfer_weights(o, BODY[lod]); return o

def build_badge(lod):
    z = SP3.z + (0.0 if F else 0.02); x = 0.075 if not F else 0.07
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(BODY[lod], dg)
    hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0))); y = (hit[0].y if hit[0] else -0.12) - 0.006
    s = 0.022; vs = [(x - s, y, z - s * 1.2), (x + s, y, z - s * 1.2), (x + s, y, z + s), (x, y, z + s * 1.4), (x - s, y, z + s)]
    o = mesh_obj(f'badge_L{lod}', vs, [(0, 1, 2, 3, 4)]); uv_to_rect(o, ATL['flat']); const_zone(o, Z['trim']); transfer_weights(o, BODY[lod]); return o

# ---------------------------------------------------------------- morphs (same spatial functions on every part)
def g(x, s): return math.exp(-(x * x) / (2 * s * s))
FACEY = None
def morph_fns():
    face_front = min((arm.matrix_world @ v.co).y for v in body0.data.vertices if (arm.matrix_world @ v.co).z > NECK.z)
    hz = HEAD.z; nose = Vector((0, face_front, hz + (0.065 if not F else 0.06)))
    belly_z = PELV.z + 0.14
    def heavy(c):
        if abs(c.x) > 0.24 and c.z > 1.1: return Vector()
        w = g(c.z - belly_z, 0.13) * (1 if c.z < SP3.z + 0.05 else 0.3)
        r = Vector((c.x, c.y - 0.02, 0));
        if r.length < 1e-4: return Vector()
        r.normalize(); front = 1.6 if c.y < 0 else 0.7
        dz = 0.045 * w * front
        legs = g(c.z - (PELV.z - 0.14), 0.09) * 0.012 if c.z < PELV.z else 0
        return r * (dz + legs) + Vector((0, 0, 0))
    def jaw(c):
        if c.z < NECK.z - 0.03 or c.z > hz + 0.075 or abs(c.x) > 0.11: return Vector()
        w = min(1, max(0, (hz + 0.075 - c.z) / 0.06)) * (1 if c.y < HEAD.y + 0.05 else 0.4)
        return Vector((c.x * 0.09 * w, 0, -0.004 * w))
    def nosef(c):
        d = (c - nose).length; w = g(d, 0.018)
        return Vector((0, -0.007 * w, -0.003 * w))
    def cheeks(c):
        p = Vector((0.045 * (1 if c.x >= 0 else -1), face_front + 0.03, hz + 0.05)); w = g((c - p).length, 0.025)
        r = Vector((c.x, c.y - HEAD.y, 0)).normalized() if (c.x or c.y) else Vector()
        return r * 0.006 * w
    return [('Heavy', heavy), ('Jaw', jaw), ('Nose', nosef), ('Cheeks', cheeks)]

def add_morphs(o, fns):
    sel_only(o); o.shape_key_add(name='Basis', from_mix=False)
    mw = o.matrix_world; inv = mw.inverted_safe().to_3x3()
    for name, fn in fns:
        k = o.shape_key_add(name=name, from_mix=False)
        for i, v in enumerate(o.data.vertices):
            k.data[i].co = v.co + inv @ fn(mw @ v.co)

# ---------------------------------------------------------------- AO bake (vertex), stored as _ao
def bake_ao(parts, occluders):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    sc.render.bake.target = 'VERTEX_COLORS'; sc.world = sc.world or bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.12 if hasattr(sc.world.light_settings, 'distance') else 0
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = o not in occluders and o not in parts
    for o in parts:
        me = o.data
        ca = me.color_attributes.new('aoc', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
        if not me.materials:
            m = bpy.data.materials.new('w_' + o.name); m.use_nodes = True; me.materials.append(m)
        sel_only(o)
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        vals = [0.0] * (len(me.vertices) * 4); ca.data.foreach_get('color', vals)
        acc = {}   # one AO per position (split seam verts would otherwise shade differently: light lines down the legs)
        for v in me.vertices: k = tuple(round(t, 4) for t in v.co); acc.setdefault(k, []).append(vals[v.index * 4])
        for v in me.vertices: k = tuple(round(t, 4) for t in v.co); vals[v.index * 4] = sum(acc[k]) / len(acc[k])
        lo = 0.3 if o.name.startswith(('body', 'eyes')) else 0.45 if o.name.startswith('hair') else 0.6
        att = me.attributes.new('_ao', 'FLOAT', 'POINT'); att.data.foreach_set('value', [min(1, lo + (1 - lo) * vals[i * 4]) for i in range(len(me.vertices))])
        me.color_attributes.remove(me.color_attributes['aoc'])

# ---------------------------------------------------------------- build
BODY = {}
ALL = []
for lod in (0, 1):
    b, sh = build_body(lod); BODY[lod] = b; ALL += [b, sh]
    ALL += build_face(lod)
    for h in HAIRS: ALL.append(build_hair(h, lod))
    ALL += [build_hardhat(lod), build_cap(lod), build_collar(lod), build_belt(lod), build_badge(lod),
            build_vest(b, lod, 'field'), build_vest(b, lod, 'hivis'), build_jacket(b, lod)]
for o in ALL:
    for m in list(o.modifiers):
        if m.type != 'ARMATURE': o.modifiers.remove(m)
# AO per LOD: body + face + a short hairstyle + collar as the occluders for the base parts; accessories bake against the body
for lod in (0, 1):
    base = [o for o in ALL if o.name.endswith(f'_L{lod}')]
    bake_ao(base, [BODY[lod]])
fns = morph_fns()
for o in ALL: add_morphs(o, fns)
# one shared material (the runtime replaces it with the wardrobe shader)
mat = bpy.data.materials.new('EWS_Wardrobe')
for o in ALL:
    o.data.materials.clear(); o.data.materials.append(mat)
    STATS[o.name] = tris(o)
for o in (body0, eyes0, brow0): bpy.data.objects.remove(o)
# rest pose must be the source's exactly (the retargeted clip library depends on it)
for b in arm.data.bones:
    h, t = REST[b.name]; assert (b.head_local - h).length < 1e-6 and (b.tail_local - t).length < 1e-6, b.name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=False, export_attributes=True, export_morph_normal=False,
                          export_skins=True, export_morph=True, export_materials='PLACEHOLDER', export_yup=True, export_apply=False)
json.dump(STATS, open(OUT + '.tris.json', 'w'), indent=1)
print('BUILT', OUT, json.dumps(STATS))
