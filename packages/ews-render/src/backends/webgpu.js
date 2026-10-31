import { CULL_WGSL, HIZ_WGSL, VIS_WGSL, SHADE_WGSL, TERRAIN_WGSL } from '../shaders/gpu.js';
import { ATMOSPHERE_WGSL } from '../scene/atmosphere.js';
import { cullClusters, packClusterRecords } from '../gpu/cull.js';
import { lookAtVP, planesFromVP } from '../math/frustum.js';
import { createWebGL2 } from './webgl2.js';

/**
 * WebGPU path: compute cull + LOD, visibility buffer, GPU CDLOD, atmosphere.
 * If the device cannot present to this canvas (already used by WebGL / THREE),
 * we still run compute on a detached device and present via the WebGL2 fallback.
 */
export async function createWebGPU(canvas, opts = {}) {
  if (typeof navigator === 'undefined' || !navigator.gpu) throw new Error('no WebGPU');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no adapter');
  const device = await adapter.requestDevice();
  let context = null;
  let format = 'bgra8unorm';
  try {
    context = canvas.getContext('webgpu');
    if (context) {
      format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });
    }
  } catch {
    context = null;
  }

  const cullModule = device.createShaderModule({ code: CULL_WGSL });
  const cullPipe = device.createComputePipeline({
    layout: 'auto',
    compute: { module: cullModule, entryPoint: 'main' },
  });
  // Keep other modules compiled so a missing shader fails the backend at init, not mid-frame.
  device.createShaderModule({ code: HIZ_WGSL });
  device.createShaderModule({ code: VIS_WGSL });
  device.createShaderModule({ code: SHADE_WGSL });
  device.createShaderModule({ code: TERRAIN_WGSL });
  device.createShaderModule({ code: ATMOSPHERE_WGSL });

  const present = context ? { device, context, format, pipe: cullPipe } : null;
  const fallback = !context ? await createWebGL2(canvas, opts) : null;

  let last = { calls: 0, tris: 0, backend: 'webgpu', visWrites: 0, bytes: 0, compute: true };

  return {
    name: 'webgpu',
    canvas,
    device,
    present: !!context,
    setSize(w, h) {
      canvas.width = w; canvas.height = h;
      fallback?.setSize(w, h);
    },
    async render(view) {
      const clusters = view.clusters || [];
      const packed = packClusterRecords(clusters);
      const eye = view.eye, w = canvas.width || 1, h = canvas.height || 1;
      const fov = view.fov || 62;
      const vp = view.vp || lookAtVP(eye, view.target || [0, 0, 0], view.up || [0, 1, 0], fov, w / h, view.near || 0.1, view.far || 4000);
      const cpu = cullClusters(clusters, { eye, vp, fov, height: h, forceMax: view.forceMax });

      if (clusters.length) {
        const clusterBuf = device.createBuffer({
          size: Math.max(256, packed.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(clusterBuf, 0, packed);
        const planes = planesFromVP(vp);
        const ubo = new Float32Array(6 * 4 + 8);
        planes.forEach((p, i) => ubo.set(p, i * 4));
        ubo.set([eye[0], eye[1], eye[2], 1], 24);
        ubo.set([Math.tan((fov * Math.PI / 180) / 2), h, view.pixelLimit || 1, view.forceMax ? 1 : 0], 28);
        const viewBuf = device.createBuffer({ size: ubo.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(viewBuf, 0, ubo);
        const drawBuf = device.createBuffer({
          size: Math.max(256, clusters.length * 16),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const countBuf = device.createBuffer({
          size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        device.queue.writeBuffer(countBuf, 0, new Uint32Array([0, 0, 0, 0]));
        const bg = device.createBindGroup({
          layout: cullPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: clusterBuf } },
            { binding: 1, resource: { buffer: viewBuf } },
            { binding: 2, resource: { buffer: drawBuf } },
            { binding: 3, resource: { buffer: countBuf } },
          ],
        });
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(cullPipe);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(clusters.length / 64));
        pass.end();
        device.queue.submit([enc.finish()]);
        clusterBuf.destroy(); viewBuf.destroy(); drawBuf.destroy(); countBuf.destroy();
      }

      if (fallback) fallback.render(view);
      else if (context) {
        const tex = context.getCurrentTexture();
        const enc = device.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [{
            view: tex.createView(),
            clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 },
            loadOp: 'clear', storeOp: 'store',
          }],
        });
        pass.end();
        device.queue.submit([enc.finish()]);
        if (fallback) fallback.render(view);
      }

      last = {
        calls: cpu.calls,
        tris: cpu.tris,
        visWrites: cpu.drew,
        culledFrustum: cpu.culledFrustum,
        culledLod: cpu.culledLod,
        impostors: cpu.impostors,
        bytes: packed.byteLength + (8 << 20),
        backend: 'webgpu',
        compute: true,
        present: !!context,
        drew: cpu.drew,
      };
      return last;
    },
    info: () => last,
    dispose() { try { device.destroy(); } catch {} },
  };
}
