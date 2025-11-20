import { Group, Line, LineBasicMaterial, BufferGeometry, BufferAttribute, Color, MeshBasicMaterial, Mesh, PlaneGeometry } from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

export class CrtScopeRenderer implements RendererStrategy {
  readonly style = "crt-scope" as const;
  private group: Group | null = null;
  private lines: Line[] = [];
  private data: TrajectoryData | null = null;
  private glowPlane: Mesh | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.lines = [];
    this.data = data;
    threeScene.add(this.group);

    const glowPlane = new Mesh(
      new PlaneGeometry(200, 200),
      new MeshBasicMaterial({
        color: new Color(data.background === "dark" ? 0x0f1018 : 0xf5f7ff),
        transparent: true,
        opacity: 0.92,
      })
    );
    glowPlane.position.z = -30;
    this.glowPlane = glowPlane;
    this.group.add(glowPlane);

    data.trajectories.forEach((traj, idx) => {
      const positions = new Float32Array(traj.length * 3);
      traj.forEach((p, i) => {
        positions[i * 3 + 0] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      });
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setDrawRange(0, positions.length / 3);
      const color = colorForTrajectory(idx, data.palette, data.paletteShift ?? 0);
      const material = new LineBasicMaterial({
        color,
        linewidth: 1,
        transparent: true,
        opacity: Math.max(0.1, 0.9 * (data.crtScanDepth ? 0.6 + data.crtScanDepth * 0.8 : 1)),
      });
      const line = new Line(geometry, material);
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
    const scanDepth = this.data.crtScanDepth ?? 0;
    this.lines.forEach((line, idx) => {
      const mat = line.material as LineBasicMaterial;
      mat.color = colorForTrajectory(idx, this.data!.palette, this.data?.paletteShift ?? 0);
      mat.opacity = Math.max(0.1, 0.9 * (0.6 + scanDepth * 0.8));
      mat.needsUpdate = true;
    });
    if (this.glowPlane) {
      const mat = this.glowPlane.material as MeshBasicMaterial;
      mat.opacity = Math.max(0.2, 0.92 * (0.6 + scanDepth * 0.8));
      mat.needsUpdate = true;
    }
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
        const line = obj as Line;
        if (line.geometry) line.geometry.dispose();
        const material = (line as any).material;
        if (material && typeof material.dispose === "function") {
          material.dispose();
        }
      });
    }
    this.group = null;
    this.lines = [];
  }
}
