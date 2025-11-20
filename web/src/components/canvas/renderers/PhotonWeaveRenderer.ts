import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points, ShaderMaterial, Vector3 } from "three";
import type { FilamentDensity } from "../../../types";
import type { RenderQuality } from "../../../visual/renderQuality";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { colorForTrajectory } from "./utils";

const vert = `
  attribute float t;
  attribute vec3 offset;
  attribute float strand;
  attribute vec3 color;
  uniform float uTrailPower;
  uniform float uTime;
  uniform float uShimmer;
  uniform float uPointSize;
  varying float vT;
  varying vec3 vColor;
  void main() {
    vT = t;
    vColor = color;
    vec3 displaced = position + offset;
    float trail = pow(1.0 - vT, max(0.25, uTrailPower));
    float flicker = mix(1.0, 1.0 + 0.15 * sin(uTime * 0.8 + vT * 12.0 + strand * 1.7), step(0.5, uShimmer));
    float size = uPointSize * mix(0.8, 1.3, trail) * flicker;
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const frag = `
  uniform float uBrightness;
  uniform float uTrailPower;
  uniform float uTime;
  uniform float uShimmer;
  uniform float uPointSize;
  varying float vT;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    float falloff = exp(-d * 18.0);
    float trail = pow(1.0 - vT, max(0.35, uTrailPower));
    float shimmer = mix(1.0, 1.0 + 0.14 * sin(uTime * 0.6 + vT * 10.0), step(0.5, uShimmer));
    vec3 color = vColor * uBrightness * shimmer * (0.55 + 0.45 * trail);
    gl_FragColor = vec4(color * falloff, falloff * trail);
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
  private points: Points[] = [];
  private sampleCounts: number[] = [];
  private sourceCounts: number[] = [];
  private material: ShaderMaterial | null = null;
  private data: TrajectoryData | null = null;
  private pointSize = 6;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.points = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.data = data;

    const quality = data.quality;
    const density = data.photonWeave?.filamentDensity ?? "medium";
    const step = densityStep(density, quality ?? { filamentSampleStep: 2, filamentTrajectoryFraction: 0.9, causticsPointStep: 2, causticsTextureSize: 512 });
    const strands = density === "high" ? 3 : density === "low" ? 1 : 2;
    const basePointSize = Math.max(4.5, 7 - step * 0.8);
    this.pointSize = basePointSize;
    const sharedUniforms = {
      uBrightness: { value: data.photonWeave?.brightness ?? 1 },
      uTrailPower: { value: data.photonWeave?.trailLength ?? 1 },
      uTime: { value: 0 },
      uShimmer: { value: data.photonWeave?.shimmer ? 1 : 0 },
      uPointSize: { value: basePointSize },
    };

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const maxPoints = Math.max(8, Math.floor(traj.length * (quality?.filamentTrajectoryFraction ?? 1)));
      const positions: number[] = [];
      const colors: number[] = [];
      const tAttr: number[] = [];
      const offsets: number[] = [];
      const strandAttr: number[] = [];

      for (let s = 0; s < strands; s++) {
        for (let i = 0; i < maxPoints; i += step) {
          const p = traj[i];
          if (!p) continue;
          const jitter = new Vector3(
            Math.sin(i * 0.13 + s * 1.7 + idx * 0.5),
            Math.cos(i * 0.11 + s * 2.3 + idx * 0.8),
            Math.sin(i * 0.07 + s * 1.1 + idx * 0.9)
          ).multiplyScalar(0.08 * (1.2 - 0.2 * s));
          positions.push(p[0] + jitter.x, p[1] + jitter.y, p[2] + jitter.z);
          offsets.push(jitter.x * 0.35, jitter.y * 0.35, jitter.z * 0.35);
          const t = Math.min(1, i / Math.max(1, maxPoints - 1));
          tAttr.push(t);
          strandAttr.push(s);
          const baseColor = colorForTrajectory(
            idx,
            data.palette,
            data.customPalette,
            data.paletteShift ?? 0
          );
          const mixColor = baseColor.clone().lerp(baseColor.clone().offsetHSL(0, 0, 0.14), 0.35 + 0.35 * (1 - t));
          colors.push(mixColor.r, mixColor.g, mixColor.b);
        }
      }

      if (positions.length < 6) return;

      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      geom.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
      geom.setAttribute("t", new BufferAttribute(new Float32Array(tAttr), 1));
      geom.setAttribute("offset", new BufferAttribute(new Float32Array(offsets), 3));
      geom.setAttribute("strand", new BufferAttribute(new Float32Array(strandAttr), 1));
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

      const pointCloud = new Points(geom, mat);
      this.points.push(pointCloud);
      this.sampleCounts[idx] = positions.length / 3;
      this.sourceCounts[idx] = traj.length;
      this.group?.add(pointCloud);
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
    this.points.forEach((pointCloud, idx) => {
      const colorAttr = pointCloud.geometry.getAttribute("color") as BufferAttribute;
      if (!colorAttr) return;
      const base = colorForTrajectory(idx, data.palette, data.customPalette, paletteShift);
      for (let i = 0; i < colorAttr.count; i++) {
        const t = i / Math.max(1, colorAttr.count - 1);
        const mix = base.clone().lerp(base.clone().offsetHSL(0, 0, 0.14), 0.35 + 0.35 * (1 - t));
        colorAttr.setXYZ(i, mix.r, mix.g, mix.b);
      }
      colorAttr.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const pointCloud = this.points[trajectoryIndex];
    if (!pointCloud) return;
    const samples = this.sampleCounts[trajectoryIndex] ?? 0;
    const sourceCount = this.sourceCounts[trajectoryIndex] ?? samples;
    const scale = sourceCount > 0 ? samples / sourceCount : 1;
    const mappedStart = Math.min(samples, Math.floor(start * scale));
    const mappedCount = Math.min(samples - mappedStart, Math.ceil(count * scale));
    pointCloud.geometry.setDrawRange(mappedStart, mappedCount);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const pts = obj as Points;
        if (pts.geometry) pts.geometry.dispose();
        const mat = pts.material as ShaderMaterial;
        if (mat) mat.dispose();
      });
    }
    this.group = null;
    this.points = [];
    this.sampleCounts = [];
    this.sourceCounts = [];
    this.material = null;
    this.data = null;
  }
}
