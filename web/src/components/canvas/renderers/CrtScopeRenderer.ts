import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

const overlayVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const overlayFragment = `
  varying vec2 vUv;
  void main() {
    float scan = 0.8 + 0.2 * sin(vUv.y * 720.0);
    float vignette = smoothstep(1.1, 0.3, length((vUv - 0.5) * 1.4));
    float mask = scan * vignette;
    float grunge = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 tint = vec3(0.35, 1.0, 0.45);
    float alpha = 0.18 + grunge * 0.05;
    gl_FragColor = vec4(tint * mask, alpha * mask);
  }
`;

export class CrtScopeRenderer implements RendererStrategy {
  readonly style = "crt-scope" as const;
  private group: Group | null = null;
  private lines: Line[] = [];
  private overlay: Mesh | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.lines = [];
    threeScene.add(this.group);

    const glowPlane = new Mesh(
      new PlaneGeometry(240, 240),
      new MeshBasicMaterial({
        color: new Color(data.background === "dark" ? 0x0c120f : 0xf5f9f2),
        transparent: true,
        opacity: 0.9,
      })
    );
    glowPlane.position.z = -35;
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
      const color = colorForTrajectory(idx, data.palette);
      const material = new LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
      });
      const line = new Line(geometry, material);
      line.renderOrder = 2;
      this.lines.push(line);
      this.group?.add(line);
    });

    const quad = new BufferGeometry();
    quad.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    quad.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const overlayMat = new ShaderMaterial({
      vertexShader: overlayVertex,
      fragmentShader: overlayFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.overlay = new Mesh(quad, overlayMat);
    this.overlay.frustumCulled = false;
    this.overlay.renderOrder = 10;
    threeScene.add(this.overlay);
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
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
    if (this.overlay) {
      threeScene.remove(this.overlay);
      if (this.overlay.geometry) this.overlay.geometry.dispose();
      if (this.overlay.material) (this.overlay.material as ShaderMaterial).dispose();
    }
    this.group = null;
    this.lines = [];
    this.overlay = null;
  }
}
