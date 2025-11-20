import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Data3DTexture,
  DoubleSide,
  FloatType,
  Group,
  LinearFilter,
  Mesh,
  ShaderMaterial,
  RedFormat,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

const MAX_STEPS = 96;

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform sampler3D uDensity;
  uniform vec3 uBoundsMin;
  uniform vec3 uBoundsMax;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uDensityScale;
  uniform int uSteps;
  varying vec3 vWorldPosition;

  bool intersectBox(vec3 orig, vec3 dir, out float tmin, out float tmax) {
    vec3 invDir = 1.0 / dir;
    vec3 t0 = (uBoundsMin - orig) * invDir;
    vec3 t1 = (uBoundsMax - orig) * invDir;
    vec3 tsmaller = min(t0, t1);
    vec3 tbigger = max(t0, t1);
    tmin = max(max(tsmaller.x, tsmaller.y), max(tsmaller.z, 0.0));
    tmax = min(min(tbigger.x, tbigger.y), tbigger.z);
    return tmax >= tmin;
  }

  void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDir = normalize(vWorldPosition - cameraPosition);
    float tEnter;
    float tExit;
    if (!intersectBox(rayOrigin, rayDir, tEnter, tExit)) discard;

    float dt = (tExit - tEnter) / float(uSteps);
    vec3 p = rayOrigin + rayDir * tEnter;
    vec3 step = rayDir * dt;

    float alpha = 0.0;
    vec3 accum = vec3(0.0);

    for (int i = 0; i < ${MAX_STEPS}; i++) {
      if (i >= uSteps) break;
      vec3 local = (p - uBoundsMin) / (uBoundsMax - uBoundsMin);
      if (any(lessThan(local, vec3(0.0))) || any(greaterThan(local, vec3(1.0)))) {
        p += step;
        continue;
      }
      float density = texture(uDensity, local).r;
      float a = 1.0 - exp(-density * uDensityScale);
      vec3 col = mix(uColorA, uColorB, clamp(density * 1.3, 0.0, 1.0));
      accum += (1.0 - alpha) * col * a;
      alpha += (1.0 - alpha) * a;
      if (alpha > 0.97) break;
      p += step;
    }

    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(accum, alpha * 0.9);
  }
