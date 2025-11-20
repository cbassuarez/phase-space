import {
  AdditiveBlending,
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  Line,
  LineBasicMaterial,
  NormalBlending,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class NeonFilamentsRenderer implements RendererStrategy {
  readonly style = "neon-filaments" as const;
  private group: Group | null = null;
  private lines: Line[] = [];
  private sampleCounts: number[] = [];
  private sourceCounts: number[] = [];
  private context: RenderContext | null = null;
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.context = { threeScene, camera: null as any, renderer: null as any };
    this.group = new Group();
    this.lines = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.data = data;
    threeScene.add(this.group);

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map(([x, y, z]) => new Vector3(x, y, z));
      const curve = new CatmullRomCurve3(points);
      const sampleCount = Math.max(traj.length * 2, 240);
      const sampled = curve.getSpacedPoints(sampleCount);
      const geom = new BufferGeometry();
      geom.setFromPoints(sampled);
      geom.setDrawRange(0, sampled.length);

      const color = colorForTrajectory(idx, data.palette, data.paletteShift ?? 0);
      const densityGlow = Math.min(2.2, 1 + traj.length / 2600);
      const useAdditive = data.background !== "light";
      const neonBoost = data.neonEmissive ?? 1;
      const mat = new LineBasicMaterial({
        color: color.clone().multiplyScalar((useAdditive ? densityGlow : 1) * (0.6 + neonBoost * 0.7)),
        transparent: true,
        opacity: Math.min(1.2, (useAdditive ? 0.95 : 1) * (0.5 + neonBoost * 0.6)),
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const line = new Line(geom, mat);
      this.lines.push(line);
      this.sampleCounts[idx] = sampled.length;
      this.sourceCounts[idx] = traj.length;
      this.group?.add(line);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    // Simple rebuild for now
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const paletteShift = this.data.paletteShift ?? 0;
    const neonBoost = this.data.neonEmissive ?? 1;
    const useAdditive = this.data.background !== "light";

    this.lines.forEach((line, idx) => {
      const mat = line.material as LineBasicMaterial;
      const color = colorForTrajectory(idx, this.data!.palette, paletteShift);
      mat.color.copy(color).multiplyScalar((useAdditive ? 1.0 : 0.95) * (0.6 + neonBoost * 0.7));
      mat.opacity = Math.min(1.2, (useAdditive ? 0.95 : 1) * (0.5 + neonBoost * 0.6));
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const line = this.lines[trajectoryIndex];
    if (!line) return;
    const samples = this.sampleCounts[trajectoryIndex] ?? 0;
    const sourceCount = this.sourceCounts[trajectoryIndex] ?? samples;
    const scale = sourceCount > 0 ? samples / sourceCount : 1;
    const mappedStart = Math.min(samples, Math.floor(start * scale));
    const mappedCount = Math.min(samples - mappedStart, Math.ceil(count * scale));
    line.geometry.setDrawRange(mappedStart, mappedCount);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const m = obj as Line;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as LineBasicMaterial).dispose();
      });
    }
    this.group = null;
    this.lines = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.context = null;
  }
}
