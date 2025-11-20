import {
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class NeonFilamentsRenderer implements RendererStrategy {
  readonly style = "neon-filaments" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private context: RenderContext | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.context = { threeScene, camera: null as any, renderer: null as any };
    this.group = new Group();
    this.meshes = [];
    threeScene.add(this.group);

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map(([x, y, z]) => new Vector3(x, y, z));
      const curve = new CatmullRomCurve3(points);
      const tubularSegments = Math.max(64, traj.length);
      const radius = data.lineThickness === "thick" ? 0.12 : data.lineThickness === "thin" ? 0.04 : 0.07;
      const radialSegments = 8;
      const geom = new TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
      const color = colorForTrajectory(idx, data.palette);
      const mat = new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.2,
        roughness: 0.35,
        metalness: 0.05,
      });
      const mesh = new Mesh(geom, mat);
      this.meshes.push(mesh);
      this.group?.add(mesh);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    // Simple rebuild for now
    this.dispose(context);
    this.init(context, data);
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    mesh.geometry.setDrawRange(start, count);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      });
    }
    this.group = null;
    this.meshes = [];
    this.context = null;
  }
}
