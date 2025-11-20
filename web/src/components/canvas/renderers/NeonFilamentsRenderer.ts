import {
  AdditiveBlending,
  CatmullRomCurve3,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

const filamentVertexShader = `
  varying vec2 vUv;
  varying float vViewZ;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewZ = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const filamentFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFalloff;
  uniform float uDepthFade;
  varying vec2 vUv;
  varying float vViewZ;
  void main() {
    float ring = abs(vUv.y - 0.5) * 2.0;
    float core = exp(-ring * ring * uFalloff);
    float halo = smoothstep(1.0, 0.0, ring);
    float depthAtten = clamp(exp(-vViewZ * uDepthFade), 0.35, 1.0);
    vec3 base = uColor * (0.35 + core * uIntensity);
    vec3 glow = uColor * (0.45 + halo * 0.55);
    float alpha = clamp(core * 1.4, 0.0, 1.0) * depthAtten;
    gl_FragColor = vec4(base + glow * 0.6, alpha);
  }
`;

export class NeonFilamentsRenderer implements RendererStrategy {
  readonly style = "neon-filaments" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private haloMeshes: Mesh[] = [];
  private context: RenderContext | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.context = { threeScene, camera: null as any, renderer: null as any };
    this.group = new Group();
    this.meshes = [];
    this.haloMeshes = [];
    threeScene.add(this.group);

    const depthFade = data.background === "dark" ? 0.035 : 0.025;

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map(([x, y, z]) => new Vector3(x, y, z));
      const curve = new CatmullRomCurve3(points);
      const tubularSegments = Math.max(128, traj.length * 2);
      const baseRadius = data.lineThickness === "thick" ? 0.14 : data.lineThickness === "thin" ? 0.05 : 0.09;
      const radialSegments = 16;
      const coreGeom = new TubeGeometry(curve, tubularSegments, baseRadius, radialSegments, false);
      const haloGeom = new TubeGeometry(curve, tubularSegments, baseRadius * 1.6, radialSegments, false);
      const color = colorForTrajectory(idx, data.palette);

      const coreMaterial = new ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uIntensity: { value: 1.8 },
          uFalloff: { value: 7.0 },
          uDepthFade: { value: depthFade },
        },
        vertexShader: filamentVertexShader,
        fragmentShader: filamentFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });

      const haloMaterial = new ShaderMaterial({
        uniforms: {
          uColor: { value: color.clone().multiplyScalar(0.75) },
          uIntensity: { value: 1.2 },
          uFalloff: { value: 4.5 },
          uDepthFade: { value: depthFade * 0.6 },
        },
        vertexShader: filamentVertexShader,
        fragmentShader: filamentFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });

      const mesh = new Mesh(coreGeom, coreMaterial);
      const halo = new Mesh(haloGeom, haloMaterial);
      halo.renderOrder = -1;

      this.meshes.push(mesh);
      this.haloMeshes.push(halo);
      this.group?.add(halo);
      this.group?.add(mesh);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    const halo = this.haloMeshes[trajectoryIndex];
    if (!mesh || !halo) return;
    mesh.geometry.setDrawRange(start, count);
    halo.geometry.setDrawRange(start, count);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      });
    }
    this.group = null;
    this.meshes = [];
    this.haloMeshes = [];
    this.context = null;
  }
}
