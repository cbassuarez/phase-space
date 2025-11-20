import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class RibbonRenderer implements RendererStrategy {
  readonly style = "ribbon" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.data = data;
    threeScene.add(this.group);

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const up = new Vector3(0, 1, 0);
      const positions: number[] = [];
      const normals: number[] = [];

      for (let i = 0; i < traj.length; i++) {
        const current = new Vector3().fromArray(traj[i]);
        const prev = new Vector3().fromArray(traj[Math.max(0, i - 1)]);
        const next = new Vector3().fromArray(traj[Math.min(traj.length - 1, i + 1)]);
        const tangent = new Vector3().subVectors(next, prev).normalize();
        const bitangent = new Vector3().crossVectors(up, tangent).normalize();
        const widthBase = data.lineThickness === "thick" ? 0.28 : data.lineThickness === "thin" ? 0.12 : 0.18;
        const width = widthBase * (data.ribbonWidth ?? 1);
        const left = new Vector3().copy(current).addScaledVector(bitangent, -width);
        const right = new Vector3().copy(current).addScaledVector(bitangent, width);

        positions.push(left.x, left.y, left.z);
        positions.push(right.x, right.y, right.z);
        const normal = new Vector3().crossVectors(bitangent, tangent).normalize();
        normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
      }

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        indices.push(a, b, d, a, d, c);
      }

      const geometry = new BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({
        color: colorForTrajectory(idx, data.palette, data.customPalettes, data.paletteShift ?? 0),
        side: DoubleSide,
        roughness: 0.45,
        metalness: 0.05,
        emissiveIntensity: 0.3 * (data.emissiveBoost ?? 1),
      });
      const mesh = new Mesh(geometry, material);
      this.meshes.push(mesh);
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
    const widthScale = this.data.ribbonWidth ?? 1;
    this.meshes.forEach((mesh, idx) => {
      mesh.scale.setScalar(Math.max(0.5, Math.min(2.5, widthScale)));
      const mat = mesh.material as MeshStandardMaterial;
      mat.color = colorForTrajectory(
        idx,
        this.data!.palette,
        this.data!.customPalettes,
        this.data?.paletteShift ?? 0
      );
      mat.emissiveIntensity = 0.3 * (this.data.emissiveBoost ?? 1);
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    mesh.geometry.setDrawRange(start * 2, count * 2);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    }
    this.group = null;
    this.meshes = [];
  }
}
