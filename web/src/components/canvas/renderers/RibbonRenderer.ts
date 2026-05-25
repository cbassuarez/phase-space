import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { buildPaletteTexture, dynamicScalarAt } from "./utils";
import { getLighting } from "../../../visual/lighting";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

/**
 * Ribbon renderer — lit version.
 *
 * Geometry is unchanged from the previous Bishop-frame rewrite. What
 * changed: the unlit shader is replaced with a Lambert + half-
 * Lambert-fill shader that samples the shared LightingConfig
 * singleton. The ribbon now visibly turns through the key light as
 * the camera orbits and the lit/shadow sides separate; tail still
 * dims via the per-vertex `t` aging gradient.
 *
 * Lighting in world space: we pass the world-space surface normal as
 * an attribute and dot it against the world-space key/fill directions
 * directly. Avoids the view-matrix gymnastics that the previous fake-
 * shading relied on, and means the light direction is read from the
 * tweaks without any per-renderer plumbing.
 */

const ribbonVertex = `
  attribute float t;
  attribute float colorT;
  attribute vec3 aNormal;     // world-space surface normal
  varying vec3  vNormal;
  varying float vT;
  varying float vColorT;
  void main() {
    vNormal = aNormal;
    vT = t;
    vColorT = colorT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ribbonFragment = `
  varying vec3 vNormal;
  varying float vT;
  varying float vColorT;
  uniform sampler2D uPalette;
  uniform float uPaletteShift;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDir;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;
  uniform float uEmissive;

  vec3 paletteSample(float t) {
    return texture2D(uPalette, vec2(fract(t), 0.5)).rgb;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 color = paletteSample(vColorT + uPaletteShift);

    // Lambert on key, but allow both sides of the ribbon to receive
    // light: |dot| because the ribbon has no "inside". This is what
    // most attractor ribbons want, otherwise half of every band is
    // pitch black.
    float key  = abs(dot(n, normalize(uKeyDir)));
    // Half-Lambert fill: (n.l*0.5 + 0.5)^2 — softer than full Lambert,
    // good as a sky-bounce term.
    float halfFill = dot(n, normalize(uFillDir)) * 0.5 + 0.5;
    float fill = halfFill * halfFill;

    vec3 lit =
        color * uKeyColor  * key  * uKeyI
      + color * uFillColor * fill * uFillI
      + color * uAmbient;

    // Tail aging dims the band; head stays at full lit value.
    float age = mix(0.55, 1.0, vT);
    vec3 col = lit * age * (1.0 + uEmissive * 0.3);

    float alpha = mix(0.6, 1.0, vT * vT);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface RibbonUniforms {
  uPalette: { value: DataTexture | null };
  uPaletteShift: { value: number };
  uEmissive: { value: number };
  uKeyDir: { value: Vector3 };
  uKeyColor: { value: Color };
  uKeyI: { value: number };
  uFillDir: { value: Vector3 };
  uFillColor: { value: Color };
  uFillI: { value: number };
  uAmbient: { value: Color };
}

function ribbonWidthFor(data: TrajectoryData): number {
  const base =
    data.lineThickness === "thick" ? 0.28
    : data.lineThickness === "thin" ? 0.12
    : 0.18;
  return base * (data.ribbonWidth ?? 1);
}

function reactiveRibbonScale(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.45, Math.min(2.8, 1 + energy * 0.65 + pulse * 0.45));
}

function reactiveRibbonGlow(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(
    0,
    Math.min(4, (data.emissiveBoost ?? 0) + (data.ribbonGlow ?? 0) + energy * 1.1 + pulse * 1.4)
  );
}

