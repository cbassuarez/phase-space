import { Group, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute } from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class CellsRenderer implements RendererStrategy {
  readonly style = "cells" as const;
  private group: Group | null = null;
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.data = data;
    threeScene.add(this.group);

    const total = data.trajectories.length;
    data.trajectories.forEach((traj, idx) => {
      const positions = new Float32Array(traj.length * 3);
      traj.forEach((p, i) => {
        positions[i * 3 + 0] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      });
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const mat = new PointsMaterial({
        color: colorForTrajectory(idx, total, data.palette, data.customPalettes, data.paletteShift ?? 0),
        size: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      this.group?.add(new Points(geom, mat));
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const total = this.data.trajectories.length;
    this.group?.children.forEach((child, idx) => {
      const pts = child as Points;
      const mat = pts.material as PointsMaterial;
      if (mat && typeof (mat as any).color !== "undefined") {
        mat.color = colorForTrajectory(
          idx,
          total,
          this.data!.palette,
          this.data.customPalettes,
          this.data?.paletteShift ?? 0
        );
        mat.needsUpdate = true;
      }
    });
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const pts = obj as Points;
        if (pts.geometry) pts.geometry.dispose();
        if (pts.material) {
          const mat = pts.material as PointsMaterial;
          mat.dispose();
        }
      });
    }
    this.group = null;
  }
}
