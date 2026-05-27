import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
} from "three";
import type { Palette, ProjectionAxis } from "../../../types";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { buildPaletteTexture, dynamicScalarAt, visualFieldAt } from "./utils";
import { getLighting } from "../../../visual/lighting";
import {
  applyLightingUniforms,
  applyMaterialUniforms,
  createLightingUniforms,
  createMaterialUniforms,
  materialShaderChunk,
} from "./materials";

/**
 * Caustics renderer — "screen-space light density / spill, caustic-like".
 *
 * What changed from the previous version, and why:
 *
 *   1. Output plane no longer attached to the camera. The old code
 *      did `context.camera.add(outputPlane)` which puts the plane in
 *      the camera's local subtree. React Three Fiber does NOT add the
 *      camera to the scene by default, so `renderer.render(scene, camera)`
 *      never traverses the camera's children. The result: the entire
 *      caustics image was being computed every frame and then thrown
 *      away. That's the headline "invisible" bug.
 *
 *      Now the output is a scene-attached fullscreen quad whose
 *      vertex shader emits positions directly in clip space. It can't
 *      be culled (we set `frustumCulled = false`) and it renders
 *      behind everything else (`renderOrder = -1000`).
 *
 *   2. True screen-space splatting. The previous code pre-projected
 *      every trajectory point into a fixed plane at init time, so the
 *      caustic pattern was glued to the attractor and didn't respond
 *      to camera orbit at all. Here the splat geometry stores raw 3D
 *      world positions; the splat pass renders them through the
 *      current main camera (`auto` mode) so orbiting actually
 *      sweeps the caustic field, which is what "screen-space" means.
 *
 *      The xy/xz/yz projection-axis options are preserved by
 *      rendering the splat pass through a fixed orthographic camera
 *      looking down that axis — that's the old behaviour, opt-in.
 *
 *   3. Velocity-weighted energy. Real caustics concentrate at
 *      velocity minima (where light lingers). Each splat now carries
 *      an `aEnergy` attribute proportional to 1/|v| at that sample,
 *      so the attractor's slow regions burn brighter than its fast
 *      slingshot arcs.
 *
 *   4. No more `backdrop` plane. The clear color handles the
 *      background, and the tonemap fragment already produces a full
 *      RGB image including dark areas. The extra opaque plane was
 *      doing nothing useful.
 */

// Set to "off" in production; toggle while iterating on the splat pass.
const CAUSTICS_DEBUG_MODE: "off" | "geom" | "heatmap" | "accum" = "off";

const blurVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const blurFragment = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uDirection;
  uniform vec2 uResolution;
  uniform float uRadius;
  void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 sum = vec4(0.0);
    float total = 0.0;
    for (int i = -5; i <= 5; i++) {
      float f = float(i);
      float w = exp(-(f * f) / (2.0 * uRadius * uRadius + 0.0001));
      vec2 offset = uDirection * texel * f;
      sum += texture2D(uTexture, vUv + offset) * w;
      total += w;
    }
    gl_FragColor = sum / max(total, 0.0001);
  }
