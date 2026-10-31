/**
 * View-ray Rayleigh + Mie scattering. Not a fog wall: transmittance never
 * crushes distant objects to a solid color, and density falls with altitude.
 */

export const RAYLEIGH = [5.8e-6, 13.5e-6, 33.1e-6];
export const MIE = 21e-6;
export const MIE_G = 0.76;

export function rayleighPhase(mu) {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}

export function miePhase(mu, g = MIE_G) {
  const g2 = g * g;
  const n = (1 - g2);
  const d = Math.pow(1 + g2 - 2 * g * mu, 1.5);
  return (3 / (8 * Math.PI)) * n / (2 + g2) * (1 + mu * mu) / Math.max(1e-6, d);
}

export function opticalDepth(height, scaleH, steps, dirY) {
  // Integrate exp(-h/H) along a short upward/along-view path.
  let acc = 0;
  const ds = 1 / steps;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * ds;
    const h = Math.max(0, height + dirY * t * scaleH * 4);
    acc += Math.exp(-h / scaleH) * ds;
  }
  return acc * scaleH * 4;
}

/**
 * In-scattered sky color + transmittance for a view direction.
 * `sunDir` and `viewDir` are unit vectors. `altitude` in metres.
 */
export function scatterSky(viewDir, sunDir, altitude = 2, opts = {}) {
  const mu = Math.max(-1, Math.min(1, viewDir[0] * sunDir[0] + viewDir[1] * sunDir[1] + viewDir[2] * sunDir[2]));
  const pr = rayleighPhase(mu);
  const pm = miePhase(mu, opts.g ?? MIE_G);
  const od = opticalDepth(Math.max(0, altitude), opts.scaleH || 8000, 8, Math.max(0.05, viewDir[1]));
  const sun = opts.sun || [1, 0.95, 0.85];
  const tR = [
    Math.exp(-RAYLEIGH[0] * od * 1e5),
    Math.exp(-RAYLEIGH[1] * od * 1e5),
    Math.exp(-RAYLEIGH[2] * od * 1e5),
  ];
  const tM = Math.exp(-MIE * od * 1e5);
  // Horizon lift so space/ground never become a wall of grey.
  const lift = 0.22 + 0.55 * Math.max(0, viewDir[1]);
  const rgb = [
    (sun[0] * (1 - tR[0]) * pr + sun[0] * (1 - tM) * pm * 0.4) * 12 + lift * 0.25,
    (sun[1] * (1 - tR[1]) * pr + sun[1] * (1 - tM) * pm * 0.4) * 12 + lift * 0.32,
    (sun[2] * (1 - tR[2]) * pr + sun[2] * (1 - tM) * pm * 0.4) * 12 + lift * 0.48,
  ];
  const trans = (tR[0] + tR[1] + tR[2]) / 3 * tM;
  return {
    rgb: rgb.map(c => Math.min(1.5, Math.max(0, c))),
    transmittance: Math.max(0.35, trans), // never zero — no fog wall
  };
}

export function fogWallForbidden(sceneFog) {
  return sceneFog == null || sceneFog === false;
}

export const ATMOSPHERE_VERT = /* glsl */ `
varying vec3 vDir;
uniform mat4 invViewProj;
void main() {
  vec2 uv = position.xy;
  gl_Position = vec4(uv, 1.0, 1.0);
  vec4 far = invViewProj * vec4(uv, 1.0, 1.0);
  vDir = normalize(far.xyz / far.w);
}
`;

export const ATMOSPHERE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir;
uniform float altitude;
const vec3 RAYLEIGH = vec3(5.8e-6, 13.5e-6, 33.1e-6);
void main() {
  vec3 vd = normalize(vDir);
  float mu = clamp(dot(vd, normalize(sunDir)), -1.0, 1.0);
  float pr = 0.0596831 * (1.0 + mu * mu);
  float g = 0.76; float g2 = g * g;
  float pm = 0.119366 * (1.0 - g2) / (2.0 + g2) * (1.0 + mu * mu) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
  float od = exp(-max(altitude, 0.0) / 8000.0) * 8000.0;
  vec3 tR = exp(-RAYLEIGH * od * 1.0e5);
  float tM = exp(-21.0e-6 * od * 1.0e5);
  float lift = 0.22 + 0.55 * max(vd.y, 0.0);
  vec3 sun = vec3(1.0, 0.95, 0.85);
  vec3 rgb = (sun * (1.0 - tR) * pr + sun * (1.0 - tM) * pm * 0.4) * 12.0 + vec3(lift * 0.25, lift * 0.32, lift * 0.48);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.5), 1.0);
}
`;

export const ATMOSPHERE_WGSL = /* wgsl */ `
struct Atmo {
  sunDir: vec4f,
  invVP: mat4x4f,
  altitude: f32,
  _p0: f32,
  _p1: f32,
  _p2: f32,
};
@group(0) @binding(0) var<uniform> U: Atmo;
struct VSOut { @builtin(position) pos: vec4f, @location(0) dir: vec3f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VSOut;
  o.pos = vec4f(p[i], 1.0, 1.0);
  let far = U.invVP * vec4f(p[i], 1.0, 1.0);
  o.dir = normalize(far.xyz / far.w);
  return o;
}
@fragment fn fs(i: VSOut) -> @location(0) vec4f {
  let vd = normalize(i.dir);
  let mu = clamp(dot(vd, normalize(U.sunDir.xyz)), -1.0, 1.0);
  let pr = 0.0596831 * (1.0 + mu * mu);
  let g = 0.76; let g2 = g * g;
  let pm = 0.119366 * (1.0 - g2) / (2.0 + g2) * (1.0 + mu * mu) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
  let od = exp(-max(U.altitude, 0.0) / 8000.0) * 8000.0;
  let RAYLEIGH = vec3f(5.8e-6, 13.5e-6, 33.1e-6);
  let tR = exp(-RAYLEIGH * od * 1.0e5);
  let tM = exp(-21.0e-6 * od * 1.0e5);
  let lift = 0.22 + 0.55 * max(vd.y, 0.0);
  let sun = vec3f(1.0, 0.95, 0.85);
  let rgb = (sun * (1.0 - tR) * pr + sun * (1.0 - tM) * pm * 0.4) * 12.0 + vec3f(lift * 0.25, lift * 0.32, lift * 0.48);
  return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.5)), 1.0);
}
`;
