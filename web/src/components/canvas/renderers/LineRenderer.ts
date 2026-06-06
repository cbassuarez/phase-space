import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
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
import { lerpThickness, useAdditiveBlending, type RendererStrategy, type RenderContext, type TrajectoryData } from "./base";

function lineWidthFor(data: TrajectoryData): number {
  if (data.thicknessT != null) return lerpThickness(data.thicknessT, 0.016, 0.036, 0.075);
  if (data.lineThickness === "thick") return 0.075;
  if (data.lineThickness === "thin") return 0.016;
  return 0.036;
}

function reactiveLineScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  const specific = data.lineWidthScale ?? 1;
  return Math.max(0.35, Math.min(3.4, specific * (1 + energy * 1.25 + pulse * 1.1)));
}

function lineOpacity(data: TrajectoryData): number {
  const base = data.background === "light" ? 0.88 : 0.96;
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.3, Math.min(1, base * (0.92 + energy * 0.35 + pulse * 0.3)));
}

function lineGlow(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0, Math.min(3.2, (data.emissiveBoost ?? 0) + energy * 0.7 + pulse * 0.9));
}

function buildTangents(points: Vector3[]): Vector3[] {
  return points.map((_, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new Vector3().subVectors(next, prev).normalize();
    return Number.isFinite(tangent.x) && tangent.lengthSq() > 1e-8
      ? tangent
      : new Vector3(1, 0, 0);
  });
}

function buildStripNormals(tangents: Vector3[]): Vector3[] {
  if (tangents.length === 0) return [];
  const normals: Vector3[] = [];
  const seed = Math.abs(tangents[0].y) < 0.85 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const first = new Vector3().crossVectors(tangents[0], seed).normalize();
  normals[0] = first.lengthSq() > 1e-8 ? first : new Vector3(0, 0, 1);
  for (let i = 1; i < tangents.length; i++) {
    const normal = normals[i - 1].clone();
    normal.addScaledVector(tangents[i], -normal.dot(tangents[i])).normalize();
    normals[i] = Number.isFinite(normal.x) && normal.lengthSq() > 1e-8
      ? normal
      : normals[i - 1].clone();
  }
  return normals;
}

interface StripRecord {
  points: Vector3[];
  normals: Vector3[];
  positions: Float32Array;
  geometry: BufferGeometry;
  width: number;
}

const lineVertex = `
  attribute float t;
  attribute float colorT;
  attribute float edge;
  attribute vec3 aNormal;
  attribute vec4 aField;
  varying float vT;
  varying float vColorT;
  varying float vEdge;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec4 vField;
  void main() {
    vT = t;
    vColorT = colorT;
    vEdge = edge;
    vNormal = aNormal;
    vField = aField;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const lineFragment = `
  varying float vT;
  varying float vColorT;
  varying float vEdge;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec4 vField;
  uniform sampler2D uPalette;
  uniform float uPaletteShift;
  uniform float uOpacity;
  uniform vec3 uCamPos;
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform float uKeyI;
  uniform vec3 uFillDir;
  uniform vec3 uFillColor;
  uniform float uFillI;
  uniform vec3 uAmbient;
  ${materialShaderChunk}
  ${traceShaderChunk}

  void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;
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
      abs(vEdge)
    );
    float edgeGlow = pow(abs(vEdge), 2.4);
    lit += albedo * edgeGlow * (0.24 + fieldEnergy * 0.72 + uEmissive * 0.22);
    lit *= mix(0.72, 1.08, vT);
    vec3 color = psFilmicToneMap(lit * uExposure);
    float alpha = uOpacity * uMaterialAlpha * mix(0.72, 1.0, edgeGlow);
    float comet = psCometMask(vT);
    color *= mix(1.0, comet, uTrace);
    alpha *= mix(1.0, clamp(comet, 0.0, 1.0), uTrace);
    gl_FragColor = vec4(color, alpha);
  }
