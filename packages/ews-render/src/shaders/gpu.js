/** WGSL sources for the WebGPU path. Served as JS so the static host needs no extra MIME. */

export const CULL_WGSL = /* wgsl */ `
struct Cluster {
  center: vec4f,
  cone: vec4f,
  err: vec4f,
  world: vec4f,
};
struct View {
  planes: array<vec4f, 6>,
  eye: vec4f,
  params: vec4f, // fovTan, height, pixelLimit, forceMax
};
struct Draw { index: u32, lod: u32, tris: u32, flags: u32 }

@group(0) @binding(0) var<storage, read> clusters: array<Cluster>;
@group(0) @binding(1) var<uniform> view: View;
@group(0) @binding(2) var<storage, read_write> draws: array<Draw>;
@group(0) @binding(3) var<storage, read_write> count: array<atomic<u32>>;

fn in_frustum(c: vec3f, r: f32) -> bool {
  for (var i = 0; i < 6; i++) {
    if (dot(view.planes[i].xyz, c) + view.planes[i].w < -r) { return false; }
  }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&clusters)) { return; }
  let c = clusters[i];
  if (!in_frustum(c.center.xyz, c.center.w)) { return; }
  let toEye = view.eye.xyz - c.center.xyz;
  let dist = max(length(toEye), 0.05);
  let dir = toEye / dist;
  if (c.cone.w < 0.999 && dot(c.cone.xyz, dir) > c.cone.w) { return; }
  let sseOwn = (c.err.x * view.params.y) / (dist * 2.0 * view.params.x);
  let ssePar = (c.err.y * view.params.y) / (dist * 2.0 * view.params.x);
  var keep = false;
  if (view.params.w > 0.5) { keep = c.err.z < 0.5; }
  else { keep = sseOwn <= view.params.z && ssePar > view.params.z; }
  if (!keep) { return; }
  let slot = atomicAdd(&count[0], 1u);
  draws[slot].index = i;
  draws[slot].lod = u32(c.err.z);
  draws[slot].tris = u32(c.err.w);
  draws[slot].flags = select(0u, 1u, sseOwn < view.params.z && (c.center.w * view.params.y) / (dist * 2.0 * view.params.x) < 2.0);
}
`;

export const HIZ_WGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<r32float, write>;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy) * 2;
  let a = textureLoad(src, p, 0).r;
  let b = textureLoad(src, p + vec2i(1, 0), 0).r;
  let c = textureLoad(src, p + vec2i(0, 1), 0).r;
  let d = textureLoad(src, p + vec2i(1, 1), 0).r;
  textureStore(dst, vec2i(id.xy), vec4f(min(min(a, b), min(c, d)), 0.0, 0.0, 1.0));
}
`;

export const VIS_WGSL = /* wgsl */ `
struct VSIn { @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) cluster: u32 }
struct VSOut { @builtin(position) pos: vec4f, @location(0) @interpolate(flat) cluster: u32, @location(1) nrm: vec3f }
struct Frame { vp: mat4x4f, origin: vec4f }
@group(0) @binding(0) var<uniform> F: Frame;
@vertex fn vs(i: VSIn) -> VSOut {
  var o: VSOut;
  o.pos = F.vp * vec4f(i.pos - F.origin.xyz, 1.0);
  o.cluster = i.cluster;
  o.nrm = i.nrm;
  return o;
}
@fragment fn fs(i: VSOut) -> @location(0) u32 { return i.cluster; }
`;

export const SHADE_WGSL = /* wgsl */ `
@group(0) @binding(0) var vis: texture_2d<u32>;
@group(0) @binding(1) var depth: texture_depth_2d;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var maps: texture_2d_array<f32>;
struct Frame { sun: vec4f, res: vec4f }
@group(1) @binding(0) var<uniform> F: Frame;
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let uv = vec2i(p.xy);
  let id = textureLoad(vis, uv, 0).r;
  if (id == 0u) { return vec4f(0.0); }
  let n = textureLoad(maps, vec2i(0), i32(id % 16), 0).xyz * 2.0 - 1.0;
  let lambert = max(0.2, dot(normalize(n), normalize(F.sun.xyz)));
  return vec4f(vec3f(0.35, 0.42, 0.38) * lambert, 1.0);
}
`;

export const TERRAIN_WGSL = /* wgsl */ `
struct VSIn { @location(0) pos: vec3f }
struct VSOut { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) nrm: vec3f }
struct T {
  vp: mat4x4f,
  cam: vec4f,
  ring: vec4f, // cx, cz, step, geomErr
  params: vec4f, // cover, n, fovTan, height
  forceMax: f32,
};
@group(0) @binding(0) var<uniform> U: T;
@group(0) @binding(1) var height: texture_2d<f32>;
fn sampleH(x: f32, z: f32) -> f32 {
  let n = U.params.y;
  let u = (x / U.params.x + 0.5) * (n - 1.0);
  let v = (z / U.params.x + 0.5) * (n - 1.0);
  let texel = vec2i(clamp(i32(u), 0, i32(n) - 1), clamp(i32(v), 0, i32(n) - 1));
  return textureLoad(height, texel, 0).r;
}
@vertex fn vs(i: VSIn) -> VSOut {
  let wx = i.pos.x + U.ring.x;
  let wz = i.pos.z + U.ring.y;
  let d = max(8.0, length(U.cam.xz - U.ring.xy));
  let sse = (U.ring.w * U.params.w) / (d * 2.0 * U.params.z);
  var morph = 0.0;
  if (U.forceMax < 0.5) { morph = clamp((sse - 0.35) / 0.65, 0.0, 1.0); }
  let parent = U.ring.z * 2.0;
  let yFine = sampleH(wx, wz);
  let yCoarse = sampleH(round(wx / parent) * parent, round(wz / parent) * parent);
  let y = mix(yFine, yCoarse, morph);
  var o: VSOut;
  o.world = vec3f(wx, y, wz);
  o.pos = U.vp * vec4f(o.world, 1.0);
  o.nrm = vec3f(0.0, 1.0, 0.0);
  return o;
}
@fragment fn fs(i: VSOut) -> @location(0) vec4f {
  let lambert = max(0.25, dot(normalize(i.nrm), normalize(vec3f(0.4, 1.0, 0.2))));
  return vec4f(vec3f(0.35, 0.48, 0.28) * lambert, 1.0);
}
`;