`;

export class VolumetricCloudRenderer implements RendererStrategy {
  readonly style = "volumetric-cloud" as const;
  private group: Group | null = null;
  private mesh: Mesh | null = null;
  private texture: Data3DTexture | null = null;
  private boundsMin = new Vector3(-10, -10, -10);
  private boundsMax = new Vector3(10, 10, 10);
  private sourceTrajectories: number[][][] = [];
  private drawWindows: { start: number; count: number }[] = [];
  private lastData: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    threeScene.add(this.group);
    this.lastData = data;
    this.sourceTrajectories = data.trajectories.map((t) => [...t]);
    this.drawWindows = data.trajectories.map((t) => ({ start: 0, count: t.length }));
    this.rebuildVolume(data);
  }

  private rebuildVolume(data: TrajectoryData) {
    if (!this.group) return;
    this.lastData = data;
    if (!this.sourceTrajectories.length) return;

    const resolution = 40;
    const field = new Float32Array(resolution * resolution * resolution);

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    this.sourceTrajectories.forEach((traj, idx) => {
      const window = this.drawWindows[idx];
      const start = window?.start ?? 0;
      const count = window?.count ?? traj.length;
      const end = Math.min(traj.length, start + count);
      for (let i = start; i < end; i++) {
        const [x, y, z] = traj[i];
        min.min(new Vector3(x, y, z));
        max.max(new Vector3(x, y, z));
      }
    });

    if (!isFinite(min.x) || !isFinite(max.x)) {
      min = new Vector3(-10, -10, -10);
      max = new Vector3(10, 10, 10);
    }

    const margin = 0.08;
    const size = new Vector3().subVectors(max, min).multiplyScalar(1 + margin).max(new Vector3(8, 8, 8));
    const centroid = new Vector3().addVectors(min, max).multiplyScalar(0.5);
    this.boundsMin = new Vector3().copy(centroid).sub(size.clone().multiplyScalar(0.5));
    this.boundsMax = new Vector3().copy(centroid).add(size.clone().multiplyScalar(0.5));
    const span = new Vector3().subVectors(this.boundsMax, this.boundsMin);

    this.sourceTrajectories.forEach((traj, idx) => {
      const window = this.drawWindows[idx];
      const start = window?.start ?? 0;
      const count = window?.count ?? traj.length;
      const end = Math.min(traj.length, start + count);
      for (let i = start; i < end; i++) {
        const [x, y, z] = traj[i];
        const nx = (x - this.boundsMin.x) / span.x;
        const ny = (y - this.boundsMin.y) / span.y;
        const nz = (z - this.boundsMin.z) / span.z;
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1 || nz < 0 || nz > 1) continue;
        const ix = Math.min(resolution - 1, Math.max(0, Math.floor(nx * resolution)));
        const iy = Math.min(resolution - 1, Math.max(0, Math.floor(ny * resolution)));
        const iz = Math.min(resolution - 1, Math.max(0, Math.floor(nz * resolution)));
        const idx1 = ix + iy * resolution + iz * resolution * resolution;
        field[idx1] += 1.0;
      }
    });

    // Smooth the density field with a single box blur pass
    const blurred = new Float32Array(field.length);
    const idxFor = (x: number, y: number, z: number) => x + y * resolution + z * resolution * resolution;
    for (let z = 0; z < resolution; z++) {
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          let acc = 0;
          let count = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;
                if (nx < 0 || ny < 0 || nz < 0 || nx >= resolution || ny >= resolution || nz >= resolution) continue;
                acc += field[idxFor(nx, ny, nz)];
                count++;
              }
            }
          }
          blurred[idxFor(x, y, z)] = acc / Math.max(1, count);
        }
      }
    }

    let maxDensity = 0;
    for (let i = 0; i < blurred.length; i++) {
      if (blurred[i] > maxDensity) maxDensity = blurred[i];
    }
    if (maxDensity === 0) {
      maxDensity = 1;
    }

    for (let i = 0; i < blurred.length; i++) {
      blurred[i] = Math.min(1, blurred[i] / maxDensity);
    }

    if (!this.texture) {
      this.texture = new Data3DTexture(blurred, resolution, resolution, resolution);
      this.texture.format = RedFormat;
      this.texture.type = FloatType;
      this.texture.minFilter = LinearFilter;
      this.texture.magFilter = LinearFilter;
      this.texture.unpackAlignment = 1;
    } else {
      this.texture.image.data = blurred;
      (this.texture as any).image.width = resolution;
      (this.texture as any).image.height = resolution;
      (this.texture as any).image.depth = resolution;
    }
    this.texture.needsUpdate = true;

    const colorA = colorForTrajectory(0, data.palette);
    const colorB = new Color(colorA).lerp(new Color(0.9, 0.95, 1.0), 0.25);

    if (!this.mesh) {
      const geom = new BoxGeometry(1, 1, 1);
      const mat = new ShaderMaterial({
        uniforms: {
          uDensity: { value: this.texture },
          uBoundsMin: { value: this.boundsMin },
          uBoundsMax: { value: this.boundsMax },
          uColorA: { value: colorA },
          uColorB: { value: colorB },
          uDensityScale: { value: data.background === "dark" ? 2.8 : 2.0 },
          uSteps: { value: Math.floor(resolution * 0.9) },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        vertexShader,
        fragmentShader,
      });
      this.mesh = new Mesh(geom, mat);
      this.mesh.scale.copy(span);
      this.mesh.position.copy(centroid);
      this.group.add(this.mesh);
    } else {
      const mat = this.mesh.material as ShaderMaterial;
      mat.uniforms.uDensity.value = this.texture;
      mat.uniforms.uBoundsMin.value = this.boundsMin;
      mat.uniforms.uBoundsMax.value = this.boundsMax;
      mat.uniforms.uColorA.value = colorA;
      mat.uniforms.uColorB.value = colorB;
      mat.uniforms.uDensityScale.value = data.background === "dark" ? 2.8 : 2.0;
      mat.uniforms.uSteps.value = Math.floor(resolution * 0.9);
      this.mesh.scale.copy(span);
      this.mesh.position.copy(centroid);
      mat.needsUpdate = true;
    }
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    if (!this.drawWindows[trajectoryIndex]) return;
    this.drawWindows[trajectoryIndex] = { start, count };
    if (this.lastData) {
      this.rebuildVolume(this.lastData);
    }
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      this.group.traverse((obj) => {
        if ((obj as Mesh).geometry) (obj as Mesh).geometry.dispose();
        if ((obj as Mesh).material && (obj as Mesh).material as any) {
          const mat = (obj as Mesh).material as ShaderMaterial;
          if (mat.dispose) mat.dispose();
        }
      });
      threeScene.remove(this.group);
    }
    this.mesh = null;
    this.texture = null;
    this.group = null;
    this.sourceTrajectories = [];
    this.drawWindows = [];
  }
}
