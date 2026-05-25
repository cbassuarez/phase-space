import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

/**
 * Ribbon renderer — "continuous band draped along the trajectory".
 *
 * Why this is a rewrite, not a tweak of the previous version:
 *
 *   1. Frame stability. The old code built the side-vector as
 *      `cross(worldUp, tangent)`. When the trajectory tangent is
 *      anywhere near (0,1,0) — extremely common on Lorenz lobe
 *      transitions — that cross product collapses toward zero and the
 *      ribbon either snaps 180° or degenerates to a line. Here we
 *      compute a parallel-transport (Bishop) frame: pick a normal at
 *      the start, then rotate it incrementally to track each tangent
 *      change. No singularities, no flips, smooth twist behaviour.
 *
 *   2. Materials. The old code used MeshStandardMaterial with
 *      `emissiveIntensity` but never set an `emissive` color, so that
 *      uniform did nothing. Standard-mat also requires scene lights
 *      to look like anything. We use a custom unlit ShaderMaterial
 *      that fakes form from the view-space normal (rim/facing term),
 *      so the ribbon reads as a 3D band regardless of what lights the
 *      host scene happens to have.
 *
 *   3. Aging gradient. Vertex attribute `t` runs 0→1 along the
 *      trajectory; the fragment shader uses it to dim the tail. This
 *      is what gives the band motion read even when it's static.
 */

const ribbonVertex = `
  attribute float t;
  varying vec3 vNormal;
  varying float vT;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vT = t;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ribbonFragment = `
  varying vec3 vNormal;
  varying float vT;
  uniform vec3 uColor;
  uniform float uEmissive;
  uniform float uHeadBoost;

  void main() {
    // View-space facing term — surfaces pointing toward the camera
    // (|n.z| ~ 1) read brighter than edge-on ones. Cheap fake shading
    // that survives without any scene lights.
    float facing = abs(vNormal.z);
    float shade  = mix(0.45, 1.0, facing);

    // Head/tail gradient. uHeadBoost lets the modulation engine push
    // the head brighter without recomputing geometry.
    float age = mix(0.55, 1.0, vT);

    vec3 col = uColor * shade * age * (1.0 + uEmissive * 0.35);
    // Subtle warm tint on the bright facing edge — gives the band an
    // iridescent read instead of flat-colored vinyl.
    col += pow(facing, 6.0) * uColor * 0.25;

    // Edge-fade for tail so trails dissolve instead of stopping.
    float alpha = mix(0.55, 1.0, vT * vT);
    gl_FragColor = vec4(col * uHeadBoost, alpha);
  }
