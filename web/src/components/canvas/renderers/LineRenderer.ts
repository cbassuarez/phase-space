import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  NormalBlending,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

/**
 * Thin polyline rendering of each trajectory. Wireframe-style — the
 * crispest possible read of the attractor's shape. Uses
 * LineBasicMaterial so it works in every browser without needing the
 * three.js extras bundle (Line2 would let us thicken beyond 1px but
 * costs extra deps).
 */
export class LineRenderer implements RendererStrategy {
  readonly style = "line" as const;
  private group: Group | null = null;
  private lines: Line[] = [];
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.lines = [];
    this.data = data;
    threeScene.add(this.group);

    const useAdditive = data.background !== "light";
    const opacity = data.background === "light" ? 0.9 : 0.85;

    data.trajectories.forEach((traj, idx) => {
      const positions = new Float32Array(traj.length * 3);
      for (let i = 0; i < traj.length; i++) {
        const p = traj[i];
        positions[i * 3] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const mat = new LineBasicMaterial({
        color: colorForTrajectory(idx, data.palette, data.customPalette, data.paletteShift ?? 0),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
      });
      const line = new Line(geom, mat);
      this.lines.push(line);
      this.group?.add(line);
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
    const opacity = this.data.background === "light" ? 0.9 : 0.85;

    this.lines.forEach((line, idx) => {
      const mat = line.material as LineBasicMaterial;
      mat.color = colorForTrajectory(
        idx,
        this.data!.palette,
        this.data!.customPalette,
        this.data?.paletteShift ?? 0
      );
      mat.opacity = opacity;
      mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const line = this.lines[trajectoryIndex];
    if (!line) return;
    line.geometry.setDrawRange(start, count);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const l = obj as Line;
        if (l.geometry) l.geometry.dispose();
        if (l.material) {
          const mat = l.material as LineBasicMaterial;
          mat.dispose();
        }
      });
    }
    this.group = null;
    this.lines = [];
  }
}
