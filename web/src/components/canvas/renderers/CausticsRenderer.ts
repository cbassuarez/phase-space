import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  RGBFormat,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { ProjectionAxis } from "../../../types";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { samplePalette, type PaletteDef } from "../../../palettes";

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
  uniform float uIntensity;
  uniform int uColorMode;
  uniform sampler2D uPaletteTex;

  vec3 lerp3(vec3 a, vec3 b, float t) {
    return a + (b - a) * t;
  }

  vec3 paletteSample(float t) {
    return texture2D(uPaletteTex, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
  }

  vec3 causticWarm(float t) {
    vec3 c1 = vec3(0.992, 0.820, 0.298);
    vec3 c2 = vec3(0.992, 0.580, 0.196);
    vec3 c3 = vec3(0.902, 0.274, 0.223);
    if (t < 0.5) return lerp3(c1, c2, t * 2.0);
    return lerp3(c2, c3, (t - 0.5) * 2.0);
  }

  vec3 causticCool(float t) {
    vec3 c1 = vec3(0.0, 0.635, 0.643);
    vec3 c2 = vec3(0.235, 0.423, 0.988);
    vec3 c3 = vec3(0.643, 0.356, 0.992);
    if (t < 0.5) return lerp3(c1, c2, t * 2.0);
    return lerp3(c2, c3, (t - 0.5) * 2.0);
  }

  void main() {
    float intensity = texture2D(uTexture, vUv).r;
    float boosted = pow(intensity * 1.2, 0.72) * uIntensity;
    boosted = clamp(boosted, 0.0, 3.0);
    vec3 color;
    if (uColorMode == 1) {
      color = causticWarm(clamp(boosted * 0.8, 0.0, 1.0));
    } else if (uColorMode == 2) {
      color = causticCool(clamp(boosted * 0.85, 0.0, 1.0));
    } else {
      color = paletteSample(clamp(boosted, 0.0, 1.0));
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

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

function paletteTextureFromDef(def: PaletteDef): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * 3);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const { r, g, b } = samplePalette(def, t);
    data[i * 3 + 0] = Math.round(r * 255);
    data[i * 3 + 1] = Math.round(g * 255);
    data[i * 3 + 2] = Math.round(b * 255);
  }
  const tex = new DataTexture(data, size, 1, RGBFormat);
  tex.needsUpdate = true;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  return tex;
}

