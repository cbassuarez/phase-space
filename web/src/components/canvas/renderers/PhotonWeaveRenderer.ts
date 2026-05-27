import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import type { FilamentDensity } from "../../../types";
import type { RenderQuality } from "../../../visual/renderQuality";
import { getLighting } from "../../../visual/lighting";
import type { RendererStrategy, RenderContext, TrajectoryData } from "./base";
import { buildPaletteTexture, dynamicScalarAt, writeVisualFieldVector } from "./utils";
import {
  applyLightingUniforms,
  applyMaterialUniforms,
  createLightingUniforms,
  createMaterialUniforms,
  materialShaderChunk,
  type LightingUniforms,
  type MaterialUniforms,
} from "./materials";

/**
 * Photon Weave renderer — lit with Kajiya-Kay shading.
 *
 * Strand geometry is the same braided quad-strip layout as the
 * previous version: 1–3 strands per trajectory, each offset from the
 * path by a sinusoidal modulation in the (normal, binormal) plane of
 * a Bishop frame, with a per-strand phase so they twist around each
 * other.
 *
 * What's new: each vertex carries the world-space strand tangent as
 * an attribute, and the fragment shader uses Kajiya-Kay to compute
 * an anisotropic diffuse + specular term:
 *
 *   sinTL = sqrt(1 - dot(T,L)^2)      // sine of angle, hair diffuse
 *   sinTH = sqrt(1 - dot(T,H)^2)      // hair specular highlight
 *
 * That's the right model for thin cylindrical strands: light wraps
 * around the perpendicular cross-section instead of being a single
 * dot-product term. Combined with additive blending, the woven
 * braids glow most strongly where light hits them broadside and
 * recede along the strand direction. Camera orbit sweeps the
 * highlight up and down the weave.
 */

const filamentVertex = `
  attribute float t;
  attribute float colorT;
  attribute float strand;
  attribute vec3  aTangent;     // world-space strand tangent
  attribute vec4  aField;
  varying float vT;
  varying float vColorT;
  varying float vEdge;
  varying float vStrand;
  varying vec3  vTangent;
  varying vec3  vWorldPos;
  varying vec4  vField;
  void main() {
    vT = t;
    vColorT = colorT;
    vEdge = (uv.y - 0.5) * 2.0;
    vStrand = strand;
    vTangent = aTangent;
    vField = aField;
    vec4 wp = vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * wp;
  }
`;

const filamentFragment = `
  varying float vT;
  varying float vColorT;
  varying float vEdge;
  varying float vStrand;
  varying vec3  vTangent;
  varying vec3  vWorldPos;
  varying vec4  vField;
  uniform sampler2D uPalette;
  uniform float uPaletteShift;
  uniform float uBrightness;
  uniform float uTrailPower;
  uniform float uTime;
  uniform float uShimmer;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyI;
  uniform vec3  uFillDir;
  uniform vec3  uFillColor;
  uniform float uFillI;
  uniform vec3  uAmbient;
  uniform vec3  uCamPos;
  ${materialShaderChunk}

  vec3 paletteSample(float t) {
    return texture2D(uPalette, vec2(fract(t), 0.5)).rgb;
  }

  // Kajiya-Kay diffuse: sqrt(1 - (T.L)^2). Bright where the light
  // direction is perpendicular to the strand, dark where it runs
  // along the strand.
  float kkDiffuse(vec3 T, vec3 L) {
    float d = dot(T, L);
    return sqrt(max(0.0, 1.0 - d * d));
  }

  // Kajiya-Kay specular for a strand: sin between T and the half
  // vector, raised to a power. The highlight runs perpendicular to
  // the strand and pops along the lit side.
  float kkSpec(vec3 T, vec3 L, vec3 V, float shininess) {
    vec3 H = normalize(L + V);
    float s = kkDiffuse(T, H);
    return pow(s, shininess);
  }

  void main() {
    float core = exp(-vEdge * vEdge * 6.0);
    float trail = pow(1.0 - vT, max(0.3, uTrailPower));
    float fieldEnergy = psFieldEnergy(vField);
    vec3 color = paletteSample(psPaletteT(vColorT, vField, uPaletteShift));

    vec3 T = normalize(vTangent);
    vec3 L = normalize(uKeyDir);
    vec3 Lf = normalize(uFillDir);
    vec3 V = normalize(uCamPos - vWorldPos);

    float dKey  = kkDiffuse(T, L);
    float dFill = kkDiffuse(T, Lf);
    float sKey  = kkSpec(T, L, V, mix(36.0, 13.0, uRoughness));
    float strandRim = pow(kkDiffuse(T, V), max(1.0, uFresnelPower));

    vec3 lit =
        color * uKeyColor  * dKey  * uKeyI
      + color * uFillColor * dFill * uFillI
      + mix(vec3(1.0), color, uMetallic) * uKeyColor * sKey * (0.55 + uMetallic * 0.65) * uKeyI
      + color * uTransmission * strandRim * (0.24 + fieldEnergy * 0.45)
      + color * uEmissive * (0.2 + fieldEnergy * 0.75)
      + color * uAmbient;

    float shimmerPhase = uTime * 1.6 + vStrand * 2.1 + vT * 4.0;
    float shimmer = mix(1.0, 0.7 + 0.5 * sin(shimmerPhase), uShimmer);

    // Hot core blends lit colour toward white near the strand axis
    // so the additive composite produces a bright fiber centre.
    vec3 hot = mix(lit, vec3(1.0) * (uKeyI + uAmbient.r), 0.45 * core);
    vec3 col = hot * core * trail * shimmer * uBrightness;
    col = psFilmicToneMap(col * uExposure);

    float alpha = core * (0.4 + 0.6 * trail);
    gl_FragColor = vec4(col * alpha, alpha * uMaterialAlpha);
  }
`;