`;

// The output quad's vertex shader writes clip-space positions
// directly, so the quad always fills the framebuffer regardless of
// where the main camera is or what its projection is.
const outputVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // PlaneGeometry(2,2) has positions in [-1,1]; pass them straight
    // through. No view/projection involved.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const outputFragment = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform sampler2D uBaseTexture;
  uniform sampler2D uPalette;
  uniform sampler2D uPaletteWarm;
  uniform sampler2D uPaletteCool;
  uniform float uIntensity;
  uniform float uCausticExposure;
  uniform float uThreshold;
  uniform float uBloomStrength;
  uniform float uPaletteShift;
  uniform int   uColorMode;
  uniform vec2  uTexel;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDir;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;
  ${materialShaderChunk}

  vec3 samplePaletteColor(sampler2D tex, float t) {
    return texture2D(tex, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
  }

  void main() {
    vec4 baseSample = texture2D(uBaseTexture, vUv);
    vec4 blurSample = texture2D(uTexture,     vUv);
    float baseEnergy = baseSample.r;
    float blurred    = blurSample.r;
    float energy     = mix(baseEnergy, blurred, uBloomStrength);
    float colorEnergy = mix(baseSample.g, blurSample.g, uBloomStrength);
    float softened   = max(energy - uThreshold, 0.0);
    float tone       = clamp(1.0 - exp(-uCausticExposure * softened), 0.0, 1.0);
    float dynamicT   = energy > 0.00001 ? colorEnergy / energy : tone;
    dynamicT = fract(dynamicT + uPaletteShift);
    float fieldEnergy = energy > 0.00001 ? mix(baseSample.b, blurSample.b, uBloomStrength) / energy : tone;

    vec3 paletteColor = samplePaletteColor(uPalette, dynamicT);
    if (uColorMode == 1) paletteColor = samplePaletteColor(uPaletteWarm, dynamicT);
    else if (uColorMode == 2) paletteColor = samplePaletteColor(uPaletteCool, dynamicT);

    float eL = texture2D(uTexture, vUv - vec2(uTexel.x, 0.0)).r;
    float eR = texture2D(uTexture, vUv + vec2(uTexel.x, 0.0)).r;
    float eD = texture2D(uTexture, vUv - vec2(0.0, uTexel.y)).r;
    float eU = texture2D(uTexture, vUv + vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3((eL - eR) * 2.8, (eD - eU) * 2.8, 0.65));
    vec3 lit = psMaterialShade(
      paletteColor,
      normal,
      vec3(0.0, 0.0, 1.0),
      uKeyDir,
      uKeyColor,
      uKeyI,
      uFillDir,
      uFillColor,
      uFillI,
      uAmbient,
      clamp(fieldEnergy, 0.0, 1.0),
      tone
    );

    // Slight watery base mix so even the "dark" regions feel like a
    // medium rather than a flat black plate.
    vec3 watery = mix(vec3(0.02, 0.05, 0.12), vec3(0.95, 1.0, 1.0), tone);
    vec3 color  = mix(watery, lit, 0.78) * (0.65 + tone * 0.7) * uIntensity;

    gl_FragColor = vec4(psFilmicToneMap(color * uExposure), 1.0);
  }
`;

const accumDebugFragment = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uDebugScale;
  void main() {
    float e = texture2D(uTexture, vUv).r;
    float mapped = log(1.0 + e);
    vec3 color = mix(vec3(0.0, 0.0, 0.2), vec3(1.0, 1.0, 1.0), clamp(mapped * uDebugScale, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;

function blurSigma(value: number): number {
  return 0.35 + value * 2.6;
}

function thicknessScale(data: TrajectoryData): number {
  if (data.lineThickness === "thick") return 1.65;
  if (data.lineThickness === "thin") return 0.68;
  return 1;
}

function causticsEnergyScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return 1 + energy * 1.15 + pulse * 1.6;
}

function causticsPointScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return 1 + energy * 0.85 + pulse * 1.25;
}

function causticsBlurRadius(data: TrajectoryData): number {
  const base = data.caustics?.blurRadius ?? 0.5;
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.08, Math.min(1.9, base * (1 + energy * 0.25 + pulse * 0.35)));
}

function causticsOutputIntensity(data: TrajectoryData): number {
  const base = data.caustics?.intensity ?? 1;
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.05, Math.min(5, base * (1 + energy * 0.65 + pulse * 0.9)));
}

/**
 * Estimate per-sample energy weight from local velocity.
 * Slow regions of the attractor (low |v|) collect more light, like
 * real caustic focal lines.
 */