function normalize(value: number, min: number, max: number): number {
  if (max - min < 1e-5) return 0.5;
  return (value - min) / (max - min);
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
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;
  private blurMaterialH: ShaderMaterial | null = null;
  private blurMaterialV: ShaderMaterial | null = null;
  private outputMaterial: ShaderMaterial | null = null;
  private paletteTexture: DataTexture | null = null;
  private projectionAxis: ProjectionAxis = "auto";
  private backdrop: Mesh | null = null;

  private setPaletteTexture(def: PaletteDef) {
    this.paletteTexture?.dispose();
    this.paletteTexture = paletteTextureFromDef(def);
    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uPaletteTex.value = this.paletteTexture;
    }
  }

  init(context: RenderContext, data: TrajectoryData) {
    this.context = context;
    this.data = data;
    this.projectionAxis = data.caustics?.projectionAxis ?? "auto";

    const texSize = data.quality?.causticsTextureSize ?? 512;
    this.splatTarget = new WebGLRenderTarget(texSize, texSize, { depthBuffer: false, stencilBuffer: false });
    this.blurTarget = new WebGLRenderTarget(texSize, texSize, { depthBuffer: false, stencilBuffer: false });
    this.finalTarget = new WebGLRenderTarget(texSize, texSize, { depthBuffer: false, stencilBuffer: false });

    this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.splatScene = new Scene();
    this.blurSceneH = new Scene();
    this.blurSceneV = new Scene();

    const axis = this.projectionAxis === "auto" ? chooseAxisAuto(data.trajectories) : this.projectionAxis;
    const bounds = computeBounds(data.trajectories, axis);
    const pointStep = Math.max(1, Math.round(data.quality?.causticsPointStep ?? 2));
    const positions: number[] = [];

    data.trajectories.forEach((traj) => {
      for (let i = 0; i < traj.length; i += pointStep) {
        const p = traj[i];
        const [a, b] = projectionComponents(axis);
        const u = normalize(p[a], bounds.min[0], bounds.max[0]) * 2 - 1;
        const v = normalize(p[b], bounds.min[1], bounds.max[1]) * 2 - 1;
        positions.push(u, v, 0);
      }
    });

    if (positions.length === 0) {
      positions.push(0, 0, 0);
    }

    const splatGeom = new BufferGeometry();
    splatGeom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));

    const splatMaterial = new ShaderMaterial({
      vertexShader: `
        void main() {
          gl_PointSize = ${Math.max(4, Math.round(8 * (texSize / 512)))}.0;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = dot(c, c);
          float a = exp(-d * 10.0);
          gl_FragColor = vec4(vec3(a), a) * 1.4;
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });

    const points = new Points(splatGeom, splatMaterial);
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

    this.paletteTexture = paletteTextureFromDef(data.paletteDef);
    this.outputMaterial = new ShaderMaterial({
      uniforms: {
        uTexture: { value: this.finalTarget.texture },
        uIntensity: { value: data.caustics?.intensity ?? 1 },
        uPaletteTex: { value: this.paletteTexture },
        uColorMode: { value: data.caustics?.colorMode === "warm" ? 1 : data.caustics?.colorMode === "cool" ? 2 : 0 },
      },
      vertexShader: colorVertex,
      fragmentShader: colorFragment,
      depthWrite: false,
      depthTest: false,
      transparent: true,
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
    if (!this.context || !this.splatScene || !this.blurSceneH || !this.blurSceneV || !this.orthoCamera) return;
    const renderer = this.context.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.autoClear;
    renderer.autoClear = true;

    renderer.setRenderTarget(this.splatTarget);
    renderer.setClearColor(new Color(0x000000), 1);
    renderer.clear();
    renderer.render(this.splatScene, this.orthoCamera);

    if (this.blurMaterialH && this.blurMaterialV) {
      renderer.setRenderTarget(this.blurTarget);
      renderer.clear();
      renderer.render(this.blurSceneH, this.orthoCamera);

      renderer.setRenderTarget(this.finalTarget);
      renderer.clear();
      renderer.render(this.blurSceneV, this.orthoCamera);
    }

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevClear;

    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uTexture.value = this.finalTarget?.texture ?? null;
    }
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    this.data = { ...this.data, ...data };
    if (this.outputMaterial) {
      this.outputMaterial.uniforms.uIntensity.value = data.caustics?.intensity ?? 1;
      this.outputMaterial.uniforms.uColorMode.value = data.caustics?.colorMode === "warm" ? 1 : data.caustics?.colorMode === "cool" ? 2 : 0;
      this.setPaletteTexture(data.paletteDef);
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
    [this.splatTarget, this.blurTarget, this.finalTarget].forEach((rt) => rt?.dispose());
    this.splatTarget = null;
    this.blurTarget = null;
    this.finalTarget = null;
    this.paletteTexture?.dispose();
    this.paletteTexture = null;
    this.splatScene = null;
    this.blurSceneH = null;
    this.blurSceneV = null;
    this.blurMaterialH = null;
    this.blurMaterialV = null;
    this.outputMaterial = null;
    this.orthoCamera = null;
    this.data = null;
    this.context = null;
    if (this.backdrop) {
      this.backdrop.removeFromParent();
      this.backdrop.geometry.dispose();
      (this.backdrop.material as MeshBasicMaterial).dispose();
    }
    this.backdrop = null;
    if (threeScene && this.outputPlane) {
      threeScene.remove(this.outputPlane);
    }
  }
}
