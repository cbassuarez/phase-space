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
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.points = [];
    this.data = data;
    threeScene.add(this.group);

    data.trajectories.forEach((traj, idx) => {
      const positions: number[] = [];
      for (let i = 0; i < traj.length; i += 3) {
        const [x, y, z] = traj[i];
        positions.push(x, y, z);
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const useAdditive = !(data.background === "light" || data.background === "custom2");
      const density = data.cloudDensity ?? 1;
      const mat = new PointsMaterial({
        size:
          (data.lineThickness === "thick" ? 0.2 : data.lineThickness === "thin" ? 0.1 : 0.15) * (0.7 + density * 0.6),
        sizeAttenuation: true,
        transparent: true,
        opacity: Math.max(0.15, 0.7 * (0.4 + density * 0.8)),
        depthWrite: false,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        color: colorForTrajectory(idx, data.palette, data.customPalette, data.paletteShift ?? 0),
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

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const density = this.data.cloudDensity ?? 1;
    const useAdditive = !(this.data.background === "light" || this.data.background === "custom2");

    this.points.forEach((cloud, idx) => {
      const mat = cloud.material as PointsMaterial;
      mat.color = colorForTrajectory(
        idx,
        this.data!.palette,
        this.data!.customPalette,
        this.data?.paletteShift ?? 0
      );
      mat.opacity = Math.max(0.15, 0.7 * (0.4 + density * 0.8));
      mat.size *= 1; // keep base size
      mat.size =
        (this.data.lineThickness === "thick" ? 0.2 : this.data.lineThickness === "thin" ? 0.1 : 0.15) *
        (0.7 + density * 0.6);
      mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
      mat.needsUpdate = true;
    });
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
