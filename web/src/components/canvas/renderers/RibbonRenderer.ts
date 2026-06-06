import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
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
import { lerpThickness, type RendererStrategy, type RenderContext, type TrajectoryData } from "./base";

/**
 * Ribbon renderer — lit version.
 *
 * Geometry is unchanged from the previous Bishop-frame rewrite. What
 * changed: the unlit shader is replaced with a Lambert + half-
 * Lambert-fill shader that samples the shared LightingConfig
 * singleton. The ribbon now visibly turns through the key light as
 * the camera orbits and the lit/shadow sides separate; tail still
 * dims via the per-vertex `t` aging gradient.
 *
 * Lighting in world space: we pass the world-space surface normal as
 * an attribute and dot it against the world-space key/fill directions
 * directly. Avoids the view-matrix gymnastics that the previous fake-
 * shading relied on, and means the light direction is read from the
 * tweaks without any per-renderer plumbing.
 */

const ribbonVertex = `
  attribute float t;
  attribute float colorT;
  attribute vec3 aNormal;     // world-space surface normal
  attribute vec4 aField;
  varying vec3  vNormal;
  varying float vT;
  varying float vColorT;
  varying vec4  vField;
  varying vec3  vWorldPos;
  void main() {
    vNormal = aNormal;
    vT = t;
    vColorT = colorT;
    vField = aField;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ribbonFragment = `
  varying vec3 vNormal;
  varying float vT;
  varying float vColorT;
  varying vec4 vField;
  varying vec3 vWorldPos;
  uniform sampler2D uPalette;
  uniform float uPaletteShift;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDir;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;
  uniform vec3  uCamPos;
  ${materialShaderChunk}
  ${traceShaderChunk}

  vec3 paletteSample(float t) {
    return texture2D(uPalette, vec2(fract(t), 0.5)).rgb;
  }

  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 viewDir = normalize(uCamPos - vWorldPos);
    float fieldEnergy = psFieldEnergy(vField);
    vec3 color = paletteSample(psPaletteT(vColorT, vField, uPaletteShift));
    vec3 lit = psMaterialShade(
      color,
      n,
      viewDir,
      uKeyDir,
      uKeyColor,
      uKeyI,
      uFillDir,
      uFillColor,
      uFillI,
      uAmbient,
      fieldEnergy,
      0.7
    );

    // Tail aging dims the band; head stays at full lit value.
    float age = mix(0.55, 1.0, vT);
    vec3 col = psFilmicToneMap(lit * age * uExposure);

    float alpha = uMaterialAlpha * mix(0.6, 1.0, vT * vT);
    float comet = psCometMask(vT);
    col *= mix(1.0, comet, uTrace);
    alpha *= mix(1.0, clamp(comet, 0.0, 1.0), uTrace);
    gl_FragColor = vec4(col, alpha);
  }
