import {
  ClampToEdgeWrapping,
  Color,
  Data3DTexture,
  DataTexture,
  GLSL3,
  LinearFilter,
  Matrix4,
  Mesh,
  PlaneGeometry,
  RedFormat,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from "three";
import { samplePalette } from "../../../palettes";
import type { CustomPaletteState } from "../../../palettes";
import type { Palette } from "../../../types";
import { getLighting } from "../../../visual/lighting";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

/**
 * Ray-march renderer — replaces the old VolumetricCloud strategy
 * for the "volumetric-cloud" style id, but is structurally completely
 * different.
 *
 * Pipeline:
 *
 *   1. INIT — splat every trajectory sample into a 128³ density
 *      volume (Data3DTexture, R8). Trilinear-weighted splats into 8
 *      neighbouring voxels per sample so the resulting field is
 *      smooth and band-limited rather than dotted.
 *
 *   2. RENDER — a scene-attached fullscreen clip-space quad whose
 *      fragment shader does per-pixel ray marching:
 *        - Unproject each pixel via uInvViewProj to get a world-
 *          space ray from the camera.
 *        - Slab-intersect the ray with the volume's bounding box.
 *        - March ~72 steps front-to-back through the volume.
 *        - At each non-trivial sample, fire a 6-step shadow ray
 *          toward the key light and accumulate occlusion. This is
 *          the self-shadowing that turns "fog with the colour of
 *          paint" into "an actual lit medium".
 *        - Composite via standard volume rendering:
 *            color += sampleColor * opacity * (1 - alpha)
 *            alpha += opacity * (1 - alpha)
 *          Early-out when alpha > 0.99.
 *        - Map final density through the trajectory palette for
 *          tone, modulate by key light × shadow + ambient.
 *
 * Why WebGL2 only: Sampler3D / Data3DTexture aren't supported in
 * WebGL1. Three.js initializes WebGL2 by default on every browser
 * that supports it, which is everywhere we care about; if the host
 * happens to be WebGL1 we fall back to a flat warning quad rather
 * than crashing.
 */

const VOLUME_N = 128;
const BOX_EXTENT = 7;                 // attractor normalized to r≈6, +1 padding
const BOX_MIN = new Vector3(-BOX_EXTENT, -BOX_EXTENT, -BOX_EXTENT);
const BOX_SIZE = new Vector3(BOX_EXTENT * 2, BOX_EXTENT * 2, BOX_EXTENT * 2);

const fallbackVertex = `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const fallbackFragment = `
  out vec4 fragColor;
  void main() { fragColor = vec4(0.06, 0.07, 0.10, 1.0); }
`;

const rayMarchVertex = `
  out vec2 vNdc;
  void main() {
    vNdc = position.xy;
    // Sit on the far plane so depth-test can't kill us; we don't
    // write depth from the fragment shader regardless.
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const rayMarchFragment = `
  precision highp sampler3D;
  precision highp float;

  in vec2 vNdc;
  out vec4 fragColor;

  uniform sampler3D uVolume;
  uniform sampler2D uPalette;

  uniform mat4 uInvViewProj;
  uniform vec3 uCamPos;

  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;

  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDir;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;
  uniform float uShadowDensity;

  uniform float uExtinction;      // alpha per unit density per unit length
  uniform float uExposure;
  uniform float uPaletteShift;
  uniform vec3  uBackground;

  const int MARCH_STEPS  = 72;
  const int SHADOW_STEPS = 6;

  vec3 paletteSample(float t) {
    return texture(uPalette, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
  }

  // Slab-method ray/AABB intersection. Returns vec2(tEnter, tExit).
  // tEnter > tExit means no intersection; tExit < 0 means box is
  // behind the camera.
  vec2 intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
    vec3 invD = 1.0 / rd;
    vec3 t0s  = (boxMin - ro) * invD;
    vec3 t1s  = (boxMax - ro) * invD;
    vec3 tsm  = min(t0s, t1s);
    vec3 tbg  = max(t0s, t1s);
    float tEnter = max(max(tsm.x, tsm.y), tsm.z);
    float tExit  = min(min(tbg.x, tbg.y), tbg.z);
    return vec2(tEnter, tExit);
  }

  // Cheap pseudo-random offset so we can dither the start of the
  // ray by a fraction of a step, hiding the discrete-step banding
  // that's otherwise visible at low MARCH_STEPS counts.
  float dither(vec2 ndc) {
    return fract(sin(dot(ndc, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Reconstruct world-space ray from this pixel.
    vec4 farPoint = uInvViewProj * vec4(vNdc, 1.0, 1.0);
    farPoint.xyz /= farPoint.w;
    vec3 rayDir = normalize(farPoint.xyz - uCamPos);

    vec2 hit = intersectBox(uCamPos, rayDir, uBoxMin, uBoxMax);
    if (hit.x > hit.y || hit.y < 0.0) {
      // Ray missed the volume entirely. Emit fully transparent so the
      // canvas background (CSS gradient) shows through.
      discard;
    }
    float tEnter = max(hit.x, 0.0);
    float tExit  = hit.y;
    float marchLen = tExit - tEnter;
    float step = marchLen / float(MARCH_STEPS);

    // Jitter the entry by up to one step to dither the front face.
    float jitter = dither(vNdc) * step;
    vec3 pos = uCamPos + rayDir * (tEnter + jitter);
    vec3 dpos = rayDir * step;

    vec3 boxSize = uBoxMax - uBoxMin;
    vec3 keyL  = normalize(uKeyDir);
    vec3 fillL = normalize(uFillDir);

    vec4 accum = vec4(0.0);

    // Distance from each sample to the key light, in box units, used
    // to choose the shadow step length.
    float shadowStepLen = length(boxSize) * 0.04;

    for (int i = 0; i < MARCH_STEPS; i++) {
      vec3 uvw = (pos - uBoxMin) / boxSize;
      if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
        pos += dpos;
        continue;
      }

      float density = texture(uVolume, uvw).r;
      if (density > 0.01) {
        // Shadow march toward the key light. Each shadow step
        // accumulates inverse-transmittance — denser regions cast
        // longer shadows. uShadowDensity tunes how black the shadow
        // sides get.
        float shadow = 0.0;
        vec3 sPos = pos + keyL * shadowStepLen;
        for (int j = 0; j < SHADOW_STEPS; j++) {
          vec3 sUvw = (sPos - uBoxMin) / boxSize;
          if (any(lessThan(sUvw, vec3(0.0))) || any(greaterThan(sUvw, vec3(1.0)))) break;
          shadow += texture(uVolume, sUvw).r;
          sPos += keyL * shadowStepLen;
        }
        float keyTransmit = exp(-shadow * uShadowDensity);

        // Palette colour by density (head/tail of the palette read
        // as low-density haze vs. high-density cores). Apply
        // palette shift like the other modes.
        float paletteT = mod(density + uPaletteShift, 1.0);
        vec3 paletteColor = paletteSample(paletteT);

        // Simple two-light shading. Fill is unshadowed (cheap
        // approximation; ambient backlight).
        vec3 lit =
            paletteColor * uKeyColor  * uKeyI  * keyTransmit
          + paletteColor * uFillColor * uFillI * 0.5
          + paletteColor * uAmbient;

        // Front-to-back compositing. Opacity per step scales with
        // density and step length; we keep marchLen ~ box diagonal
        // so uExtinction stays in a sane regime.
        float opacity = clamp(density * step * uExtinction, 0.0, 1.0);
        accum.rgb += lit * opacity * (1.0 - accum.a);
        accum.a   += opacity * (1.0 - accum.a);
        if (accum.a > 0.99) break;
      }

      pos += dpos;
    }

    // Tonemap accumulated radiance only; leave alpha as accum.a so the
    // canvas/CSS background shows through where the volume is empty.
    vec3 col = vec3(1.0) - exp(-accum.rgb * uExposure);
    fragColor = vec4(col, accum.a);
  }
`;

interface RayMarchUniforms {
  uVolume: { value: Data3DTexture | null };
  uPalette: { value: DataTexture | null };
  uInvViewProj: { value: Matrix4 };
  uCamPos: { value: Vector3 };
  uBoxMin: { value: Vector3 };
  uBoxMax: { value: Vector3 };
  uKeyDir: { value: Vector3 };
  uKeyColor: { value: Color };
  uKeyI: { value: number };
  uFillDir: { value: Vector3 };
  uFillColor: { value: Color };
  uFillI: { value: number };
  uAmbient: { value: Color };
  uShadowDensity: { value: number };
  uExtinction: { value: number };
  uExposure: { value: number };
  uPaletteShift: { value: number };
  uBackground: { value: Color };
}

/**
 * Build a 128³ density volume from trajectories. Trilinear-weighted
 * splatting into 8 voxels per sample so the field is smooth; sqrt
 * compression on the way to 0..255 so the dynamic range of the
 * splat density (typically very long-tailed for chaotic attractors)
 * doesn't crush all interesting structure into a single voxel.
 */
function buildVolumeTexture(trajectories: number[][][]): Data3DTexture {
  const N = VOLUME_N;
  const accum = new Float32Array(N * N * N);
  const data = new Uint8Array(N * N * N);

  const minX = -BOX_EXTENT;
  const sizeX = BOX_EXTENT * 2;

  for (const traj of trajectories) {
    for (let i = 0; i < traj.length; i++) {
      const p = traj[i];
      const fx = ((p[0] - minX) / sizeX) * N - 0.5;
      const fy = ((p[1] - minX) / sizeX) * N - 0.5;
      const fz = ((p[2] - minX) / sizeX) * N - 0.5;
      if (fx < 0 || fy < 0 || fz < 0) continue;
      if (fx >= N - 1 || fy >= N - 1 || fz >= N - 1) continue;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const z0 = Math.floor(fz);
      const tx = fx - x0;
      const ty = fy - y0;
      const tz = fz - z0;
      for (let dz = 0; dz <= 1; dz++) {
        const wz = dz ? tz : 1 - tz;
        const zIdx = (z0 + dz) * N * N;
        for (let dy = 0; dy <= 1; dy++) {
          const wy = dy ? ty : 1 - ty;
          const yIdx = (y0 + dy) * N;
          for (let dx = 0; dx <= 1; dx++) {
            const wx = dx ? tx : 1 - tx;
            accum[zIdx + yIdx + (x0 + dx)] += wx * wy * wz;
          }
        }
      }
    }
  }

  let maxV = 0;
  for (let i = 0; i < accum.length; i++) if (accum[i] > maxV) maxV = accum[i];
  // sqrt compression — long-tailed splat density into a perceptual
  // mid-range. Without it, attractor saddles claim all the dynamic
  // range and the rest of the orbit barely registers.
  const scale = maxV > 0 ? 255 / Math.sqrt(maxV) : 0;
  for (let i = 0; i < accum.length; i++) {
    const v = Math.sqrt(accum[i]) * scale;
    data[i] = v >= 255 ? 255 : v <= 0 ? 0 : Math.floor(v);
  }

  const tex = new Data3DTexture(data, N, N, N);
  tex.format = RedFormat;
  tex.type = UnsignedByteType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.wrapR = ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

function buildPaletteTexture(id: Palette, customPalette: CustomPaletteState): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const color = samplePalette(id, t, customPalette).clone().convertLinearToSRGB();
    data[i * 4 + 0] = Math.round(color.r * 255);
    data[i * 4 + 1] = Math.round(color.g * 255);
    data[i * 4 + 2] = Math.round(color.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, 1, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Re-uses the canvas background colour helper; written inline here
// to avoid a circular import from renderQuality.
function backgroundColorFor(background: TrajectoryData["background"]): Color {
  if (background === "dark") return new Color(0x0e1019);
  if (background === "light") return new Color(0xf1f3fb);
  return new Color(0x0f111d);
}

export class RayMarchRenderer implements RendererStrategy {
  // Bound to the legacy style id so we don't have to thread a new
  // value through the host's render-style enum. The mode is
  // semantically completely different from the old VolumetricCloud,
  // but its slot in the UI is the same.
  readonly style = "volumetric-cloud" as const;

  private context: RenderContext | null = null;
  private data: TrajectoryData | null = null;
  private quad: Mesh<PlaneGeometry, ShaderMaterial> | null = null;
  private material: ShaderMaterial | null = null;
  private volumeTexture: Data3DTexture | null = null;
  private paletteTexture: DataTexture | null = null;
  private invViewProj = new Matrix4();
  private webgl2 = true;

  init(context: RenderContext, data: TrajectoryData) {
    this.context = context;
    this.data = data;
    this.webgl2 = context.renderer.capabilities.isWebGL2;

    if (!this.webgl2) {
      // Graceful degradation: just show a flat dim quad so the user
      // sees *something* and gets a console nudge.
      // eslint-disable-next-line no-console
      console.warn("[RayMarchRenderer] WebGL2 required for 3D textures; rendering placeholder.");
      this.material = new ShaderMaterial({
        vertexShader: fallbackVertex,
        fragmentShader: fallbackFragment,
        glslVersion: GLSL3,
        depthWrite: false,
        depthTest: false,
      });
      this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
      this.quad.frustumCulled = false;
      this.quad.renderOrder = -1000;
      context.threeScene.add(this.quad);
      return;
    }

    this.volumeTexture = buildVolumeTexture(data.trajectories);
    this.paletteTexture = buildPaletteTexture(data.palette as Palette, data.customPalette);
    const lighting = getLighting();
    const bgColor = backgroundColorFor(data.background);

    const uniforms: RayMarchUniforms = {
      uVolume:        { value: this.volumeTexture },
      uPalette:       { value: this.paletteTexture },
      uInvViewProj:   { value: this.invViewProj },
      uCamPos:        { value: new Vector3() },
      uBoxMin:        { value: BOX_MIN.clone() },
      uBoxMax:        { value: BOX_MIN.clone().add(BOX_SIZE) },
      uKeyDir:        { value: new Vector3().fromArray(lighting.keyDir) },
      uKeyColor:      { value: new Color().fromArray(lighting.keyColor) },
      uKeyI:          { value: lighting.keyIntensity },
      uFillDir:       { value: new Vector3().fromArray(lighting.fillDir) },
      uFillColor:     { value: new Color().fromArray(lighting.fillColor) },
      uFillI:         { value: lighting.fillIntensity },
      uAmbient:       { value: new Color().fromArray(lighting.ambient) },
      uShadowDensity: { value: lighting.shadowDensity * 4.0 }, // 0..1 maps to a useful exp() range
      uExtinction:    { value: 2.4 },
      uExposure:      { value: 1.7 },
      uPaletteShift:  { value: data.paletteShift ?? 0 },
      uBackground:    { value: bgColor },
    };

    this.material = new ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, { value: unknown }>,
      vertexShader: rayMarchVertex,
      fragmentShader: rayMarchFragment,
      glslVersion: GLSL3,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      toneMapped: false,
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quad.renderOrder = -1000;
    context.threeScene.add(this.quad);
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data || !this.context || !this.material || !this.webgl2) return;
    this.data = { ...this.data, ...data };
    const camera = this.context.camera;

    // Update inverse view-projection. Three.js doesn't keep this
    // computed; we do it here once per frame.
    this.invViewProj.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert();

    const lighting = getLighting();
    const u = this.material.uniforms as unknown as RayMarchUniforms;
    u.uCamPos.value.copy(camera.position);
    u.uKeyDir.value.fromArray(lighting.keyDir);
    u.uKeyColor.value.fromArray(lighting.keyColor);
    u.uKeyI.value = lighting.keyIntensity;
    u.uFillDir.value.fromArray(lighting.fillDir);
    u.uFillColor.value.fromArray(lighting.fillColor);
    u.uFillI.value = lighting.fillIntensity;
    u.uAmbient.value.fromArray(lighting.ambient);
    u.uShadowDensity.value = lighting.shadowDensity * 4.0;
    u.uPaletteShift.value = data.paletteShift ?? 0;
    u.uBackground.value.copy(backgroundColorFor(this.data.background));

    // Re-tonemap aggressiveness with the cloudDensity slider, since
    // ray-march doesn't have its own dedicated control. Higher
    // density slider -> heavier extinction, denser-looking medium.
    const density = this.data.cloudDensity ?? 1;
    u.uExtinction.value = 1.4 + density * 2.2;
  }

  dispose({ threeScene }: RenderContext) {
    if (this.quad) {
      threeScene.remove(this.quad);
      this.quad.geometry.dispose();
      this.quad.material.dispose();
    }
    this.quad = null;
    this.material = null;
    this.volumeTexture?.dispose();
    this.paletteTexture?.dispose();
    this.volumeTexture = null;
    this.paletteTexture = null;
    this.data = null;
    this.context = null;
  }
}

// `volumetric-cloud` style now resolves to this renderer in the
// factory; the old VolumetricCloudRenderer.ts can be deleted.