`;

type LineUniforms = LightingUniforms & MaterialUniforms & {
  uPalette: { value: DataTexture | null };
  uPaletteShift: { value: number };
  uOpacity: { value: number };
  uCamPos: { value: Vector3 };
  uTrace: { value: number };
  uHead: { value: number };
  uDecay: { value: number };
};

function writeStripPositions(record: StripRecord, width: number) {
  const { points, normals, positions } = record;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const n = normals[i];
    positions[i * 6] = p.x - n.x * width;
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

/**
 * Polyline rendering as narrow triangle strips. Browser-native WebGL
 * lines ignore linewidth on most platforms, so line thickness has to
 * be real geometry rather than LineBasicMaterial.linewidth.
 */
export class LineRenderer implements RendererStrategy {
  readonly style = "line" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private materials: ShaderMaterial[] = [];
  private strips: StripRecord[] = [];
  private paletteTexture: DataTexture | null = null;
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;

  init(context: RenderContext, data: TrajectoryData) {
    const { threeScene } = context;
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.strips = [];
    this.paletteTexture = buildPaletteTexture(data.palette, data.customPalette);
    this.data = data;
    this.context = context;
    threeScene.add(this.group);

    const useAdditive = useAdditiveBlending(data.background);
    const opacity = lineOpacity(data);
    const width = lineWidthFor(data) * reactiveLineScale(data);
    const lighting = getLighting();

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map((p) => new Vector3(p[0], p[1], p[2]));
      const tangents = buildTangents(points);
      const normals = buildStripNormals(tangents);
      const positions = new Float32Array(traj.length * 6);
      const surfaceNormals = new Float32Array(traj.length * 6);
      const tAttr = new Float32Array(traj.length * 2);
      const colorAttr = new Float32Array(traj.length * 2);
      const fieldAttr = new Float32Array(traj.length * 8);
      const edgeAttr = new Float32Array(traj.length * 2);

      for (let i = 0; i < traj.length; i++) {
        const tNorm = traj.length > 1 ? i / (traj.length - 1) : 0;
        const surface = new Vector3().crossVectors(tangents[i], normals[i]).normalize();
        if (!Number.isFinite(surface.x) || surface.lengthSq() < 1e-8) surface.set(0, 0, 1);
        surfaceNormals[i * 6 + 0] = surface.x;
        surfaceNormals[i * 6 + 1] = surface.y;
        surfaceNormals[i * 6 + 2] = surface.z;
        surfaceNormals[i * 6 + 3] = surface.x;
        surfaceNormals[i * 6 + 4] = surface.y;
        surfaceNormals[i * 6 + 5] = surface.z;
        tAttr[i * 2] = tNorm;
        tAttr[i * 2 + 1] = tNorm;
        const colorT = dynamicScalarAt(data.dynamics, idx, i, tNorm);
        colorAttr[i * 2] = colorT;
        colorAttr[i * 2 + 1] = colorT;
        writeVisualFieldVector(fieldAttr, i * 8, data.dynamics, idx, i, tNorm);
        writeVisualFieldVector(fieldAttr, i * 8 + 4, data.dynamics, idx, i, tNorm);
        edgeAttr[i * 2] = -1;
        edgeAttr[i * 2 + 1] = 1;
      }

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }

      const geom = new BufferGeometry();
      geom.setIndex(indices);
      geom.setAttribute("position", new BufferAttribute(positions, 3));
      geom.setAttribute("aNormal", new BufferAttribute(surfaceNormals, 3));
      geom.setAttribute("t", new BufferAttribute(tAttr, 1));
      geom.setAttribute("colorT", new BufferAttribute(colorAttr, 1));
      geom.setAttribute("aField", new BufferAttribute(fieldAttr, 4));
      geom.setAttribute("edge", new BufferAttribute(edgeAttr, 1));
      const record: StripRecord = { points, normals, positions, geometry: geom, width };
      writeStripPositions(record, width);
      const uniforms: LineUniforms = {
        uPalette: { value: this.paletteTexture },
        uPaletteShift: { value: data.paletteShift ?? 0 },
        uOpacity: { value: opacity },
        uCamPos: { value: context.camera.position.clone() },
        uTrace: { value: data.traceActive ? 1 : 0 },
        uHead: { value: data.traceHead ?? 0 },
        uDecay: { value: data.traceDecay ?? 0.12 },
        ...createLightingUniforms(lighting),
        ...createMaterialUniforms(data.materialTransmission),
      };
      applyMaterialUniforms(uniforms, data.materialTransmission, lineGlow(data));
      const mat = new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(geom, mat);
      this.meshes.push(mesh);
      this.materials.push(mat);
      this.strips.push(record);
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
    const useAdditive = useAdditiveBlending(this.data.background);
    const opacity = lineOpacity(this.data);
    const width = lineWidthFor(this.data) * reactiveLineScale(this.data);
    const lighting = getLighting();
    const camPos = this.context?.camera.position;
    this.meshes.forEach((mesh, idx) => {
      const pointCount = this.data!.trajectories[idx]?.length ?? 0;
      const record = this.strips[idx];
      const mat = this.materials[idx];
      if (!mat) return;
      if (record && Math.abs(record.width - width) > 0.0005) {
        writeStripPositions(record, width);
      }
      const u = mat?.uniforms as unknown as LineUniforms | undefined;
      if (u) {
        u.uPaletteShift.value = this.data!.paletteShift ?? 0;
        u.uOpacity.value = opacity;
        if (camPos) u.uCamPos.value.copy(camPos);
        u.uTrace.value = this.data!.traceActive ? 1 : 0;
        u.uHead.value = this.data!.traceHead ?? 0;
        u.uDecay.value = this.data!.traceDecay ?? 0.12;
        applyLightingUniforms(u, lighting);
        applyMaterialUniforms(u, this.data.materialTransmission, lineGlow(this.data));
      }
      mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
      mat.needsUpdate = true;
      if (pointCount <= 0) mesh.visible = false;
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
