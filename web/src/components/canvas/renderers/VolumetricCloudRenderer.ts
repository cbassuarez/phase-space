import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  NormalBlending,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class VolumetricCloudRenderer implements RendererStrategy {
  readonly style = "volumetric-cloud" as const;
  private group: Group | null = null;
  private points: Points[] = [];

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.points = [];
    threeScene.add(this.group);

    data.trajectories.forEach((traj, idx) => {
      const positions: number[] = [];
      for (let i = 0; i < traj.length; i += 3) {
        const [x, y, z] = traj[i];
        positions.push(x, y, z);
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const useAdditive = data.background !== "light";
      const mat = new PointsMaterial({
        size: data.lineThickness === "thick" ? 0.2 : data.lineThickness === "thin" ? 0.1 : 0.15,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        color: colorForTrajectory(idx, data.palette),
      });
      const cloud = new Points(geom, mat);
      this.points.push(cloud);
      this.group?.add(cloud);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const pts = this.points[trajectoryIndex];
    if (!pts) return;
    pts.geometry.setDrawRange(start, count);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const p = obj as Points;
        if (p.geometry) p.geometry.dispose();
        if (p.material) {
          const mat = p.material as PointsMaterial;
          mat.dispose();
        }
      });
    }
    this.group = null;
    this.points = [];
  }
}
