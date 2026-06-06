import {
  AdditiveBlending,
  DataTexture,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { buildPaletteTexture, dynamicScalarAt, writeVisualFieldVector } from "./utils";
import { getLighting } from "../../../visual/lighting";
import {
  applyLightingUniforms,
  applyMaterialUniforms,
  createLightingUniforms,
  createMaterialUniforms,
  materialShaderChunk,
  traceShaderChunk,
  type LightingUniforms,
  type MaterialUniforms,
} from "./materials";
import { lerpThickness, useAdditiveBlending, type RendererStrategy, type RenderContext, type TrajectoryData } from "./base";

function cellScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  const base = data.cellSize ?? 1;
  const specific = data.cellSizeScale ?? 1;
  return Math.max(0.35, Math.min(3.4, base * specific * (1 + energy * 1.2 + pulse * 1.45)));
}

function pointOpacity(data: TrajectoryData, density: number): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.3, Math.min(1, 0.95 * (0.5 + density * 0.72 + energy * 0.25 + pulse * 0.2)));
}

function cellGlow(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0, Math.min(3.5, (data.emissiveBoost ?? 0) + energy * 0.8 + pulse * 1.1));
}

const cellVertex = `
  attribute float colorT;
  attribute float aArc;
  attribute vec4 aField;
  varying float vColorT;
  varying float vArc;
  varying vec4 vField;
  varying vec3 vWorldPos;
  uniform float uPointSize;
  uniform float uViewportHeight;
  void main() {
    vColorT = colorT;
    vArc = aArc;
    vField = aField;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uPointSize * uViewportHeight * projectionMatrix[1][1] / max(0.05, -mv.z));
  }
`;

