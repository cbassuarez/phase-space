import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Vector3,
} from "three";
import { buildVertexColorArray } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

function lineWidthFor(data: TrajectoryData): number {
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
  const base = data.background === "light" ? 0.72 : 0.82;
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.18, Math.min(1, base * (0.85 + energy * 0.35 + pulse * 0.3)));
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

function buildStripColorArray(
  trajectoryIndex: number,
  pointCount: number,
  data: TrajectoryData
): Float32Array {
  const baseColors = buildVertexColorArray(
    trajectoryIndex,
    pointCount,
    data.dynamics,
    data.palette,
    data.customPalette,
    data.paletteShift ?? 0
  );
  const colors = new Float32Array(pointCount * 6);
  for (let i = 0; i < pointCount; i++) {
    colors[i * 6] = baseColors[i * 3];
    colors[i * 6 + 1] = baseColors[i * 3 + 1];
    colors[i * 6 + 2] = baseColors[i * 3 + 2];
    colors[i * 6 + 3] = baseColors[i * 3];
    colors[i * 6 + 4] = baseColors[i * 3 + 1];
    colors[i * 6 + 5] = baseColors[i * 3 + 2];
  }
  return colors;
}

interface StripRecord {
  points: Vector3[];
  normals: Vector3[];
  positions: Float32Array;
  geometry: BufferGeometry;
  width: number;
}

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
  private strips: StripRecord[] = [];
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.strips = [];
    this.data = data;
    threeScene.add(this.group);

    const useAdditive = data.background !== "light";
    const opacity = lineOpacity(data);
    const width = lineWidthFor(data) * reactiveLineScale(data);

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map((p) => new Vector3(p[0], p[1], p[2]));
      const tangents = buildTangents(points);
      const normals = buildStripNormals(tangents);
      const positions = new Float32Array(traj.length * 6);
      const colors = buildStripColorArray(idx, traj.length, data);

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }

      const geom = new BufferGeometry();
      geom.setIndex(indices);
      geom.setAttribute("position", new BufferAttribute(positions, 3));
      geom.setAttribute("color", new BufferAttribute(colors, 3));
      const record: StripRecord = { points, normals, positions, geometry: geom, width };
      writeStripPositions(record, width);
      const mat = new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        side: DoubleSide,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(geom, mat);
      this.meshes.push(mesh);
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
    const useAdditive = this.data.background !== "light";
    const opacity = lineOpacity(this.data);
    const width = lineWidthFor(this.data) * reactiveLineScale(this.data);
    this.meshes.forEach((mesh, idx) => {
      const mat = mesh.material as MeshBasicMaterial;
      const pointCount = this.data!.trajectories[idx]?.length ?? 0;
      const record = this.strips[idx];
      if (record && Math.abs(record.width - width) > 0.0005) {
        writeStripPositions(record, width);
      }
      mesh.geometry.setAttribute(
        "color",
        new BufferAttribute(buildStripColorArray(idx, pointCount, this.data!), 3)
      );
      mat.opacity = opacity;
      mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
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
    this.strips = [];
  }
}