type FilamentUniforms = LightingUniforms & MaterialUniforms & {
  uPalette: { value: DataTexture | null };
  uPaletteShift: { value: number };
  uBrightness: { value: number };
  uTrailPower: { value: number };
  uTime: { value: number };
  uShimmer: { value: number };
  uCamPos: { value: Vector3 };
};

function strandCount(density: FilamentDensity): number {
  if (density === "high") return 3;
  if (density === "low") return 1;
  return 2;
}

function strandSampleStep(density: FilamentDensity, quality: RenderQuality | undefined): number {
  const base = Math.max(1, Math.round(quality?.filamentSampleStep ?? 2));
  if (density === "low") return Math.max(1, Math.round(base * 1.4));
  if (density === "high") return Math.max(1, Math.round(base * 0.8));
  return base;
}

function strandWidth(data: TrajectoryData): number {
  if (data.lineThickness === "thick") return 0.18;
  if (data.lineThickness === "thin")  return 0.035;
  return 0.09;
}

function reactiveBrightness(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return 1 + energy * 1.35 + pulse * 1.7;
}

function reactiveTrail(data: TrajectoryData): number {
  const energy = data.renderEnergy ?? 0;
  const pulse = data.renderPulse ?? 0;
  return Math.max(0.4, Math.min(3, 1 + energy * 0.55 + pulse * 0.45));
}

