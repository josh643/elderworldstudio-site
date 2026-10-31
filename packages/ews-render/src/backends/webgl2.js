import { ATMOSPHERE_VERT, ATMOSPHERE_FRAG } from '../scene/atmosphere.js';
import { cubeSphereGeometry } from '../scene/planet.js';
import { makePlane, sampleHeight, morphClipRing } from '../scene/terrain.js';
import { cullClusters } from '../gpu/cull.js';
import { lookAtVP } from '../math/frustum.js';
import { packClusterRecords } from '../gpu/cull.js';
import { QUALITY, HEIGHT_COVER } from '../constants.js';

const MESH_VERT = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 vp;
uniform vec3 world;
uniform float scale;
varying vec3 n;
void main() {
  n = normal;
  gl_Position = vp * vec4(position * scale + world, 1.0);
}
`;
const MESH_FRAG = /* glsl */ `
precision mediump float;
varying vec3 n;
uniform vec3 color;
void main() {
  float l = max(0.22, dot(normalize(n), normalize(vec3(0.35, 1.0, 0.25))));
  gl_FragColor = vec4(color * l, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  return p;
}

function buf(gl, data, target = null) {
  const b = gl.createBuffer();
  gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
  gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

export async function createWebGL2(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  const meshP = program(gl, MESH_VERT, MESH_FRAG);
  const atmoP = program(gl, `
    attribute vec2 position;
    varying vec3 vDir;
    uniform mat4 invViewProj;
    void main() {
      gl_Position = vec4(position, 1.0, 1.0);
      vec4 far = invViewProj * vec4(position, 1.0, 1.0);
      vDir = normalize(far.xyz / far.w);
    }
  `, ATMOSPHERE_FRAG);
  const quad = buf(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const sphere = cubeSphereGeometry(1, opts.planetDiv || 12);
  const sphV = buf(gl, sphere.positions);
  const sphN = buf(gl, sphere.normals);
  const sphI = buf(gl, sphere.indices, gl.ELEMENT_ARRAY_BUFFER);
  const box = unitBox();
  const boxV = buf(gl, box.positions);
  const boxN = buf(gl, box.normals);
  const boxI = buf(gl, box.indices, gl.ELEMENT_ARRAY_BUFFER);
  const rings = [];
  for (let i = 0; i < (QUALITY[opts.quality || 'auto']?.clips || 6); i++) {
    const size = 32 * Math.pow(2, i);
    const seg = Math.max(8, 32 - i * 4);
    rings.push({ ...makePlane(size, seg), size, seg, i });
  }

  let last = {
    calls: 0, tris: 0, visWrites: 0, bytes: 0,
    backend: 'webgl2',
  };

  function setSize(w, h) {
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function render(view) {
    const w = canvas.width || 1, h = canvas.height || 1;
    const eye = view.eye, target = view.target || [0, 0, 0], up = view.up || [0, 1, 0];
    const fov = view.fov || 62, near = view.near || 0.1, far = view.far || 4000;
    const vp = view.vp || lookAtVP(eye, target, up, fov, w / h, near, far);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.02, 0.04, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    drawAtmo(gl, atmoP, quad, vp, eye);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    let calls = 1, tris = 2;

    if (view.terrain && view.heightfield) {
      for (const ring of rings) {
        const step = 16 * Math.pow(2, ring.i);
        const cx = Math.round(eye[0] / step) * step;
        const cz = Math.round(eye[2] / step) * step;
        const morphed = morphClipRing({
          positions: ring.positions, cx, cz, step,
          field: view.heightfield, cover: view.cover || HEIGHT_COVER,
          cam: eye, fov, height: h, forceMax: view.forceMax,
          geomErr: ring.geomErr,
        });
        const vb = buf(gl, morphed.positions);
        drawIndexed(gl, meshP, vp, vb, ring.indices, [0, 0, 0], 1, [0.35, 0.48, 0.28]);
        calls++; tris += ring.indices.length / 3;
        gl.deleteBuffer(vb);
      }
    }

    const clusters = view.clusters || [];
    const culled = cullClusters(clusters, { eye, vp, fov, height: h, forceMax: view.forceMax });
    const seen = new Set();
    for (const v of culled.visible) {
      if (v.impostor) continue;
      const key = v.instance + ':' + v.lod;
      if (seen.has(key)) continue;
      seen.add(key);
      const c = clusters[v.index];
      const isPlanet = c.catalog === 'planet' || c.catalog === 'elderworld' || c.catalog === 'omnivael';
      if (isPlanet) {
        drawIndexed(gl, meshP, vp, sphV, sphere.indices, c.world, c.drawRadius || c.radius || 1, c.color || [0.35, 0.48, 0.32]);
        tris += sphere.indices.length / 3;
      } else {
        drawIndexed(gl, meshP, vp, boxV, box.indices, c.world, c.drawRadius || c.radius || 1, c.color || [0.42, 0.4, 0.38]);
        tris += box.indices.length / 3;
      }
      calls++;
    }
    last = {
      calls, tris: culled.tris || tris, visWrites: culled.drew,
      culledFrustum: culled.culledFrustum, culledLod: culled.culledLod,
      impostors: culled.impostors,
      bytes: estimateBytes(clusters, rings),
      backend: 'webgl2',
      drew: culled.drew,
    };
    return last;
  }

  function drawAtmo(gl, p, quad, vp, eye) {
    gl.useProgram(p);
    const inv = invert4(vp);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'invViewProj'), false, inv);
    gl.uniform3fv(gl.getUniformLocation(p, 'sunDir'), [0.4, 0.7, 0.3]);
    gl.uniform1f(gl.getUniformLocation(p, 'altitude'), eye[1] || 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(p, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawIndexed(gl, p, vp, vb, indices, world, scale, color) {
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'vp'), false, vp);
    gl.uniform3fv(gl.getUniformLocation(p, 'world'), world);
    gl.uniform1f(gl.getUniformLocation(p, 'scale'), scale);
    gl.uniform3fv(gl.getUniformLocation(p, 'color'), color);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const loc = gl.getAttribLocation(p, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    const nloc = gl.getAttribLocation(p, 'normal');
    if (nloc >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vb === sphV ? sphN : boxN);
      gl.enableVertexAttribArray(nloc);
      gl.vertexAttribPointer(nloc, 3, gl.FLOAT, false, 0, 0);
    }
    const ib = buf(gl, indices instanceof Uint32Array ? indices : new Uint32Array(indices), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    gl.deleteBuffer(ib);
  }

  return {
    name: 'webgl2',
    canvas,
    gl,
    setSize,
    render,
    info: () => last,
    dispose() { /* context lives with the canvas */ },
    packClusterRecords,
  };
}

function unitBox() {
  const p = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ]);
  const n = new Float32Array([
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  const i = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { positions: p, normals: n, indices: i };
}

function estimateBytes(clusters, rings) {
  let n = clusters.length * 64;
  for (const r of rings) n += r.positions.byteLength + r.indices.byteLength;
  return n + (4 << 20);
}

function invert4(m) {
  const a = m, o = new Float32Array(16);
  const n11 = a[0], n12 = a[4], n13 = a[8], n14 = a[12];
  const n21 = a[1], n22 = a[5], n23 = a[9], n24 = a[13];
  const n31 = a[2], n32 = a[6], n33 = a[10], n34 = a[14];
  const n41 = a[3], n42 = a[7], n43 = a[11], n44 = a[15];
  const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
  const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
  const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
  const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  if (!det) return o.fill(0), o[0] = o[5] = o[10] = o[15] = 1, o;
  const id = 1 / det;
  o[0] = t11 * id;
  o[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * id;
  o[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * id;
  o[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * id;
  o[4] = t12 * id;
  o[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * id;
  o[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * id;
  o[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * id;
  o[8] = t13 * id;
  o[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * id;
  o[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * id;
  o[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * id;
  o[12] = t14 * id;
  o[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * id;
  o[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * id;
  o[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * id;
  return o;
}