function buildFrames(points: Vector3[]): { normals: Vector3[]; tangents: Vector3[] } {
  const n = points.length;
  const tangents: Vector3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    tangents[i] = new Vector3().subVectors(next, prev).normalize();
    if (!isFinite(tangents[i].x)) tangents[i].set(1, 0, 0);
  }
  const t0 = tangents[0];
  const ax = Math.abs(t0.x), ay = Math.abs(t0.y), az = Math.abs(t0.z);
  const seed =
    ax <= ay && ax <= az ? new Vector3(1, 0, 0)
    : ay <= az            ? new Vector3(0, 1, 0)
    :                       new Vector3(0, 0, 1);
  const n0 = new Vector3().crossVectors(t0, seed).normalize();
  if (!isFinite(n0.x) || n0.lengthSq() < 1e-8) n0.set(0, 1, 0);
  const normals: Vector3[] = new Array(n);
  normals[0] = n0;
  const axis = new Vector3();
  for (let i = 1; i < n; i++) {
    const tPrev = tangents[i - 1];
    const tCurr = tangents[i];
    axis.crossVectors(tPrev, tCurr);
    const sinT = axis.length();
    const cosT = Math.max(-1, Math.min(1, tPrev.dot(tCurr)));
    if (sinT < 1e-6) {
      normals[i] = normals[i - 1].clone();
      continue;
    }
    axis.divideScalar(sinT);
    const theta = Math.atan2(sinT, cosT);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const nPrev = normals[i - 1];
    const dot = axis.dot(nPrev);
    const rotated = new Vector3()
      .copy(nPrev).multiplyScalar(c)
      .addScaledVector(new Vector3().crossVectors(axis, nPrev), s)
      .addScaledVector(axis, dot * (1 - c));
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
  private paletteTexture: DataTexture | null = null;
  private data: TrajectoryData | null = null;

  init({ threeScene }: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.data = data;
    this.paletteTexture = buildPaletteTexture(data.palette, data.customPalette);
    threeScene.add(this.group);

    const widthBase = ribbonWidthFor(data);
    const lighting = getLighting();

    data.trajectories.forEach((traj, idx) => {
      if (traj.length < 2) return;
      const points = traj.map((p) => new Vector3(p[0], p[1], p[2]));
      const { normals, tangents } = buildFrames(points);

      const positions = new Float32Array(traj.length * 6);
      const vertNormals = new Float32Array(traj.length * 6);
      const tAttr = new Float32Array(traj.length * 2);
      const colorAttr = new Float32Array(traj.length * 2);

      for (let i = 0; i < traj.length; i++) {
        const p = points[i];
        const n = normals[i];
        const t = tangents[i];
        const surface = new Vector3().crossVectors(t, n).normalize();

        positions[i * 6 + 0] = p.x - n.x * widthBase;
        positions[i * 6 + 1] = p.y - n.y * widthBase;
        positions[i * 6 + 2] = p.z - n.z * widthBase;
        positions[i * 6 + 3] = p.x + n.x * widthBase;
        positions[i * 6 + 4] = p.y + n.y * widthBase;
        positions[i * 6 + 5] = p.z + n.z * widthBase;

        vertNormals[i * 6 + 0] = surface.x;
        vertNormals[i * 6 + 1] = surface.y;
        vertNormals[i * 6 + 2] = surface.z;
        vertNormals[i * 6 + 3] = surface.x;
        vertNormals[i * 6 + 4] = surface.y;
        vertNormals[i * 6 + 5] = surface.z;

        const tNorm = traj.length > 1 ? i / (traj.length - 1) : 0;
        tAttr[i * 2 + 0] = tNorm;
        tAttr[i * 2 + 1] = tNorm;
        const colorT = dynamicScalarAt(data.dynamics, idx, i, tNorm);
        colorAttr[i * 2 + 0] = colorT;
        colorAttr[i * 2 + 1] = colorT;
      }

      const indices: number[] = [];
      for (let i = 0; i < traj.length - 1; i++) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        indices.push(a, b, d, a, d, c);
      }

      const geometry = new BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("aNormal", new BufferAttribute(vertNormals, 3));
      geometry.setAttribute("t", new BufferAttribute(tAttr, 1));
      geometry.setAttribute("colorT", new BufferAttribute(colorAttr, 1));

      const uniforms: RibbonUniforms = {
        uPalette: { value: this.paletteTexture },
        uPaletteShift: { value: data.paletteShift ?? 0 },
        uEmissive: { value: data.emissiveBoost ?? 0 },
        uKeyDir: { value: new Vector3().fromArray(lighting.keyDir) },
        uKeyColor: { value: new Color().fromArray(lighting.keyColor) },
        uKeyI: { value: lighting.keyIntensity },
        uFillDir: { value: new Vector3().fromArray(lighting.fillDir) },
        uFillColor: { value: new Color().fromArray(lighting.fillColor) },
        uFillI: { value: lighting.fillIntensity },
        uAmbient: { value: new Color().fromArray(lighting.ambient) },
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
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data) return;
    this.data = { ...this.data, ...data };
    const widthScale = this.data.ribbonWidth ?? 1;
    const emissive = reactiveRibbonGlow(this.data);
    const paletteShift = this.data.paletteShift ?? 0;
    const lighting = getLighting();

    this.meshes.forEach((mesh, idx) => {
      mesh.scale.setScalar(Math.max(0.4, Math.min(2.8, widthScale * reactiveRibbonScale(this.data!))));
      const mat = this.materials[idx];
      if (!mat) return;
      const u = mat.uniforms as unknown as RibbonUniforms;
      u.uPaletteShift.value = paletteShift;
      u.uEmissive.value = emissive;
      u.uKeyDir.value.fromArray(lighting.keyDir);
      u.uKeyColor.value.fromArray(lighting.keyColor);
      u.uKeyI.value = lighting.keyIntensity;
      u.uFillDir.value.fromArray(lighting.fillDir);
      u.uFillColor.value.fromArray(lighting.fillColor);
      u.uFillI.value = lighting.fillIntensity;
      u.uAmbient.value.fromArray(lighting.ambient);
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    mesh.geometry.setDrawRange(start * 6, Math.max(0, count - 1) * 6);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
    }
    this.group = null;
    this.meshes = [];
    this.materials = [];
    this.paletteTexture?.dispose();
    this.paletteTexture = null;
    this.data = null;
  }
}