const cellFragment = `
  varying float vColorT;
  varying float vArc;
  varying vec4 vField;
  varying vec3 vWorldPos;
  uniform sampler2D uPalette;
  uniform float uPaletteShift;
  uniform float uOpacity;
  uniform vec3 uCamPos;
  uniform vec3 uCameraRight;
  uniform vec3 uCameraUp;
  uniform vec3 uCameraForward;
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform float uKeyI;
  uniform vec3 uFillDir;
  uniform vec3 uFillColor;
  uniform float uFillI;
  uniform vec3 uAmbient;
  uniform float uShape; // 0 circular (sphere), 1 cel (flat disc), 2 square
  ${materialShaderChunk}
  ${traceShaderChunk}

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float z;
    float core;
    vec3 normal;
    if (uShape < 0.5) {
      // Circular — shaded sphere impostor.
      if (r2 > 1.0) discard;
      z = sqrt(max(0.0, 1.0 - r2));
      normal = normalize(p.x * uCameraRight + p.y * uCameraUp - z * uCameraForward);
      core = pow(max(0.0, 1.0 - r2), 0.45);
    } else if (uShape < 1.5) {
      // Cel — flat camera-facing disc with a crisp rim.
      if (r2 > 1.0) discard;
      z = 1.0;
      normal = -uCameraForward;
      core = 1.0 - smoothstep(0.80, 1.0, sqrt(r2));
    } else {
      // Square — flat camera-facing tile.
      z = 1.0;
      normal = -uCameraForward;
      float d = max(abs(p.x), abs(p.y));
      core = 1.0 - smoothstep(0.86, 1.0, d);
    }
    vec3 viewDir = normalize(uCamPos - vWorldPos);
    float fieldEnergy = psFieldEnergy(vField);
    float paletteT = psPaletteT(vColorT, vField, uPaletteShift);
    vec3 albedo = texture2D(uPalette, vec2(paletteT, 0.5)).rgb;
    vec3 lit = psMaterialShade(
      albedo,
      normal,
      viewDir,
      uKeyDir,
      uKeyColor,
      uKeyI,
      uFillDir,
      uFillColor,
      uFillI,
      uAmbient,
      fieldEnergy,
      1.0 - z
    );
    lit += albedo * core * (0.18 + uEmissive * 0.35 + fieldEnergy * 0.35);
    vec3 color = psFilmicToneMap(lit * uExposure);
    float alpha = uOpacity * uMaterialAlpha * core;
    float comet = psCometMask(vArc);
    color *= mix(1.0, comet, uTrace);
    alpha *= mix(1.0, clamp(comet, 0.0, 1.0), uTrace);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function cellShapeToNumber(shape: TrajectoryData["cellShape"]): number {
  if (shape === "cel") return 1;
  if (shape === "square") return 2;
  return 0; // circular (default)
}

function cellShapeValue(data: TrajectoryData): number {
  return data.cellShapeNumber ?? cellShapeToNumber(data.cellShape);
}

type CellUniforms = LightingUniforms & MaterialUniforms & {
  uPalette: { value: DataTexture | null };
  uPaletteShift: { value: number };
  uOpacity: { value: number };
  uShape: { value: number };
  uPointSize: { value: number };
  uViewportHeight: { value: number };
  uCamPos: { value: Vector3 };
  uCameraRight: { value: Vector3 };
  uCameraUp: { value: Vector3 };
  uCameraForward: { value: Vector3 };
  uTrace: { value: number };
  uHead: { value: number };
  uDecay: { value: number };
};

/**
 * Soft point-sprite cells. Slightly larger and softer than the
 * previous shader-impostor cells — reads as a stippled / particle
 * cloud rather than discrete spheres.
 */
export class CellsRenderer implements RendererStrategy {
  readonly style = "cells" as const;
  private group: Group | null = null;
  private points: Points[] = [];
  private materials: ShaderMaterial[] = [];
  private paletteTexture: DataTexture | null = null;
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;
  private size = new Vector2(1, 1);

  init(context: RenderContext, data: TrajectoryData) {
    const { threeScene } = context;
    this.group = new Group();
    this.points = [];
    this.materials = [];
    this.paletteTexture = buildPaletteTexture(data.palette, data.customPalette);
    this.data = data;
    this.context = context;
    threeScene.add(this.group);
    context.renderer.getSize(this.size);
    const lighting = getLighting();

    // Cap the total cell count so dense / high-resolution trajectories don't
    // spawn tens of thousands of point sprites (heavy fill/overdraw that drags
    // the framerate). Subsample each trajectory with a shared stride; arc and
    // colour use the ORIGINAL index so aging and the Draw comet still map right.
    const MAX_CELLS = 6000;
    const totalPoints = data.trajectories.reduce((sum, t) => sum + t.length, 0);
    const stride = Math.max(1, Math.ceil(totalPoints / MAX_CELLS));

    data.trajectories.forEach((traj, idx) => {
      const sampled = Math.ceil(traj.length / stride);
      const positions: number[] = [];
      const colorAttr = new Float32Array(sampled);
      const arcAttr = new Float32Array(sampled);
      const fieldAttr = new Float32Array(sampled * 4);
      let k = 0;
      for (let i = 0; i < traj.length; i += stride) {
        const [x, y, z] = traj[i];
        positions.push(x, y, z);
        const progress = traj.length > 1 ? i / (traj.length - 1) : 0;
        arcAttr[k] = progress;
        colorAttr[k] = dynamicScalarAt(data.dynamics, idx, i, progress);
        writeVisualFieldVector(fieldAttr, k * 4, data.dynamics, idx, i, progress);
        k++;
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geom.setAttribute("colorT", new Float32BufferAttribute(colorAttr, 1));
      geom.setAttribute("aArc", new Float32BufferAttribute(arcAttr, 1));
      geom.setAttribute("aField", new Float32BufferAttribute(fieldAttr, 4));
      const useAdditive = useAdditiveBlending(data.background);
      const density = data.cloudDensity ?? 1;
      const size =
        (data.thicknessT != null
          ? lerpThickness(data.thicknessT, 0.14, 0.2, 0.26)
          : data.lineThickness === "thick" ? 0.26 : data.lineThickness === "thin" ? 0.14 : 0.2) *
        (0.7 + density * 0.6) *
        cellScale(data);
      const uniforms: CellUniforms = {
        uPalette: { value: this.paletteTexture },
        uPaletteShift: { value: data.paletteShift ?? 0 },
        uOpacity: { value: pointOpacity(data, density) },
        uShape: { value: cellShapeValue(data) },
        uPointSize: { value: size },
        uViewportHeight: { value: this.size.y },
        uCamPos: { value: context.camera.position.clone() },
        uCameraRight: { value: new Vector3(1, 0, 0) },
        uCameraUp: { value: new Vector3(0, 1, 0) },
        uCameraForward: { value: new Vector3(0, 0, 1) },
        uTrace: { value: data.traceActive ? 1 : 0 },
        uHead: { value: data.traceHead ?? 0 },
        uDecay: { value: data.traceDecay ?? 0.12 },
        ...createLightingUniforms(lighting),
        ...createMaterialUniforms(data.materialTransmission),
      };
      applyMaterialUniforms(uniforms, data.materialTransmission, cellGlow(data));
      const mat = new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader: cellVertex,
        fragmentShader: cellFragment,
        transparent: true,
        depthWrite: false,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        toneMapped: false,
      });
      const cloud = new Points(geom, mat);
      this.points.push(cloud);
      this.materials.push(mat);
      this.group?.add(cloud);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const density = this.data.cloudDensity ?? 1;
    const useAdditive = useAdditiveBlending(this.data.background);
    const lighting = getLighting();
    const context = this.context;
    context?.renderer.getSize(this.size);

    this.points.forEach((cloud, idx) => {
      const mat = this.materials[idx];
      if (!mat) return;
      const u = mat.uniforms as unknown as CellUniforms;
      u.uPointSize.value =
        (this.data.thicknessT != null
          ? lerpThickness(this.data.thicknessT, 0.14, 0.2, 0.26)
          : this.data.lineThickness === "thick" ? 0.26 : this.data.lineThickness === "thin" ? 0.14 : 0.2) *
        (0.7 + density * 0.6) *
        cellScale(this.data);
      u.uOpacity.value = pointOpacity(this.data, density);
      u.uShape.value = cellShapeValue(this.data);
      u.uPaletteShift.value = this.data.paletteShift ?? 0;
      u.uViewportHeight.value = this.size.y;
      u.uTrace.value = this.data.traceActive ? 1 : 0;
      u.uHead.value = this.data.traceHead ?? 0;
      u.uDecay.value = this.data.traceDecay ?? 0.12;
      if (context) {
        u.uCamPos.value.copy(context.camera.position);
        const e = context.camera.matrixWorld.elements;
        u.uCameraRight.value.set(e[0], e[1], e[2]).normalize();
        u.uCameraUp.value.set(e[4], e[5], e[6]).normalize();
        u.uCameraForward.value.set(-e[8], -e[9], -e[10]).normalize();
      }
      applyLightingUniforms(u, lighting);
      applyMaterialUniforms(u, this.data.materialTransmission, cellGlow(this.data));
      mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const pts = this.points[trajectoryIndex];
    if (!pts) return;
    // The geometry is subsampled, so clamp the requested range (given in
    // original-trajectory indices) to the actual point count.
    const total = pts.geometry.getAttribute("position")?.count ?? count;
    const s = Math.min(start, total);
    pts.geometry.setDrawRange(s, Math.min(count, total - s));
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const p = obj as Points;
        if (p.geometry) p.geometry.dispose();
        if (p.material) {
          const mat = p.material as ShaderMaterial;
          mat.dispose();
        }
      });
    }
    this.group = null;
    this.points = [];
    this.materials = [];
    this.paletteTexture?.dispose();
    this.paletteTexture = null;
    this.data = null;
    this.context = null;
  }
}
