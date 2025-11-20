import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Line, ShaderMaterial } from "three";
import type { FilamentDensity } from "../../../types";
import type { RenderQuality } from "../../../visual/renderQuality";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { colorForTrajectory } from "./utils";

const vert = `
  attribute float t;
  varying float vT;
  varying vec3 vColor;
  void main() {
    vT = t;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = `
  uniform float uBrightness;
  uniform float uTrailPower;
  uniform float uTime;
  uniform float uShimmer;
  varying float vT;
  varying vec3 vColor;
  void main() {
    float trail = pow(1.0 - vT, max(0.35, uTrailPower));
    float shimmer = mix(1.0, 1.0 + 0.12 * sin(uTime * 0.6 + vT * 6.0), step(0.5, uShimmer));
    vec3 color = vColor * uBrightness * shimmer * (0.6 + 0.4 * trail);
    gl_FragColor = vec4(color, trail);
  }
`;

function densityStep(density: FilamentDensity, quality: RenderQuality): number {
  const base = Math.max(1, Math.round(quality.filamentSampleStep));
  if (density === "low") return Math.max(1, Math.round(base * 1.7));
  if (density === "high") return Math.max(1, Math.round(base * 0.75));
  return base;
}

export class PhotonWeaveRenderer implements RendererStrategy {
  readonly style = "photon-weave" as const;
  private group: Group | null = null;
  private lines: Line[] = [];
  private sampleCounts: number[] = [];
  private sourceCounts: number[] = [];
  private material: ShaderMaterial | null = null;
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.lines = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.data = data;

    const quality = data.quality;
    const density = data.photonWeave?.filamentDensity ?? "medium";
    const step = densityStep(density, quality ?? { filamentSampleStep: 2, filamentTrajectoryFraction: 0.9, causticsPointStep: 2, causticsTextureSize: 512 });
    const sharedUniforms = {
      uBrightness: { value: data.photonWeave?.brightness ?? 1 },
      uTrailPower: { value: data.photonWeave?.trailLength ?? 1 },
      uTime: { value: 0 },
      uShimmer: { value: data.photonWeave?.shimmer ? 1 : 0 },
    };

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const maxPoints = Math.max(8, Math.floor(traj.length * (quality?.filamentTrajectoryFraction ?? 1)));
      const positions: number[] = [];
      const colors: number[] = [];
      const tAttr: number[] = [];

      for (let i = 0; i < maxPoints; i += step) {
        const p = traj[i];
        if (!p) continue;
        positions.push(p[0], p[1], p[2]);
        const t = Math.min(1, i / Math.max(1, maxPoints - 1));
        tAttr.push(t);
        const baseColor = colorForTrajectory(idx, data.palette, data.paletteShift ?? 0);
        const mixColor = baseColor.clone().lerp(baseColor.clone().offsetHSL(0, 0, 0.12), 0.25 + 0.4 * (1 - t));
        colors.push(mixColor.r, mixColor.g, mixColor.b);
      }

      if (positions.length < 6) return;

      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      geom.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
      geom.setAttribute("t", new BufferAttribute(new Float32Array(tAttr), 1));
      geom.setDrawRange(0, positions.length / 3);

      const mat = new ShaderMaterial({
        uniforms: sharedUniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        vertexColors: true,
        toneMapped: false,
      });

      const line = new Line(geom, mat);
      this.lines.push(line);
      this.sampleCounts[idx] = positions.length / 3;
      this.sourceCounts[idx] = traj.length;
      this.group?.add(line);
      this.material = mat;
    });

    if (this.group) {
      threeScene.add(this.group);
    }
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    this.data = { ...this.data, ...data };
    const brightness = Math.max(0, data.photonWeave?.brightness ?? 1);
    const trail = data.photonWeave?.trailLength ?? 1;
    if (this.material) {
      this.material.uniforms.uBrightness.value = brightness;
      this.material.uniforms.uTrailPower.value = trail;
      this.material.uniforms.uShimmer.value = data.photonWeave?.shimmer ? 1 : 0;
      this.material.uniforms.uTime.value = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
      this.material.needsUpdate = true;
    }

    const paletteShift = data.paletteShift ?? 0;
    this.lines.forEach((line, idx) => {
      const colorAttr = line.geometry.getAttribute("color") as BufferAttribute;
      if (!colorAttr) return;
      const base = colorForTrajectory(idx, data.palette, paletteShift);
      for (let i = 0; i < colorAttr.count; i++) {
        const t = i / Math.max(1, colorAttr.count - 1);
        const mix = base.clone().lerp(base.clone().offsetHSL(0, 0, 0.12), 0.25 + 0.4 * (1 - t));
        colorAttr.setXYZ(i, mix.r, mix.g, mix.b);
      }
      colorAttr.needsUpdate = true;
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
        const line = obj as Line;
        if (line.geometry) line.geometry.dispose();
        const mat = line.material as ShaderMaterial;
        if (mat) mat.dispose();
      });
    }
    this.group = null;
    this.lines = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.material = null;
    this.data = null;
  }
}