`;

type RibbonUniforms = LightingUniforms & MaterialUniforms & {
  uPalette: { value: DataTexture | null };
  uPaletteShift: { value: number };
  uCamPos: { value: Vector3 };
  uTrace: { value: number };
  uHead: { value: number };
  uDecay: { value: number };
};

function ribbonWidthFor(data: TrajectoryData): number {
  const base =
    data.thicknessT != null
      ? lerpThickness(data.thicknessT, 0.12, 0.18, 0.28)
      : data.lineThickness === "thick" ? 0.28
      : data.lineThickness === "thin" ? 0.12
      : 0.18;
  return base * (data.ribbonWidth ?? 1);
}

function reactiveRibbonScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.45, Math.min(2.8, 1 + energy * 0.65 + pulse * 0.45));
}

function reactiveRibbonGlow(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(
    0,
    Math.min(4, (data.emissiveBoost ?? 0) + (data.ribbonGlow ?? 0) + energy * 1.1 + pulse * 1.4)
  );
}

function buildFrames(points: Vector3[]): { normals: Vector3[]; tangents: Vector3[] } {
  const n = points.length;
  const tangents: Vector3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    tangents[i] = new Vector3().subVectors(next, prev).normalize();
    if (!isFinite(tangents[i].x)) tangents[i].set(1, 0, 0);
  }
  const t0 = tangents[0];
  const ax = Math.abs(t0.x), ay = Math.abs(t0.y), az = Math.abs(t0.z);
  const seed =
    ax <= ay && ax <= az ? new Vector3(1, 0, 0)
    : ay <= az            ? new Vector3(0, 1, 0)
    :                       new Vector3(0, 0, 1);
  const n0 = new Vector3().crossVectors(t0, seed).normalize();
  if (!isFinite(n0.x) || n0.lengthSq() < 1e-8) n0.set(0, 1, 0);
  const normals: Vector3[] = new Array(n);
  normals[0] = n0;
  const axis = new Vector3();
  for (let i = 1; i < n; i++) {
    const tPrev = tangents[i - 1];
    const tCurr = tangents[i];
    axis.crossVectors(tPrev, tCurr);
    const sinT = axis.length();
    const cosT = Math.max(-1, Math.min(1, tPrev.dot(tCurr)));
    if (sinT < 1e-6) {
      normals[i] = normals[i - 1].clone();
      continue;
    }
    axis.divideScalar(sinT);
    const theta = Math.atan2(sinT, cosT);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const nPrev = normals[i - 1];
    const dot = axis.dot(nPrev);
    const rotated = new Vector3()
      .copy(nPrev).multiplyScalar(c)
      .addScaledVector(new Vector3().crossVectors(axis, nPrev), s)
      .addScaledVector(axis, dot * (1 - c));
    rotated.addScaledVector(tCurr, -rotated.dot(tCurr)).normalize();
    if (!isFinite(rotated.x)) rotated.copy(nPrev);
    normals[i] = rotated;
  }
  return { normals, tangents };
}

interface RibbonRecord {
  points: Vector3[];
  normals: Vector3[];
  positions: Float32Array;
  geometry: BufferGeometry;
  width: number;
}

// Width is the ribbon's half-extent along its normal — a geometry offset, not
// a transform. Re-offsetting the centreline keeps the trajectory put; scaling
// the whole mesh (the old bug) zoomed the attractor instead of widening it.
function writeRibbonPositions(record: RibbonRecord, width: number) {
  const { points, normals, positions } = record;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const n = normals[i];
    positions[i * 6 + 0] = p.x - n.x * width;
    positions[i * 6 + 1] = p.y - n.y * width;
    positions[i * 6 + 2] = p.z - n.z * width;
    positions[i * 6 + 3] = p.x + n.x * width;
    positions[i * 6 + 4] = p.y + n.y * width;
    positions[i * 6 + 5] = p.z + n.z * width;
  }
  record.width = width;
  const attr = record.geometry.getAttribute("position") as BufferAttribute | undefined;
  if (attr) attr.needsUpdate = true;
}

export class RibbonRenderer implements RendererStrategy {
  readonly style = "ribbon" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private materials: ShaderMaterial[] = [];
  private strips: RibbonRecord[] = [];
  private paletteTexture: DataTexture | null = null;
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;

  init(context: RenderContext, data: TrajectoryData) {
    const { threeScene } = context;
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.strips = [];
    this.data = data;
    this.context = context;
    this.paletteTexture = buildPaletteTexture(data.palette, data.customPalette);
    threeScene.add(this.group);

    const widthBase = ribbonWidthFor(data);
    const lighting = getLighting();

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map((p) => new Vector3(p[0], p[1], p[2]));
      const { normals, tangents } = buildFrames(points);

      const positions = new Float32Array(traj.length * 6);
      const vertNormals = new Float32Array(traj.length * 6);
      const tAttr = new Float32Array(traj.length * 2);
      const colorAttr = new Float32Array(traj.length * 2);
      const fieldAttr = new Float32Array(traj.length * 8);

      for (let i = 0; i < traj.length; i++) {
        const n = normals[i];
        const t = tangents[i];
        const surface = new Vector3().crossVectors(t, n).normalize();

        vertNormals[i * 6 + 0] = surface.x;
        vertNormals[i * 6 + 1] = surface.y;
        vertNormals[i * 6 + 2] = surface.z;
        vertNormals[i * 6 + 3] = surface.x;
        vertNormals[i * 6 + 4] = surface.y;
        vertNormals[i * 6 + 5] = surface.z;

        const tNorm = traj.length > 1 ? i / (traj.length - 1) : 0;
        tAttr[i * 2 + 0] = tNorm;
        tAttr[i * 2 + 1] = tNorm;
        const colorT = dynamicScalarAt(data.dynamics, idx, i, tNorm);
        colorAttr[i * 2 + 0] = colorT;
        colorAttr[i * 2 + 1] = colorT;
        writeVisualFieldVector(fieldAttr, i * 8, data.dynamics, idx, i, tNorm);
        writeVisualFieldVector(fieldAttr, i * 8 + 4, data.dynamics, idx, i, tNorm);
      }

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        indices.push(a, b, d, a, d, c);
      }

      const geometry = new BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("aNormal", new BufferAttribute(vertNormals, 3));
      geometry.setAttribute("t", new BufferAttribute(tAttr, 1));
      geometry.setAttribute("colorT", new BufferAttribute(colorAttr, 1));
      geometry.setAttribute("aField", new BufferAttribute(fieldAttr, 4));

      const record: RibbonRecord = { points, normals, positions, geometry, width: 0 };
      writeRibbonPositions(record, widthBase);
      this.strips.push(record);

      const uniforms: RibbonUniforms = {
        uPalette: { value: this.paletteTexture },
        uPaletteShift: { value: data.paletteShift ?? 0 },
        uCamPos: { value: context.camera.position.clone() },
        uTrace: { value: data.traceActive ? 1 : 0 },
        uHead: { value: data.traceHead ?? 0 },
        uDecay: { value: data.traceDecay ?? 0.12 },
        ...createLightingUniforms(lighting),
        ...createMaterialUniforms(data.materialTransmission),
      };
      applyMaterialUniforms(uniforms, data.materialTransmission, reactiveRibbonGlow(data));
      const material = new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new Mesh(geometry, material);
      this.meshes.push(mesh);
      this.materials.push(material);
      this.group?.add(mesh);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const paletteShift = this.data.paletteShift ?? 0;
    const lighting = getLighting();
    const camPos = this.context?.camera.position;
    // Effective half-width: the style/slider width (already folded into
    // ribbonWidthFor) times the audio-reactive pulse. Applied as a geometry
    // re-offset so the ribbon widens in place instead of zooming.
    const width = ribbonWidthFor(this.data) * reactiveRibbonScale(this.data);

    this.meshes.forEach((_mesh, idx) => {
      const record = this.strips[idx];
      if (record && Math.abs(record.width - width) > 1e-4) {
        writeRibbonPositions(record, width);
      }
      const mat = this.materials[idx];
      if (!mat) return;
      const u = mat.uniforms as unknown as RibbonUniforms;
      u.uPaletteShift.value = paletteShift;
      if (camPos) u.uCamPos.value.copy(camPos);
      u.uTrace.value = this.data!.traceActive ? 1 : 0;
      u.uHead.value = this.data!.traceHead ?? 0;
      u.uDecay.value = this.data!.traceDecay ?? 0.12;
      applyLightingUniforms(u, lighting);
      applyMaterialUniforms(u, this.data.materialTransmission, reactiveRibbonGlow(this.data));
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    mesh.geometry.setDrawRange(start * 6, Math.max(0, count - 1) * 6);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
    }
    this.group = null;
    this.meshes = [];
    this.materials = [];
    this.strips = [];
    this.paletteTexture?.dispose();
    this.paletteTexture = null;
    this.data = null;
    this.context = null;
  }
}
