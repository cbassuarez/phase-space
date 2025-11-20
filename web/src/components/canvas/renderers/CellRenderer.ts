import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { colorForTrajectory } from "./utils";

const vertexShader = `
  uniform float uSize;
  varying float vDepth;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (240.0 / max(24.0, -mvPosition.z));
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vDepth;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float core = exp(-d * 4.5);
    float rim = smoothstep(0.8, 0.2, d);
    float halo = smoothstep(1.2, 0.2, d);
    float depthDim = clamp(exp(-vDepth * 0.06), 0.35, 1.0);
    vec3 base = uColor * (0.55 + 0.45 * rim);
    vec3 glow = uColor * (1.2 * core + 0.18 * halo);
    float alpha = clamp(core * 1.2 + rim * 0.35, 0.0, 1.0) * depthDim;
    gl_FragColor = vec4(base + glow * 0.6, alpha);
  }
`;

export class CellRenderer implements RendererStrategy {
  readonly style = "cells" as const;
  private group: Group | null = null;
  private points: Points[] = [];

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.points = [];
    threeScene.add(this.group);

    const size = data.lineThickness === "thick" ? 34 : data.lineThickness === "thin" ? 22 : 28;

    data.trajectories.forEach((traj, idx) => {
      if (!traj.length) return;
      const positions = new Float32Array(traj.length * 3);
      traj.forEach((p, i) => {
        positions[i * 3 + 0] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      });
      const geom = new BufferGeometry();
      geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geom.setDrawRange(0, traj.length);
      const color = colorForTrajectory(idx, data.palette);
      const mat = new ShaderMaterial({
        uniforms: {
          uColor: { value: new Vector3(color.r, color.g, color.b) },
          uSize: { value: size },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const pts = new Points(geom, mat);
      this.points.push(pts);
      this.group?.add(pts);
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
        const pts = obj as Points;
        if (pts.geometry) pts.geometry.dispose();
        if (pts.material && "dispose" in pts.material) {
          (pts.material as ShaderMaterial).dispose();
        }
      });
    }
    this.group = null;
    this.points = [];
  }
}