function buildFrames(points: Vector3[]): { normals: Vector3[]; binormals: Vector3[]; tangents: Vector3[] } {
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
    ax <= ay && ax <= az ? new Vector3(1, 0, 0) :
    ay <= az            ? new Vector3(0, 1, 0) :
                          new Vector3(0, 0, 1);
  const n0 = new Vector3().crossVectors(t0, seed).normalize();
  if (!isFinite(n0.x) || n0.lengthSq() < 1e-8) n0.set(0, 1, 0);
  const normals: Vector3[] = new Array(n);
  const binormals: Vector3[] = new Array(n);
  normals[0] = n0;
  binormals[0] = new Vector3().crossVectors(tangents[0], normals[0]).normalize();
  const axis = new Vector3();
  for (let i = 1; i < n; i++) {
    const tPrev = tangents[i - 1];
    const tCurr = tangents[i];
    axis.crossVectors(tPrev, tCurr);
    const sinT = axis.length();
    const cosT = Math.max(-1, Math.min(1, tPrev.dot(tCurr)));
    if (sinT < 1e-6) {
      normals[i] = normals[i - 1].clone();
    } else {
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
    binormals[i] = new Vector3().crossVectors(tangents[i], normals[i]).normalize();
  }
  return { normals, binormals, tangents };
}

export class PhotonWeaveRenderer implements RendererStrategy {
  readonly style = "photon-weave" as const;
  private group: Group | null = null;
  private meshes: Mesh[] = [];
  private materials: ShaderMaterial[] = [];
  private paletteTexture: DataTexture | null = null;
  private trajIndexForMesh: number[] = [];
  private data: TrajectoryData | null = null;
  private context: RenderContext | null = null;
  private sampleCountPerStrand: number[][] = [];
  private sourceCountPerTrajectory: number[] = [];

  init(context: RenderContext, data: TrajectoryData) {
    this.group = new Group();
    this.meshes = [];
    this.materials = [];
    this.trajIndexForMesh = [];
    this.sampleCountPerStrand = [];
    this.sourceCountPerTrajectory = [];
    this.data = data;
    this.paletteTexture = buildPaletteTexture(data.palette, data.customPalette);
    this.context = context;
    context.threeScene.add(this.group);

    const density = data.photonWeave?.filamentDensity ?? "medium";
    const nStrands = strandCount(density);
    const step = strandSampleStep(density, data.quality);
    const width = strandWidth(data);
    const lighting = getLighting();

    const braidPeriod = 14;
    const braidAmp = width * 1.8;

    data.trajectories.forEach((traj, trajIdx) => {
      if (traj.length < 2) return;

      const samples: Vector3[] = [];
      const sampleT: number[] = [];
      for (let i = 0; i < traj.length; i += step) {
        const p = traj[i];
        samples.push(new Vector3(p[0], p[1], p[2]));
        sampleT.push(i / Math.max(1, traj.length - 1));
      }
      if (samples.length < 2) return;

      const { normals, binormals, tangents } = buildFrames(samples);

      const perTrajCounts: number[] = [];
      for (let s = 0; s < nStrands; s++) {
        const phase = (s / nStrands) * Math.PI * 2;
        const N = samples.length;
        const positions = new Float32Array(N * 6);
        const tAttr     = new Float32Array(N * 2);
        const colorAttr = new Float32Array(N * 2);
        const strandAttr= new Float32Array(N * 2);
        const uvAttr    = new Float32Array(N * 4);
        const tanAttr   = new Float32Array(N * 6);
        const fieldAttr = new Float32Array(N * 8);

        for (let i = 0; i < N; i++) {
          const p = samples[i];
          const nVec = normals[i];
          const bVec = binormals[i];
          const tVec = tangents[i];
          const ang = (i / braidPeriod) * Math.PI * 2 + phase;
          const ox = (nVec.x * Math.cos(ang) + bVec.x * Math.sin(ang)) * braidAmp;
          const oy = (nVec.y * Math.cos(ang) + bVec.y * Math.sin(ang)) * braidAmp;
          const oz = (nVec.z * Math.cos(ang) + bVec.z * Math.sin(ang)) * braidAmp;
          const cx = p.x + ox;
          const cy = p.y + oy;
          const cz = p.z + oz;
          const wx = nVec.x * width;
          const wy = nVec.y * width;
          const wz = nVec.z * width;

          positions[i * 6 + 0] = cx - wx;
          positions[i * 6 + 1] = cy - wy;
          positions[i * 6 + 2] = cz - wz;
          positions[i * 6 + 3] = cx + wx;
          positions[i * 6 + 4] = cy + wy;
          positions[i * 6 + 5] = cz + wz;

          tanAttr[i * 6 + 0] = tVec.x;
          tanAttr[i * 6 + 1] = tVec.y;
          tanAttr[i * 6 + 2] = tVec.z;
          tanAttr[i * 6 + 3] = tVec.x;
          tanAttr[i * 6 + 4] = tVec.y;
          tanAttr[i * 6 + 5] = tVec.z;

          const tNorm = sampleT[i];
          tAttr[i * 2 + 0] = tNorm;
          tAttr[i * 2 + 1] = tNorm;
          const sourceIndex = Math.min(traj.length - 1, i * step);
          const colorT = dynamicScalarAt(data.dynamics, trajIdx, sourceIndex, tNorm);
          colorAttr[i * 2 + 0] = colorT;
          colorAttr[i * 2 + 1] = colorT;
          writeVisualFieldVector(fieldAttr, i * 8, data.dynamics, trajIdx, sourceIndex, tNorm);
          writeVisualFieldVector(fieldAttr, i * 8 + 4, data.dynamics, trajIdx, sourceIndex, tNorm);
          strandAttr[i * 2 + 0] = s;
          strandAttr[i * 2 + 1] = s;
          uvAttr[i * 4 + 0] = tNorm; uvAttr[i * 4 + 1] = 0;
          uvAttr[i * 4 + 2] = tNorm; uvAttr[i * 4 + 3] = 1;
        }

        const indices: number[] = [];
        for (let i = 0; i < N - 1; i++) {
          const a = i * 2, b1 = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
          indices.push(a, b1, d, a, d, c);
        }
        const geometry = new BufferGeometry();
        geometry.setIndex(indices);
        geometry.setAttribute("position", new BufferAttribute(positions, 3));
        geometry.setAttribute("uv",       new BufferAttribute(uvAttr, 2));
        geometry.setAttribute("t",        new BufferAttribute(tAttr, 1));
        geometry.setAttribute("colorT",   new BufferAttribute(colorAttr, 1));
        geometry.setAttribute("strand",   new BufferAttribute(strandAttr, 1));
        geometry.setAttribute("aTangent", new BufferAttribute(tanAttr, 3));
        geometry.setAttribute("aField",   new BufferAttribute(fieldAttr, 4));

        const uniforms: FilamentUniforms = {
          uPalette:    { value: this.paletteTexture },
          uPaletteShift: { value: data.paletteShift ?? 0 },
          uBrightness: { value: (data.photonWeave?.brightness ?? 1) * reactiveBrightness(data) },
          uTrailPower: { value: (data.photonWeave?.trailLength ?? 1) * reactiveTrail(data) },
          uTime:       { value: 0 },
          uShimmer:    { value: data.photonWeave?.shimmer ? 1 : 0 },
          uCamPos:     { value: new Vector3() },
          ...createLightingUniforms(lighting),
          ...createMaterialUniforms(data.materialStyle),
        };
        applyMaterialUniforms(uniforms, data.materialStyle, data.emissiveBoost ?? 0);
        const material = new ShaderMaterial({
          uniforms: uniforms as unknown as Record<string, { value: unknown }>,
          vertexShader: filamentVertex,
          fragmentShader: filamentFragment,
          side: DoubleSide,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
        });

        const mesh = new Mesh(geometry, material);
        this.meshes.push(mesh);
        this.materials.push(material);
        this.trajIndexForMesh.push(trajIdx);
        this.group?.add(mesh);
        perTrajCounts.push(N);
      }
      this.sampleCountPerStrand.push(perTrajCounts);
      this.sourceCountPerTrajectory.push(traj.length);
    });
  }

  update(context: RenderContext, data: TrajectoryData) {
    this.dispose(context);
    this.init(context, data);
  }

  applyDynamic(data: TrajectoryData) {
    if (!this.data || !this.context) return;
    this.data = { ...this.data, ...data };
    const brightness = (data.photonWeave?.brightness ?? 1) * reactiveBrightness(data);
    const trail = (data.photonWeave?.trailLength ?? 1) * reactiveTrail(data);
    const shimmer = data.photonWeave?.shimmer ? 1 : 0;
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    const paletteShift = data.paletteShift ?? 0;
    const lighting = getLighting();
    const camPos = this.context.camera.position;

    this.materials.forEach((mat) => {
      const u = mat.uniforms as unknown as FilamentUniforms;
      u.uPaletteShift.value = paletteShift;
      u.uBrightness.value = brightness;
      u.uTrailPower.value = trail;
      u.uShimmer.value = shimmer;
      u.uTime.value = now;
      applyLightingUniforms(u, lighting);
      applyMaterialUniforms(u, data.materialStyle, data.emissiveBoost ?? 0);
      u.uCamPos.value.copy(camPos);
      mat.needsUpdate = true;
    });
  }

  updateDrawWindow(trajectoryIndex: number, start: number, count: number) {
    const counts = this.sampleCountPerStrand[trajectoryIndex];
    const sourceN = this.sourceCountPerTrajectory[trajectoryIndex] ?? counts?.[0] ?? count;
    if (!counts || sourceN <= 0) return;
    let meshStart = 0;
    for (let t = 0; t < trajectoryIndex; t++) {
      meshStart += this.sampleCountPerStrand[t]?.length ?? 0;
    }
    for (let s = 0; s < counts.length; s++) {
      const mesh = this.meshes[meshStart + s];
      if (!mesh) continue;
      const N = counts[s];
      const scale = N / sourceN;
      const mappedStart = Math.max(0, Math.floor(start * scale));
      const mappedCount = Math.max(0, Math.min(N - mappedStart, Math.ceil(count * scale)));
      mesh.geometry.setDrawRange(mappedStart * 6, Math.max(0, mappedCount - 1) * 6);
    }
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
    this.trajIndexForMesh = [];
    this.sampleCountPerStrand = [];
    this.sourceCountPerTrajectory = [];
    this.data = null;
    this.context = null;
  }
}
