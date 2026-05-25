import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { colorForTrajectory } from "./utils";
import { getLighting } from "../../../visual/lighting";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";

/**
 * Cells renderer — lit sphere-impostor version.
 *
 * Each cell is a tiny billboard quad whose fragment shader recovers
 * the hemisphere normal of a sphere from the corner coords:
 *
 *   n.xy = vCorner (the 2D position within the quad, -1..1)
 *   n.z  = sqrt(max(0, 1 - dot(n.xy, n.xy)))   (front-facing hemisphere)
 *
 * That gives every pixel a perceived 3D normal, so the cell catches
 * light like a real sphere — lit side, shadow side, terminator. The
 * normal is in view space (because the quad is camera-aligned via
 * the NDC-corner trick); we transform world-space key/fill dirs into
 * view space once on the CPU each frame and pass them as uniforms.
 *
 * Differences from the unlit version this replaces:
 *   - Corner offset still done in NDC for portability (no gl_PointSize).
 *   - Aging gradient still drives per-vertex color.
 *   - Falloff is gentler (k=3) because the lighting term now does
 *     most of the work of making each cell read as a unit.
 */

const cellsVertex = `
  attribute vec2  aCorner;
  attribute vec3  aColor;
  attribute float aSize;
  attribute float aT;
  varying vec2  vCorner;
  varying vec3  vColor;
  varying float vT;
  uniform vec2  uTexelToNdc;
  uniform float uHalfPx;

  void main() {
    vCorner = aCorner;
    vColor  = aColor;
    vT      = aT;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mv;
    clip.xy += aCorner * uTexelToNdc * (uHalfPx * aSize) * clip.w;
    gl_Position = clip;
  }
`;

const cellsFragment = `
  varying vec2  vCorner;
  varying vec3  vColor;
  varying float vT;
  uniform float uOpacity;
  uniform vec3  uKeyDirView;   // key light direction in VIEW space
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDirView;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;

  void main() {
    float d = dot(vCorner, vCorner);
    if (d > 1.0) discard;                 // outside the sphere disc
    // Recover the front-facing hemisphere normal in view space. The
    // quad is camera-aligned via NDC offsetting, so view-space normal
    // is exactly (vCorner.x, vCorner.y, +z).
    float nz = sqrt(max(0.0, 1.0 - d));
    vec3 n = vec3(vCorner.x, vCorner.y, nz);

    // Lambert key + half-Lambert fill.
    float key = max(0.0, dot(n, normalize(uKeyDirView)));
    float fill = dot(n, normalize(uFillDirView)) * 0.5 + 0.5;
    fill *= fill;

    vec3 lit =
        vColor * uKeyColor  * key  * uKeyI
      + vColor * uFillColor * fill * uFillI
      + vColor * uAmbient;

    // Soft disc edge so neighbouring cells blend rather than aliasing.
    float edge = smoothstep(1.0, 0.55, d);
    float alpha = edge * uOpacity;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(lit, alpha);
  }
`;

interface CellsUniforms {
  uTexelToNdc: { value: Vector2 };
  uHalfPx: { value: number };
  uOpacity: { value: number };
  uKeyDirView: { value: Vector3 };
  uKeyColor: { value: Color };
  uKeyI: { value: number };
  uFillDirView: { value: Vector3 };
  uFillColor: { value: Color };
  uFillI: { value: number };
  uAmbient: { value: Color };
}

function hash01(i: number): number {
  let x = (i + 1) >>> 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return (x >>> 0) / 0xffffffff;
}

function halfPxFor(data: TrajectoryData): number {
  if (data.lineThickness === "thick") return 10;
  if (data.lineThickness === "thin")  return 5;
  return 7;
}

const cornerOffsets: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [ 1, -1], [ 1,  1], [-1,  1],
];

// Reused scratch vectors for view-space light transform.
const _v = new Vector3();
const _w = new Vector3();

export class CellsRenderer implements RendererStrategy {
  readonly style = "cells" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private materials: ShaderMaterial[] = [];
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;
  private canvasSize = new Vector2(1, 1);