function buildVelocityWeights(
  trajectories: number[][][],
  dynamics: TrajectoryData["dynamics"],
  step: number
): { positions: Float32Array; energies: Float32Array; colorScalars: Float32Array; fieldScalars: Float32Array; pointCount: number } {
  let total = 0;
  trajectories.forEach((t) => {
    total += Math.ceil(t.length / step);
  });
  const positions = new Float32Array(total * 3);
  const energies = new Float32Array(total);
  const colorScalars = new Float32Array(total);
  const fieldScalars = new Float32Array(total);

  let offset = 0;
  let energyOffset = 0;
  let vmin = Infinity;
  let vmax = -Infinity;
  // First pass: compute raw inverse-speed weights to find dynamic
  // range so we can normalize.
  const tmpWeights: number[] = [];
  trajectories.forEach((traj) => {
    for (let i = 0; i < traj.length; i += step) {
      const a = traj[Math.max(0, i - 1)];
      const b = traj[Math.min(traj.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const v = Math.hypot(dx, dy, dz);
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
      tmpWeights.push(v);
    }
  });
  const vSafe = Math.max(vmin, vmax * 0.05, 1e-4);
  let widx = 0;
  trajectories.forEach((traj, trajIdx) => {
    for (let i = 0; i < traj.length; i += step) {
      const p = traj[i];
      positions[offset++] = p[0];
      positions[offset++] = p[1];
      positions[offset++] = p[2];
      const v = tmpWeights[widx++];
      // Inverse-speed, with a floor so the fastest segments still
      // contribute a baseline.
      const w = vSafe / Math.max(v, vSafe);
      // Bias by sqrt to soften extremes — without this Lorenz
      // saddles burn out completely.
      energies[energyOffset++] = Math.sqrt(w);
      colorScalars[energyOffset - 1] = dynamicScalarAt(
        dynamics,
        trajIdx,
        i,
        traj.length > 1 ? i / (traj.length - 1) : 0
      );
      fieldScalars[energyOffset - 1] = visualFieldAt(
        dynamics,
        "density",
        trajIdx,
        i,
        0
      );
    }
  });

  return { positions, energies, colorScalars, fieldScalars, pointCount: total };
}

function projectionAxisCamera(axis: ProjectionAxis, halfExtent: number): OrthographicCamera | null {
  // Looking down +Z (xy plane), +Y (xz plane), or +X (yz plane).
  // halfExtent should comfortably cover the normalized attractor radius.
  const h = halfExtent;
  const cam = new OrthographicCamera(-h, h, h, -h, -h * 4, h * 4);
  if (axis === "xy") {
    cam.position.set(0, 0, h * 2);
    cam.up.set(0, 1, 0);
  } else if (axis === "xz") {
    cam.position.set(0, h * 2, 0);
    cam.up.set(0, 0, -1);
  } else if (axis === "yz") {
    cam.position.set(h * 2, 0, 0);
    cam.up.set(0, 1, 0);
  } else {
    return null;
  }
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  return cam;
}

export class CausticsRenderer implements RendererStrategy {
  readonly style = "caustics" as const;

  private context: RenderContext | null = null;
  private data: TrajectoryData | null = null;

  // Fullscreen output (lives in the main scene)
  private outputQuad: Mesh<PlaneGeometry, ShaderMaterial> | null = null;
  private outputMaterial: ShaderMaterial | null = null;

  // Splat pass
  private splatScene: Scene | null = null;
  private splatPoints: Points | null = null;
  private splatMaterial: ShaderMaterial | null = null;
  private axisCamera: OrthographicCamera | null = null;
  private projectionAxis: ProjectionAxis = "auto";

  // Blur ping-pong
  private blurSceneH: Scene | null = null;
  private blurSceneV: Scene | null = null;
  private blurMaterialH: ShaderMaterial | null = null;
  private blurMaterialV: ShaderMaterial | null = null;
  private orthoCamera: OrthographicCamera | null = null;

  // Render targets
  private splatTarget: WebGLRenderTarget | null = null;
  private blurTarget: WebGLRenderTarget | null = null;
  private finalTarget: WebGLRenderTarget | null = null;

  // Palettes
  private paletteTexture: DataTexture | null = null;
  private warmPaletteTexture: DataTexture | null = null;
  private coolPaletteTexture: DataTexture | null = null;

  // State
  private texSize = 512;
  private energyGain = 1;
  private pointCount = 0;

  init(context: RenderContext, data: TrajectoryData) {
    this.context = context;
    this.data = data;
    this.projectionAxis = data.caustics?.projectionAxis ?? "auto";
    this.texSize = data.quality?.causticsTextureSize ?? 512;

    const halfFloatSupported =
      context.renderer.capabilities.isWebGL2 ||
      context.renderer.extensions.has("OES_texture_half_float");
    const targetOpts = {
      depthBuffer: false,
      stencilBuffer: false,
      type: halfFloatSupported ? HalfFloatType : UnsignedByteType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    };
    this.splatTarget = new WebGLRenderTarget(this.texSize, this.texSize, targetOpts);
    this.blurTarget  = new WebGLRenderTarget(this.texSize, this.texSize, targetOpts);
    this.finalTarget = new WebGLRenderTarget(this.texSize, this.texSize, targetOpts);

    this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- Splat geometry ----------------------------------------
    const pointStep = Math.max(1, Math.round(data.quality?.causticsPointStep ?? 2));
    const { positions, energies, colorScalars, fieldScalars, pointCount } = buildVelocityWeights(
      data.trajectories,
      data.dynamics,
      pointStep
    );
    this.pointCount = pointCount;
    this.energyGain = this.computeEnergyGain(data.caustics?.intensity ?? 1);

    const splatGeom = new BufferGeometry();
    splatGeom.setAttribute("position", new BufferAttribute(positions, 3));
    splatGeom.setAttribute("aEnergy", new BufferAttribute(energies, 1));
    splatGeom.setAttribute("aColorT", new BufferAttribute(colorScalars, 1));
    splatGeom.setAttribute("aFieldT", new BufferAttribute(fieldScalars, 1));

    // Soft point sprite with per-vertex energy. We rely on the main
    // camera's projection in "auto" mode, or the axis-locked ortho
    // camera otherwise — both go through the standard
    // projectionMatrix * modelViewMatrix path.
    const splatVert = `
      attribute float aEnergy;
      attribute float aColorT;
      attribute float aFieldT;
      varying float vEnergy;
      varying float vColorT;
      varying float vFieldT;
      uniform float uPointSize;
      void main() {
        vEnergy = aEnergy;
        vColorT = aColorT;
        vFieldT = aFieldT;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // Keep splat size constant in framebuffer pixels — exposure
        // accumulation needs uniform contribution per sample, not
        // perspective-shrunk dots.
        gl_PointSize = uPointSize;
      }
    `;
    const splatFrag = `
      varying float vEnergy;
      varying float vColorT;
      varying float vFieldT;
      uniform float uEnergyGain;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = dot(c, c);
        float falloff = exp(-d * 18.0);
        float energy = falloff * vEnergy * uEnergyGain;
        gl_FragColor = vec4(energy, energy * vColorT, energy * vFieldT, energy);
      }
    `;
    this.splatMaterial = new ShaderMaterial({
      uniforms: {
        uEnergyGain: { value: this.energyGain },
        // Bigger sprites = more overlap = brighter caustic concentrations.
        // tex/32 at 512 -> 16px sprites, which is what we want at this
        // accumulation resolution.
        uPointSize:  { value: Math.max(6, Math.round((this.texSize / 32) * thicknessScale(data) * causticsPointScale(data))) },
      },
      vertexShader: splatVert,
      fragmentShader: splatFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.splatPoints = new Points(splatGeom, this.splatMaterial);
    this.splatPoints.frustumCulled = false;
    this.splatScene = new Scene();
    this.splatScene.add(this.splatPoints);

    if (this.projectionAxis !== "auto") {
      this.axisCamera = projectionAxisCamera(this.projectionAxis, 8);
    }

    // --- Blur passes -------------------------------------------
    const quadGeom = new PlaneGeometry(2, 2);
    this.blurMaterialH = new ShaderMaterial({
      uniforms: {
        uTexture:    { value: this.splatTarget.texture },
        uDirection:  { value: new Vector2(1, 0) },
        uResolution: { value: new Vector2(this.texSize, this.texSize) },
        uRadius:     { value: blurSigma(causticsBlurRadius(data)) },
      },
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthWrite: false, depthTest: false, transparent: true,
    });
    this.blurMaterialV = new ShaderMaterial({
      uniforms: {
        uTexture:    { value: this.blurTarget.texture },
        uDirection:  { value: new Vector2(0, 1) },
        uResolution: { value: new Vector2(this.texSize, this.texSize) },
        uRadius:     { value: blurSigma(causticsBlurRadius(data)) },
      },
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthWrite: false, depthTest: false, transparent: true,
    });
    this.blurSceneH = new Scene();
    this.blurSceneV = new Scene();
    this.blurSceneH.add(new Mesh(quadGeom, this.blurMaterialH));
    this.blurSceneV.add(new Mesh(quadGeom, this.blurMaterialV));

    // --- Output (lives in the host scene) ----------------------
    this.paletteTexture     = buildPaletteTexture(data.palette as Palette, data.customPalette);
    this.warmPaletteTexture = buildPaletteTexture("solar", data.customPalette);
    this.coolPaletteTexture = buildPaletteTexture("abyss", data.customPalette);
    const lighting = getLighting();

    this.outputMaterial = new ShaderMaterial({
      uniforms: {
        uTexture:       { value: this.finalTarget.texture },
        uBaseTexture:   { value: this.splatTarget.texture },
        uIntensity:     { value: causticsOutputIntensity(data) },
        // Exposure + threshold are tuned together with the new
        // energyGain so realistic caustic peaks reach tone ~0.8.
        uCausticExposure: { value: 2.4 },
        uThreshold:     { value: 0.008 },
        uBloomStrength: { value: 0.72 },
        uPaletteShift:  { value: data.paletteShift ?? 0 },
        uPalette:       { value: this.paletteTexture },
        uPaletteWarm:   { value: this.warmPaletteTexture },
        uPaletteCool:   { value: this.coolPaletteTexture },
        uColorMode:     { value: data.caustics?.colorMode === "warm" ? 1 : data.caustics?.colorMode === "cool" ? 2 : 0 },
        uDebugScale:    { value: 1.7 },
        uTexel:         { value: new Vector2(1 / this.texSize, 1 / this.texSize) },
        ...createLightingUniforms(lighting),
        ...createMaterialUniforms(data.materialStyle),
      },
      vertexShader: outputVertex,
      fragmentShader: CAUSTICS_DEBUG_MODE === "accum" ? accumDebugFragment : outputFragment,
      depthWrite: false,
      depthTest: false,
      transparent: false,
      toneMapped: false,
    });
    applyMaterialUniforms(this.outputMaterial.uniforms as any, data.materialStyle, data.emissiveBoost ?? 0);

    const outputQuad = new Mesh(new PlaneGeometry(2, 2), this.outputMaterial);
    outputQuad.frustumCulled = false;
    outputQuad.renderOrder = -1000; // draw first, behind everything
    this.outputQuad = outputQuad;
    context.threeScene.add(outputQuad);

    this.renderCaustics();
  }

  private computeEnergyGain(intensity: number): number {
    // Per-splat energy. The blur+tonemap stages downstream are tuned
    // for hot-pixel peaks around 1.0, so we want enough per-splat
    // contribution that ~5-10 overlapping samples push the
    // accumulator past the tonemap threshold (~0.01) into useful
    // exposure range. Constant-ish across trajectory counts; we damp
    // a little by sqrt(trajCount) so adding more seeds doesn't blow
    // out the image.
    const trajCount = this.data?.trajectories.length ?? 1;
    const trajectoryDamp = 1 / Math.max(0.7, Math.sqrt(trajCount * 0.5));
    const data = this.data ?? ({ lineThickness: "default" } as TrajectoryData);
    return 0.55 * intensity * trajectoryDamp * thicknessScale(data) * causticsEnergyScale(data);
  }

  private renderCaustics() {
    if (!this.context || !this.splatScene || !this.blurSceneH || !this.blurSceneV ||
        !this.orthoCamera || !this.splatTarget || !this.blurTarget || !this.finalTarget) {
      return;
    }
    const renderer = this.context.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevClearColor = new Color();
    renderer.getClearColor(prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);

    // 1. Splat. "auto" = project through the main camera; otherwise
    //    use a fixed axis-aligned ortho camera.
    renderer.setRenderTarget(this.splatTarget);
    renderer.clear();
    const splatCam = this.axisCamera ?? this.context.camera;
    renderer.render(this.splatScene, splatCam);

    // 2. Horizontal blur.
    if (this.blurMaterialH) {
      this.blurMaterialH.uniforms.uTexture.value = this.splatTarget.texture;
      renderer.setRenderTarget(this.blurTarget);
      renderer.clear();
      renderer.render(this.blurSceneH, this.orthoCamera);
    }

    // 3. Vertical blur into finalTarget.
    if (this.blurMaterialV) {
      this.blurMaterialV.uniforms.uTexture.value = this.blurTarget.texture;
      renderer.setRenderTarget(this.finalTarget);
      renderer.clear();
      renderer.render(this.blurSceneV, this.orthoCamera);
    }

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.autoClear = prevAutoClear;

    if (this.outputMaterial) {
      const accumTex =
        CAUSTICS_DEBUG_MODE === "accum"
          ? this.splatTarget.texture
          : this.finalTarget.texture;
      this.outputMaterial.uniforms.uTexture.value = accumTex;
      this.outputMaterial.uniforms.uBaseTexture.value = this.splatTarget.texture;
    }
  }

  update(context: RenderContext, data: TrajectoryData) {
    // Structural change (new trajectories, palette swap, projection
    // axis change, quality tier) — rebuild from scratch.
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };

    // Palette swaps trigger a full strategy rebuild via the
    // CanvasPanel useEffect deps, so init() already builds fresh
    // palette textures. Calling refreshPalettes here on every frame
    // was disposing + uploading three DataTextures per frame, which
    // is what was crashing on color change once the renderer
    // actually had work to do.

    const intensity = data.caustics?.intensity ?? 1;
    this.energyGain = this.computeEnergyGain(intensity);
    if (this.splatMaterial) {
      this.splatMaterial.uniforms.uEnergyGain.value = this.energyGain;
      this.splatMaterial.uniforms.uPointSize.value = Math.max(
        6,
        Math.round((this.texSize / 32) * thicknessScale(this.data) * causticsPointScale(this.data))
      );
      this.splatMaterial.needsUpdate = true;
    }
    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uIntensity.value = causticsOutputIntensity(this.data);
      const mode = data.caustics?.colorMode;
      this.outputMaterial.uniforms.uColorMode.value =
        mode === "warm" ? 1 : mode === "cool" ? 2 : 0;
      this.outputMaterial.uniforms.uPaletteShift.value = data.paletteShift ?? 0;
      applyLightingUniforms(this.outputMaterial.uniforms as any, getLighting());
      applyMaterialUniforms(this.outputMaterial.uniforms as any, this.data.materialStyle, this.data.emissiveBoost ?? 0);
      this.outputMaterial.needsUpdate = true;
    }
    if (this.blurMaterialH && this.blurMaterialV) {
      const radius = blurSigma(causticsBlurRadius(this.data));
      this.blurMaterialH.uniforms.uRadius.value = radius;
      this.blurMaterialV.uniforms.uRadius.value = radius;
    }

    // Re-render the caustic chain every frame so camera orbit
    // changes the projected field. This is the whole point of the
    // rewrite — without it, "screen-space" was a lie.
    this.renderCaustics();
  }

  dispose({ threeScene }: RenderContext) {
    if (this.outputQuad) {
      threeScene.remove(this.outputQuad);
      this.outputQuad.geometry.dispose();
      this.outputQuad.material.dispose();
    }
    this.outputQuad = null;
    this.outputMaterial = null;

    if (this.splatPoints) {
      this.splatPoints.geometry.dispose();
    }
    this.splatPoints = null;
    this.splatScene = null;
    if (this.splatMaterial) this.splatMaterial.dispose();
    this.splatMaterial = null;
    this.axisCamera = null;

    this.blurSceneH = null;
    this.blurSceneV = null;
    if (this.blurMaterialH) this.blurMaterialH.dispose();
    if (this.blurMaterialV) this.blurMaterialV.dispose();
    this.blurMaterialH = null;
    this.blurMaterialV = null;
    this.orthoCamera = null;

    this.splatTarget?.dispose();
    this.blurTarget?.dispose();
    this.finalTarget?.dispose();
    this.splatTarget = null;
    this.blurTarget = null;
    this.finalTarget = null;

    this.paletteTexture?.dispose();
    this.warmPaletteTexture?.dispose();
    this.coolPaletteTexture?.dispose();
    this.paletteTexture = null;
    this.warmPaletteTexture = null;
    this.coolPaletteTexture = null;

    this.data = null;
    this.context = null;
  }
}
