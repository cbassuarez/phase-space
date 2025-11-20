import { Group, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute } from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class CellsRenderer implements RendererStrategy {
  readonly style = "cells" as const;
  private group: Group | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    threeScene.add(this.group);

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
        color: colorForTrajectory(idx, data.palette),
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
