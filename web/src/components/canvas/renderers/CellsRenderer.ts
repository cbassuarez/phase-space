import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  Points,
  PointsMaterial,
} from "three";
import { buildVertexColorArray } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

function cellScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  const specific = data.cellSizeScale ?? 1;
  return Math.max(0.35, Math.min(3.4, specific * (1 + energy * 1.2 + pulse * 1.45)));
}

function pointOpacity(data: TrajectoryData, density: number): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.16, Math.min(1, 0.75 * (0.35 + density * 0.72 + energy * 0.25 + pulse * 0.2)));
}

/**
 * Soft point-sprite cells. Slightly larger and softer than the
 * previous shader-impostor cells — reads as a stippled / particle
 * cloud rather than discrete spheres.
 */
export class CellsRenderer implements RendererStrategy {
  readonly style = "cells" as const;
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
      for (let i = 0; i < traj.length; i++) {
        const [x, y, z] = traj[i];
        positions.push(x, y, z);
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geom.setAttribute(
        "color",
        new Float32BufferAttribute(
          buildVertexColorArray(
            idx,
            traj.length,
            data.dynamics,
            data.palette,
            data.customPalette,
            data.paletteShift ?? 0
          ),
          3
        )
      );
      const useAdditive = data.background !== "light";
      const density = data.cloudDensity ?? 1;
      const size =
        (data.lineThickness === "thick" ? 0.26 : data.lineThickness === "thin" ? 0.14 : 0.2) *
        (0.7 + density * 0.6) *
        cellScale(data);
      const mat = new PointsMaterial({
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity: pointOpacity(data, density),
        depthWrite: false,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        vertexColors: true,
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
    const useAdditive = this.data.background !== "light";

    this.points.forEach((cloud, idx) => {
      const mat = cloud.material as PointsMaterial;
      const pointCount = this.data!.trajectories[idx]?.length ?? 0;
      cloud.geometry.setAttribute(
        "color",
        new Float32BufferAttribute(
          buildVertexColorArray(
            idx,
            pointCount,
            this.data!.dynamics,
            this.data!.palette,
            this.data!.customPalette,
            this.data?.paletteShift ?? 0
          ),
          3
        )
      );
      mat.size =
        (this.data.lineThickness === "thick" ? 0.26 : this.data.lineThickness === "thin" ? 0.14 : 0.2) *
        (0.7 + density * 0.6) *
        cellScale(this.data);
      mat.opacity = pointOpacity(this.data, density);
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