`;

interface RibbonMaterialUniforms {
  uColor: { value: Color };
  uEmissive: { value: number };
  uHeadBoost: { value: number };
}

function ribbonWidthFor(data: TrajectoryData): number {
  const base =
    data.lineThickness === "thick"
      ? 0.28
      : data.lineThickness === "thin"
      ? 0.12
      : 0.18;
  return base * (data.ribbonWidth ?? 1);
}

/**
 * Build a parallel-transport (Bishop) frame along the curve.
 *
 * Returns per-vertex normals (the width direction of the ribbon).
 * Unlike a Frenet frame this doesn't twist at inflection points,
 * and unlike `cross(up, tangent)` it doesn't degenerate when the
 * tangent aligns with world-up.
 */
function buildFrames(points: Vector3[]): { normals: Vector3[]; tangents: Vector3[] } {
  const n = points.length;
  const tangents: Vector3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    tangents[i] = new Vector3().subVectors(next, prev).normalize();
    if (!isFinite(tangents[i].x)) tangents[i].set(1, 0, 0);
  }

  // Pick an initial normal orthogonal to T[0]. Prefer the axis least
  // aligned with the tangent so the cross product is well-conditioned.
  const t0 = tangents[0];
  const ax = Math.abs(t0.x);
  const ay = Math.abs(t0.y);
  const az = Math.abs(t0.z);
  const seed =
    ax <= ay && ax <= az
      ? new Vector3(1, 0, 0)
      : ay <= az
      ? new Vector3(0, 1, 0)
      : new Vector3(0, 0, 1);
  const n0 = new Vector3().crossVectors(t0, seed).normalize();
  if (!isFinite(n0.x) || n0.lengthSq() < 1e-8) n0.set(0, 1, 0);

  const normals: Vector3[] = new Array(n);
  normals[0] = n0;

  const axis = new Vector3();
  for (let i = 1; i < n; i++) {
    const tPrev = tangents[i - 1];
    const tCurr = tangents[i];
    axis.crossVectors(tPrev, tCurr);
    const sinTheta = axis.length();
    const cosTheta = Math.max(-1, Math.min(1, tPrev.dot(tCurr)));

    if (sinTheta < 1e-6) {
      // Tangent unchanged — carry the normal forward unrotated.
      normals[i] = normals[i - 1].clone();
      continue;
    }
    axis.divideScalar(sinTheta); // normalize
    const theta = Math.atan2(sinTheta, cosTheta);
    // Rodrigues' rotation: rotate previous normal around `axis` by theta.
    const nPrev = normals[i - 1];
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const dot = axis.dot(nPrev);
    const rotated = new Vector3()
      .copy(nPrev).multiplyScalar(cos)
      .addScaledVector(new Vector3().crossVectors(axis, nPrev), sin)
      .addScaledVector(axis, dot * (1 - cos));
    // Re-orthogonalize against the new tangent to prevent slow drift.
    rotated.addScaledVector(tCurr, -rotated.dot(tCurr)).normalize();
    if (!isFinite(rotated.x)) rotated.copy(nPrev);
    normals[i] = rotated;
  }

  return { normals, tangents };
}

export class RibbonRenderer implements RendererStrategy {
  readonly style = "ribbon" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private materials: ShaderMaterial[] = [];
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.data = data;
    threeScene.add(this.group);

    const widthBase = ribbonWidthFor(data);

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;

      const points = traj.map((p) => new Vector3(p[0], p[1], p[2]));
      const { normals, tangents } = buildFrames(points);

      const positions = new Float32Array(traj.length * 6); // 2 verts/ring * 3
      const vertNormals = new Float32Array(traj.length * 6);
      const tAttr = new Float32Array(traj.length * 2);

      for (let i = 0; i < traj.length; i++) {
        const p = points[i];
        const n = normals[i];
        const t = tangents[i];
        // Surface normal = bishop normal × tangent — points "out of the band".
        const surface = new Vector3().crossVectors(t, n).normalize();

        const lx = p.x - n.x * widthBase;
        const ly = p.y - n.y * widthBase;
        const lz = p.z - n.z * widthBase;
        const rx = p.x + n.x * widthBase;
        const ry = p.y + n.y * widthBase;
        const rz = p.z + n.z * widthBase;

        positions[i * 6 + 0] = lx;
        positions[i * 6 + 1] = ly;
        positions[i * 6 + 2] = lz;
        positions[i * 6 + 3] = rx;
        positions[i * 6 + 4] = ry;
        positions[i * 6 + 5] = rz;

        vertNormals[i * 6 + 0] = surface.x;
        vertNormals[i * 6 + 1] = surface.y;
        vertNormals[i * 6 + 2] = surface.z;
        vertNormals[i * 6 + 3] = surface.x;
        vertNormals[i * 6 + 4] = surface.y;
        vertNormals[i * 6 + 5] = surface.z;

        const tNorm = traj.length > 1 ? i / (traj.length - 1) : 0;
        tAttr[i * 2 + 0] = tNorm;
        tAttr[i * 2 + 1] = tNorm;
      }

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        indices.push(a, b, d, a, d, c);
      }

      const geometry = new BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new BufferAttribute(vertNormals, 3));
      geometry.setAttribute("t", new BufferAttribute(tAttr, 1));

      const color = colorForTrajectory(
        idx,
        data.palette,
        data.customPalette,
        data.paletteShift ?? 0
      );
      const uniforms: RibbonMaterialUniforms = {
        uColor: { value: color.clone() },
        uEmissive: { value: data.emissiveBoost ?? 0 },
        uHeadBoost: { value: 1 },
      };
      const material = new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader: ribbonVertex,
        fragmentShader: ribbonFragment,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new Mesh(geometry, material);
      this.meshes.push(mesh);
      this.materials.push(material);
      this.group?.add(mesh);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    // Anything that changes geometry (width, palette indexing, line
    // thickness, trajectories themselves) is structural — rebuild.
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };

    const widthScale = this.data.ribbonWidth ?? 1;
    const emissive = this.data.emissiveBoost ?? 0;

    this.meshes.forEach((mesh, idx) => {
      mesh.scale.setScalar(Math.max(0.4, Math.min(2.5, widthScale)));
      const mat = this.materials[idx];
      if (!mat) return;
      const u = mat.uniforms as unknown as RibbonMaterialUniforms;
      const baseColor = colorForTrajectory(
        idx,
        this.data!.palette,
        this.data!.customPalette,
        this.data?.paletteShift ?? 0
      );
      u.uColor.value.copy(baseColor);
      u.uEmissive.value = emissive;
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    // Two vertices per trajectory sample, six indices per quad.
    // setDrawRange on an indexed geometry counts indices.
    const indexStart = start * 6;
    const indexCount = Math.max(0, count - 1) * 6;
    mesh.geometry.setDrawRange(indexStart, indexCount);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    }
    this.group = null;
    this.meshes = [];
    this.materials = [];
    this.data = null;
  }
}