  init(context: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.data = data;
    this.context = context;
    context.threeScene.add(this.group);

    const drawSize = new Vector2();
    context.renderer.getDrawingBufferSize(drawSize);
    this.canvasSize.copy(drawSize);

    const halfPx = halfPxFor(data);
    const useAdditive = data.background !== "light";
    const lighting = getLighting();

    data.trajectories.forEach((traj, trajIdx) => {
      if (traj.length < 1) return;
      const N = traj.length;
      const positions = new Float32Array(N * 4 * 3);
      const corners   = new Float32Array(N * 4 * 2);
      const colors    = new Float32Array(N * 4 * 3);
      const sizes     = new Float32Array(N * 4);
      const tAttr     = new Float32Array(N * 4);
      const indices   = new Uint32Array(N * 6);

      const baseColor = colorForTrajectory(trajIdx, data.palette, data.customPalette, data.paletteShift ?? 0);
      const baseHSL = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(baseHSL);
      const tinted = new Color();

      let vi = 0;
      let ii = 0;
      for (let i = 0; i < traj.length; i++) {
        const p = traj[i];
        const rand = hash01(trajIdx * 9281 + i);
        const sizeJitter = 0.75 + rand * 0.5;
        const t = i / Math.max(1, traj.length - 1);

        const lightness = baseHSL.l - t * 0.18;
        const saturation = baseHSL.s * (1 - t * 0.35);
        tinted.setHSL(baseHSL.h, Math.max(0, saturation), Math.max(0, lightness));

        const baseVert = vi;
        for (let c = 0; c < 4; c++) {
          positions[vi * 3 + 0] = p[0];
          positions[vi * 3 + 1] = p[1];
          positions[vi * 3 + 2] = p[2];
          corners[vi * 2 + 0] = cornerOffsets[c][0];
          corners[vi * 2 + 1] = cornerOffsets[c][1];
          colors[vi * 3 + 0] = tinted.r;
          colors[vi * 3 + 1] = tinted.g;
          colors[vi * 3 + 2] = tinted.b;
          sizes[vi] = sizeJitter;
          tAttr[vi] = t;
          vi++;
        }
        indices[ii++] = baseVert + 0;
        indices[ii++] = baseVert + 1;
        indices[ii++] = baseVert + 2;
        indices[ii++] = baseVert + 0;
        indices[ii++] = baseVert + 2;
        indices[ii++] = baseVert + 3;
      }

      const geometry = new BufferGeometry();
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("aCorner",  new BufferAttribute(corners, 2));
      geometry.setAttribute("aColor",   new BufferAttribute(colors, 3));
      geometry.setAttribute("aSize",    new BufferAttribute(sizes, 1));
      geometry.setAttribute("aT",       new BufferAttribute(tAttr, 1));
      geometry.computeBoundingSphere();

      const uniforms: CellsUniforms = {
        uTexelToNdc: { value: new Vector2(2 / this.canvasSize.x, 2 / this.canvasSize.y) },
        uHalfPx: { value: halfPx },
        uOpacity: { value: useAdditive ? 0.9 : 0.85 },
        uKeyDirView: { value: new Vector3().fromArray(lighting.keyDir) },
        uKeyColor:   { value: new Color().fromArray(lighting.keyColor) },
        uKeyI:       { value: lighting.keyIntensity },
        uFillDirView:{ value: new Vector3().fromArray(lighting.fillDir) },
        uFillColor:  { value: new Color().fromArray(lighting.fillColor) },
        uFillI:      { value: lighting.fillIntensity },
        uAmbient:    { value: new Color().fromArray(lighting.ambient) },
      };
      const material = new ShaderMaterial({
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        vertexShader: cellsVertex,
        fragmentShader: cellsFragment,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: useAdditive ? AdditiveBlending : NormalBlending,
        toneMapped: false,
      });

      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.materials.push(material);
      this.group?.add(mesh);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  /**
   * Transform a world-space direction into view space and write the
   * result into the given Vector3. Caller passes the camera; we
   * extract the upper-3x3 of the view matrix (the rotation) and
   * apply it to the world direction. No translation: directions
   * don't translate.
   */
  private worldDirToView(camera: RenderContext["camera"], worldDir: ArrayLike<number>, out: Vector3) {
    // camera.matrixWorldInverse is the view matrix.
    _v.fromArray(worldDir);
    out.copy(_v).transformDirection(camera.matrixWorldInverse);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data || !this.context) return;
    this.data = { ...this.data, ...data };
    const useAdditive = this.data.background !== "light";
    const paletteShift = this.data.paletteShift ?? 0;
    const halfPx = halfPxFor(this.data);
    const lighting = getLighting();

    this.worldDirToView(this.context.camera, lighting.keyDir, _v);
    this.worldDirToView(this.context.camera, lighting.fillDir, _w);

    this.materials.forEach((mat, trajIdx) => {
      const u = mat.uniforms as unknown as CellsUniforms;
      u.uOpacity.value = useAdditive ? 0.9 : 0.85;
      u.uHalfPx.value = halfPx;
      u.uKeyDirView.value.copy(_v);
      u.uKeyColor.value.fromArray(lighting.keyColor);
      u.uKeyI.value = lighting.keyIntensity;
      u.uFillDirView.value.copy(_w);
      u.uFillColor.value.fromArray(lighting.fillColor);
      u.uFillI.value = lighting.fillIntensity;
      u.uAmbient.value.fromArray(lighting.ambient);
      if (mat.blending !== (useAdditive ? AdditiveBlending : NormalBlending)) {
        mat.blending = useAdditive ? AdditiveBlending : NormalBlending;
        mat.needsUpdate = true;
      }

      // Re-tint per-vertex aColor when palette shifts.
      const mesh = this.meshes[trajIdx];
      if (!mesh) return;
      const colorAttr = mesh.geometry.getAttribute("aColor") as BufferAttribute;
      const tAttr = mesh.geometry.getAttribute("aT") as BufferAttribute;
      if (!colorAttr || !tAttr) return;
      const baseColor = colorForTrajectory(trajIdx, this.data!.palette, this.data!.customPalette, paletteShift);
      const baseHSL = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(baseHSL);
      const tinted = new Color();
      for (let v = 0; v < colorAttr.count; v += 4) {
        const tNorm = tAttr.getX(v);
        const lightness = baseHSL.l - tNorm * 0.18;
        const saturation = baseHSL.s * (1 - tNorm * 0.35);
        tinted.setHSL(baseHSL.h, Math.max(0, saturation), Math.max(0, lightness));
        for (let c = 0; c < 4; c++) {
          colorAttr.setXYZ(v + c, tinted.r, tinted.g, tinted.b);
        }
      }
      colorAttr.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const mesh = this.meshes[trajectoryIndex];
    if (!mesh) return;
    mesh.geometry.setDrawRange(start * 6, count * 6);
  }

  dispose({ threeScene }: RenderContext) {
    if (this.group) {
      threeScene.remove(this.group);
      this.group.traverse((obj) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else if (m.material) (m.material as ShaderMaterial).dispose();
      });
    }
    this.group = null;
    this.meshes = [];
    this.materials = [];
    this.data = null;
    this.context = null;
  }
}
