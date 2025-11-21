import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { samplePalette } from "../../../palettes";
import type { CustomPaletteState } from "../../../palettes";
import type { Palette, ProjectionAxis } from "../../../types";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

// Set to "off" in production build; can be toggled manually during development.
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

const colorVertex = blurVertex;

const colorFragment = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform sampler2D uBaseTexture;
  uniform sampler2D uPalette;
  uniform sampler2D uPaletteWarm;
  uniform sampler2D uPaletteCool;
  uniform float uIntensity;
  uniform float uExposure;
  uniform float uThreshold;
  uniform float uBloomStrength;
  uniform int uColorMode;

  vec3 samplePaletteColor(sampler2D tex, float t) {
    return texture2D(tex, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
  }

  vec3 heatColor(float e) {
    return mix(vec3(0.02, 0.08, 0.18), vec3(0.95, 1.0, 1.0), clamp(e, 0.0, 1.0));
  }

  void main() {
    float baseEnergy = texture2D(uBaseTexture, vUv).r;
    float blurred = texture2D(uTexture, vUv).r;
    float energy = mix(baseEnergy, blurred, uBloomStrength);
    float softened = max(energy - uThreshold, 0.0);
    float tone = clamp(1.0 - exp(-uExposure * softened), 0.0, 1.0);
    vec3 paletteColor = samplePaletteColor(uPalette, tone);
    if (uColorMode == 1) {
      paletteColor = samplePaletteColor(uPaletteWarm, tone);
    } else if (uColorMode == 2) {
      paletteColor = samplePaletteColor(uPaletteCool, tone);
    }
    vec3 watery = heatColor(tone);
    vec3 color = mix(watery, paletteColor, 0.55) * (0.7 + tone * 0.65) * uIntensity;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const accumDebugFragment = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uDebugScale;

  vec3 heatColor(float e) {
    return mix(vec3(0.0, 0.0, 0.2), vec3(1.0, 1.0, 1.0), clamp(e, 0.0, 1.0));
  }

  void main() {
    float e = texture2D(uTexture, vUv).r;
    float mapped = log(1.0 + e);
    vec3 color = heatColor(mapped * uDebugScale);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function buildPaletteTexture(id: Palette, customPalette: CustomPaletteState): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * 3);
  for (let i = 0; i < size; i++) {
    const t = size === 1 ? 0 : i / (size - 1);
    const color = samplePalette(id, t, customPalette).clone().convertLinearToSRGB();
    data[i * 3 + 0] = Math.round(color.r * 255);
    data[i * 3 + 1] = Math.round(color.g * 255);
    data[i * 3 + 2] = Math.round(color.b * 255);
  }
  const tex = new DataTexture(data, size, 1);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function projectionComponents(axis: ProjectionAxis): [number, number] {
  switch (axis) {
    case "xz":
      return [0, 2];
    case "yz":
      return [1, 2];
    case "xy":
    default:
      return [0, 1];
  }
}

function chooseAxisAuto(points: number[][][]): ProjectionAxis {
  const axes: ProjectionAxis[] = ["xy", "xz", "yz"];
  let best: ProjectionAxis = "xy";
  let bestSpread = -Infinity;
  axes.forEach((axis) => {
    const bounds = computeBounds(points, axis);
    const dx = bounds.max[0] - bounds.min[0];
    const dy = bounds.max[1] - bounds.min[1];
    const spread = dx * dy;
    if (spread > bestSpread) {
      bestSpread = spread;
      best = axis;
    }
  });
  return bestSpread <= 0 ? "xy" : best;
}

function blurSigma(value: number): number {
  return 0.35 + value * 2.6;
}

function computeEnergyGain(
  pointCount: number,
  trajectoryCount: number,
  intensity: number,
  blurMultiplier: number
): number {
  const totalSamples = Math.max(1, pointCount * blurMultiplier);
  const targetEnergy = 4.2;
  const normalized = targetEnergy / totalSamples;
  const trajectoryBalance = Math.max(0.4, Math.min(1.4, Math.sqrt(Math.max(trajectoryCount, 1))));
  return normalized * intensity * trajectoryBalance;
}

function computeBounds(points: number[][][], axis: ProjectionAxis): { min: number[]; max: number[] } {
  const [a, b] = projectionComponents(axis);
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  points.forEach((traj) => {
    traj.forEach((p) => {
      min[0] = Math.min(min[0], p[a]);
      min[1] = Math.min(min[1], p[b]);
      max[0] = Math.max(max[0], p[a]);
      max[1] = Math.max(max[1], p[b]);
    });
  });
  if (!isFinite(min[0]) || !isFinite(min[1])) {
    return { min: [-1, -1], max: [1, 1] };
  }
  return { min, max };
}

export class CausticsRenderer implements RendererStrategy {
  readonly style = "caustics" as const;
  private outputPlane: Mesh<PlaneGeometry, ShaderMaterial> | null = null;
  private orthoCamera: OrthographicCamera | null = null;
  private splatScene: Scene | null = null;
  private blurSceneH: Scene | null = null;
  private blurSceneV: Scene | null = null;
  private splatTarget: WebGLRenderTarget | null = null;
  private blurTarget: WebGLRenderTarget | null = null;
  private finalTarget: WebGLRenderTarget | null = null;
  private baseTarget: WebGLRenderTarget | null = null;
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;
  private blurMaterialH: ShaderMaterial | null = null;
  private blurMaterialV: ShaderMaterial | null = null;
  private outputMaterial: ShaderMaterial | null = null;
  private projectionAxis: ProjectionAxis = "auto";
  private backdrop: Mesh | null = null;
  private paletteTexture: DataTexture | null = null;
  private warmPaletteTexture: DataTexture | null = null;
  private coolPaletteTexture: DataTexture | null = null;
  private splatMaterial: ShaderMaterial | null = null;
  private debugPoints: Points | null = null;
  private energyGain = 1;
  private pointCount = 0;
  private projectionScale = 1;
  private texSize = 512;
  private blurMultiplier = 5;

  init(context: RenderContext, data: TrajectoryData) {
    this.context = context;
    this.data = data;
    this.projectionAxis = data.caustics?.projectionAxis ?? "auto";
    this.texSize = data.quality?.causticsTextureSize ?? 512;

    const texSize = this.texSize;
    const halfFloatSupported =
      context.renderer.capabilities.isWebGL2 || context.renderer.extensions.has("OES_texture_half_float");
    const textureType = halfFloatSupported ? HalfFloatType : UnsignedByteType;
    const targetOpts = {
      depthBuffer: false,
      stencilBuffer: false,
      type: textureType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    };
    this.baseTarget = new WebGLRenderTarget(texSize, texSize, targetOpts);
    this.splatTarget = this.baseTarget;
    this.blurTarget = new WebGLRenderTarget(texSize, texSize, targetOpts);
    this.finalTarget = new WebGLRenderTarget(texSize, texSize, targetOpts);

    this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.splatScene = new Scene();
    this.blurSceneH = new Scene();
    this.blurSceneV = new Scene();

    const axis = this.projectionAxis === "auto" ? chooseAxisAuto(data.trajectories) : this.projectionAxis;
    const pointStep = Math.max(1, Math.round(data.quality?.causticsPointStep ?? 2));
    const positions: number[] = [];
    const radius = data.normalized?.bounds.radius ?? 6;
    this.projectionScale = 1 / Math.max(radius * 1.05, 1e-3);
    const clampRange = 1.35;

    data.trajectories.forEach((traj) => {
      for (let i = 0; i < traj.length; i += pointStep) {
        const p = traj[i];
        const [a, b] = projectionComponents(axis);
        const mapped: [number, number, number] = [p[a], p[b], p[3 - (a + b)] ?? p[2] ?? 0];
        const u = Math.max(-clampRange, Math.min(clampRange, mapped[0] * this.projectionScale));
        const v = Math.max(-clampRange, Math.min(clampRange, mapped[1] * this.projectionScale));
        const w = Math.max(-clampRange, Math.min(clampRange, mapped[2] * this.projectionScale));
        positions.push(u, v, w);
      }
    });

    if (positions.length === 0) {
      positions.push(0, 0, 0);
    }

    const splatGeom = new BufferGeometry();
    splatGeom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));

    this.pointCount = splatGeom.getAttribute("position").count;
    this.energyGain = computeEnergyGain(
      this.pointCount,
      data.trajectories.length,
      data.caustics?.intensity ?? 1,
      this.blurMultiplier
    );

    const pointSize = Math.max(6, Math.round(texSize / 64));

    if (CAUSTICS_DEBUG_MODE === "geom") {
      const debugMat = new PointsMaterial({
        size: pointSize * 0.4,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      this.debugPoints = new Points(splatGeom, debugMat);
      context.threeScene.add(this.debugPoints);
      return;
    }

    const splatMaterial = new ShaderMaterial({
      uniforms: {
        uEnergyGain: { value: this.energyGain },
        uPointSize: { value: pointSize },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uPointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec4 clipPosition = projectionMatrix * mvPosition;
          vec3 ndc = clipPosition.xyz / max(clipPosition.w, 0.0001);
          vUv = ndc.xy * 0.5 + 0.5;
          gl_PointSize = uPointSize;
          gl_Position = clipPosition;
        }
      `,
      fragmentShader: `
      varying vec2 vUv;
      uniform float uEnergyGain;
        void main() {
          if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) discard;
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = dot(c, c);
          float base = exp(-d * 18.0);
          float energy = base * uEnergyGain;
          gl_FragColor = vec4(vec3(energy), energy);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    if (CAUSTICS_DEBUG_MODE === "heatmap") {
      const heatMat = new ShaderMaterial({
        uniforms: {
          uEnergyGain: { value: this.energyGain },
          uPointSize: { value: pointSize },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float uPointSize;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vec4 clipPosition = projectionMatrix * mvPosition;
            vec3 ndc = clipPosition.xyz / max(clipPosition.w, 0.0001);
            vUv = ndc.xy * 0.5 + 0.5;
            gl_PointSize = uPointSize;
            gl_Position = clipPosition;
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uEnergyGain;
          vec3 heatColor(float e) {
            return mix(vec3(0.0, 0.0, 0.2), vec3(1.0, 1.0, 1.0), clamp(e, 0.0, 1.0));
          }
          void main() {
            if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) discard;
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = dot(c, c);
            float base = exp(-d * 18.0);
            float energy = base * uEnergyGain;
            vec3 color = heatColor(energy * 1.5);
            gl_FragColor = vec4(color, 0.9);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      this.debugPoints = new Points(splatGeom, heatMat);
      context.threeScene.add(this.debugPoints);
      return;
    }

    const points = new Points(splatGeom, splatMaterial);
    this.splatMaterial = splatMaterial;
    this.splatScene.add(points);

    const quadGeom = new PlaneGeometry(2, 2);
    this.blurMaterialH = new ShaderMaterial({
      uniforms: {
        uTexture: { value: this.splatTarget.texture },
        uDirection: { value: new Vector2(1, 0) },
        uResolution: { value: new Vector2(texSize, texSize) },
        uRadius: { value: blurSigma(data.caustics?.blurRadius ?? 0.5) },
      },
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    this.blurMaterialV = new ShaderMaterial({
      uniforms: {
        uTexture: { value: this.blurTarget.texture },
        uDirection: { value: new Vector2(0, 1) },
        uResolution: { value: new Vector2(texSize, texSize) },
        uRadius: { value: blurSigma(data.caustics?.blurRadius ?? 0.5) },
      },
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    this.blurSceneH.add(new Mesh(quadGeom, this.blurMaterialH));
    this.blurSceneV.add(new Mesh(quadGeom, this.blurMaterialV));

    this.paletteTexture = buildPaletteTexture(data.palette as Palette, data.customPalette);
    this.warmPaletteTexture = buildPaletteTexture("solar", data.customPalette);
    this.coolPaletteTexture = buildPaletteTexture("abyss", data.customPalette);
    this.outputMaterial = new ShaderMaterial({
      uniforms: {
        uTexture: { value: this.finalTarget.texture },
        uBaseTexture: { value: this.splatTarget.texture },
        uIntensity: { value: data.caustics?.intensity ?? 1 },
        uExposure: { value: 1.6 },
        uThreshold: { value: 0.08 },
        uBloomStrength: { value: 0.72 },
        uPalette: { value: this.paletteTexture },
        uPaletteWarm: { value: this.warmPaletteTexture },
        uPaletteCool: { value: this.coolPaletteTexture },
        uColorMode: { value: data.caustics?.colorMode === "warm" ? 1 : data.caustics?.colorMode === "cool" ? 2 : 0 },
        uDebugScale: { value: 1.7 },
      },
      vertexShader: colorVertex,
      fragmentShader: CAUSTICS_DEBUG_MODE === "accum" ? accumDebugFragment : colorFragment,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      toneMapped: false,
    });

    const planeGeom = new PlaneGeometry(24, 24);
    const outputPlane = new Mesh(planeGeom, this.outputMaterial);
    outputPlane.position.set(0, 0, -18);
    outputPlane.renderOrder = 5;
    this.outputPlane = outputPlane;
    context.camera.add(outputPlane);

    const backdrop = new Mesh(new PlaneGeometry(60, 60), new MeshBasicMaterial({ color: new Color(0x0d101c) }));
    backdrop.position.z = -20;
    context.camera.add(backdrop);
    this.backdrop = backdrop;

    this.renderCaustics();
  }

  private renderCaustics() {
    if (CAUSTICS_DEBUG_MODE === "geom" || CAUSTICS_DEBUG_MODE === "heatmap") return;
    if (!this.context || !this.splatScene || !this.blurSceneH || !this.blurSceneV || !this.orthoCamera || !this.splatTarget)
      return;
    const renderer = this.context.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.autoClear;
    renderer.autoClear = true;

    renderer.setRenderTarget(this.splatTarget);
    renderer.setClearColor(new Color(0x000000), 1);
    renderer.clear();
    renderer.render(this.splatScene, this.context.camera);

    if (this.blurMaterialH && this.blurMaterialV) {
      this.blurMaterialH.uniforms.uTexture.value = this.splatTarget.texture;
      renderer.setRenderTarget(this.blurTarget);
      renderer.clear();
      renderer.render(this.blurSceneH, this.orthoCamera);

      this.blurMaterialV.uniforms.uTexture.value = this.blurTarget.texture;
      renderer.setRenderTarget(this.finalTarget);
      renderer.clear();
      renderer.render(this.blurSceneV, this.orthoCamera);
    }

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevClear;

    if (this.outputMaterial) {
      const accumTex = CAUSTICS_DEBUG_MODE === "accum" ? this.splatTarget.texture : this.finalTarget?.texture;
      this.outputMaterial.uniforms.uTexture.value = accumTex ?? null;
      if (this.outputMaterial.uniforms.uBaseTexture) {
        this.outputMaterial.uniforms.uBaseTexture.value = this.splatTarget.texture;
      }
    }
  }

  private refreshPalettes(palette: Palette, customPalette: CustomPaletteState) {
    this.paletteTexture?.dispose();
    this.warmPaletteTexture?.dispose();
    this.coolPaletteTexture?.dispose();
    this.paletteTexture = buildPaletteTexture(palette, customPalette);
    this.warmPaletteTexture = buildPaletteTexture("solar", customPalette);
    this.coolPaletteTexture = buildPaletteTexture("abyss", customPalette);
    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uPalette.value = this.paletteTexture;
      this.outputMaterial.uniforms.uPaletteWarm.value = this.warmPaletteTexture;
      this.outputMaterial.uniforms.uPaletteCool.value = this.coolPaletteTexture;
      this.outputMaterial.needsUpdate = true;
    }
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    this.data = { ...this.data, ...data };
    this.refreshPalettes(data.palette as Palette, data.customPalette);
    const intensity = data.caustics?.intensity ?? 1;
    this.energyGain = computeEnergyGain(
      this.pointCount,
      this.data?.trajectories.length ?? 1,
      intensity,
      this.blurMultiplier
    );
    if (this.splatMaterial) {
      this.splatMaterial.uniforms.uEnergyGain.value = this.energyGain;
      this.splatMaterial.needsUpdate = true;
    }
    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uIntensity.value = intensity;
      this.outputMaterial.uniforms.uColorMode.value = data.caustics?.colorMode === "warm" ? 1 : data.caustics?.colorMode === "cool" ? 2 : 0;
      this.outputMaterial.needsUpdate = true;
    }
    if (this.blurMaterialH && this.blurMaterialV) {
      const radius = blurSigma(data.caustics?.blurRadius ?? 0.5);
      this.blurMaterialH.uniforms.uRadius.value = radius;
      this.blurMaterialV.uniforms.uRadius.value = radius;
      this.blurMaterialH.needsUpdate = true;
      this.blurMaterialV.needsUpdate = true;
    }
    if (this.outputPlane && this.context) {
      const dir = new Vector3();
      this.context.camera.getWorldDirection(dir);
      this.outputPlane.position.copy(this.context.camera.position).add(dir.multiplyScalar(18));
      this.outputPlane.quaternion.copy(this.context.camera.quaternion);
    }
    this.renderCaustics();
  }

  dispose({ threeScene }: RenderContext) {
    if (this.outputPlane) {
      this.outputPlane.removeFromParent();
      this.outputPlane.geometry.dispose();
      this.outputPlane.material.dispose();
    }
    if (this.debugPoints) {
      this.debugPoints.removeFromParent();
      this.debugPoints.geometry.dispose();
      (this.debugPoints.material as ShaderMaterial | PointsMaterial).dispose();
    }
    [this.splatTarget, this.blurTarget, this.finalTarget, this.baseTarget].forEach((rt) => rt?.dispose());
    this.splatTarget = null;
    this.blurTarget = null;
    this.finalTarget = null;
    this.baseTarget = null;
    this.debugPoints = null;
    this.splatScene = null;
    this.blurSceneH = null;
    this.blurSceneV = null;
    this.blurMaterialH = null;
    this.blurMaterialV = null;
    this.outputMaterial = null;
    if (this.splatMaterial) {
      this.splatMaterial.dispose();
    }
    this.splatMaterial = null;
    this.orthoCamera = null;
    this.data = null;
    this.context = null;
    if (this.backdrop) {
      this.backdrop.removeFromParent();
      this.backdrop.geometry.dispose();
      (this.backdrop.material as MeshBasicMaterial).dispose();
    }
    this.backdrop = null;
    this.paletteTexture?.dispose();
    this.warmPaletteTexture?.dispose();
    this.coolPaletteTexture?.dispose();
    this.paletteTexture = null;
    this.warmPaletteTexture = null;
    this.coolPaletteTexture = null;
    if (threeScene && this.outputPlane) {
      threeScene.remove(this.outputPlane);
    }
  }
}
