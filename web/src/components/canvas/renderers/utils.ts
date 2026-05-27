import * as THREE from "three";
import { DataTexture, RGBAFormat, SRGBColorSpace, UnsignedByteType } from "three";
import type { CustomPaletteState } from "../../../palettes";
import { samplePalette } from "../../../palettes";
import type { Palette } from "../../../types";

export type DynamicScalars = Float32Array[];
export interface VisualField {
  color: Float32Array[];
  progress: Float32Array[];
  speed: Float32Array[];
  curvature: Float32Array[];
  density: Float32Array[];
  hash: Float32Array[];
}

export type VisualFieldChannel = "color" | "progress" | "speed" | "curvature" | "density" | "hash";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function percentile(sorted: number[], t: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp01(t) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function robustNormalizeValues(values: number[], lowT = 0.04, highT = 0.96): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const low = percentile(sorted, lowT);
  const high = percentile(sorted, highT);
  const range = high - low;
  if (!Number.isFinite(range) || range < 1e-8) {
    return values.map(() => Number.NaN);
  }
  return values.map((v) => clamp01((v - low) / range));
}

function trajectoryHash(index: number): number {
  return ((Math.sin((index + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1;
}

function buildSpatialDensity(trajectories: number[][][], refs: { trajIdx: number; pointIdx: number }[]): number[] {
  const bins = new Map<string, number>();
  const grid = 18;
  const extent = 7.5;
  const invSize = grid / (extent * 2);
  const keys: string[] = [];

  refs.forEach((ref) => {
    const p = trajectories[ref.trajIdx]?.[ref.pointIdx];
    if (!p) {
      keys.push("0,0,0");
      return;
    }
    const ix = Math.max(0, Math.min(grid - 1, Math.floor((p[0] + extent) * invSize)));
    const iy = Math.max(0, Math.min(grid - 1, Math.floor((p[1] + extent) * invSize)));
    const iz = Math.max(0, Math.min(grid - 1, Math.floor((p[2] + extent) * invSize)));
    const key = `${ix},${iy},${iz}`;
    keys.push(key);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  });

  return keys.map((key) => bins.get(key) ?? 0);
}

export function computeDynamicScalars(trajectories: number[][][]): VisualField {
  const speeds: number[] = [];
  const curvatures: number[] = [];
  const refs: { trajIdx: number; pointIdx: number; progress: number }[] = [];

  trajectories.forEach((traj, trajIdx) => {
    const n = traj.length;
    for (let i = 0; i < n; i++) {
      const progress = n > 1 ? i / (n - 1) : 0;
      refs.push({ trajIdx, pointIdx: i, progress });

      if (n < 3) {
        speeds.push(0);
        curvatures.push(0);
        return;
      }

      const prev = traj[Math.max(0, i - 1)];
      const curr = traj[i];
      const next = traj[Math.min(n - 1, i + 1)];
      const ax = curr[0] - prev[0];
      const ay = curr[1] - prev[1];
      const az = curr[2] - prev[2];
      const bx = next[0] - curr[0];
      const by = next[1] - curr[1];
      const bz = next[2] - curr[2];
      const alen = Math.hypot(ax, ay, az);
      const blen = Math.hypot(bx, by, bz);
      const speed = Math.hypot(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
      let curvature = 0;
      if (alen > 1e-8 && blen > 1e-8) {
        const dot = (ax * bx + ay * by + az * bz) / (alen * blen);
        curvature = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI;
      }
      speeds.push(Number.isFinite(speed) ? speed : 0);
      curvatures.push(Number.isFinite(curvature) ? curvature : 0);
    }
  });

  const speedNorm = robustNormalizeValues(speeds);
  const curvatureNorm = robustNormalizeValues(curvatures);
  const densityNorm = robustNormalizeValues(buildSpatialDensity(trajectories, refs), 0.08, 0.98);
  const combined = refs.map((ref, i) => {
    const speed = Number.isFinite(speedNorm[i]) ? speedNorm[i] : ref.progress;
    const curvature = Number.isFinite(curvatureNorm[i]) ? curvatureNorm[i] : ref.progress;
    const density = Number.isFinite(densityNorm[i]) ? densityNorm[i] : 0;
    const hash = trajectoryHash(ref.trajIdx);
    const inverseSpeed = 1 - speed;
    const wave = 0.5 + 0.5 * Math.sin((ref.progress * 2.7 + curvature * 0.9 + density * 0.6 + hash * 1.7) * Math.PI * 2);
    return 0.32 * curvature + 0.23 * inverseSpeed + 0.2 * density + 0.15 * wave + 0.1 * ref.progress;
  });
  const combinedNorm = robustNormalizeValues(combined, 0.02, 0.98);

  const result: VisualField = {
    color: trajectories.map((traj) => new Float32Array(traj.length)),
    progress: trajectories.map((traj) => new Float32Array(traj.length)),
    speed: trajectories.map((traj) => new Float32Array(traj.length)),
    curvature: trajectories.map((traj) => new Float32Array(traj.length)),
    density: trajectories.map((traj) => new Float32Array(traj.length)),
    hash: trajectories.map((traj) => new Float32Array(traj.length)),
  };
  refs.forEach((ref, i) => {
    const fallback = ref.progress;
    result.color[ref.trajIdx][ref.pointIdx] = Number.isFinite(combinedNorm[i]) ? combinedNorm[i] : fallback;
    result.progress[ref.trajIdx][ref.pointIdx] = fallback;
    result.speed[ref.trajIdx][ref.pointIdx] = Number.isFinite(speedNorm[i]) ? speedNorm[i] : fallback;
    result.curvature[ref.trajIdx][ref.pointIdx] = Number.isFinite(curvatureNorm[i]) ? curvatureNorm[i] : fallback;
    result.density[ref.trajIdx][ref.pointIdx] = Number.isFinite(densityNorm[i]) ? densityNorm[i] : 0;
    result.hash[ref.trajIdx][ref.pointIdx] = trajectoryHash(ref.trajIdx);
  });
  return result;
}

export function visualFieldAt(
  dynamics: VisualField | DynamicScalars | undefined,
  channel: VisualFieldChannel,
  trajIdx: number,
  pointIdx: number,
  fallback = 0
): number {
  if (!dynamics) return clamp01(fallback);
  const value =
    Array.isArray(dynamics)
      ? (channel === "color" ? dynamics[trajIdx]?.[pointIdx] : fallback)
      : dynamics[channel]?.[trajIdx]?.[pointIdx];
  return Number.isFinite(value) ? clamp01(value as number) : clamp01(fallback);
}

export function dynamicScalarAt(
  dynamics: VisualField | DynamicScalars | undefined,
  trajIdx: number,
  pointIdx: number,
  fallback = 0
): number {
  return visualFieldAt(dynamics, "color", trajIdx, pointIdx, fallback);
}

export function writeVisualFieldVector(
  out: Float32Array,
  offset: number,
  dynamics: VisualField | DynamicScalars | undefined,
  trajIdx: number,
  pointIdx: number,
  fallbackProgress = 0
) {
  out[offset] = visualFieldAt(dynamics, "speed", trajIdx, pointIdx, fallbackProgress);
  out[offset + 1] = visualFieldAt(dynamics, "curvature", trajIdx, pointIdx, fallbackProgress);
  out[offset + 2] = visualFieldAt(dynamics, "density", trajIdx, pointIdx, 0);
  out[offset + 3] = visualFieldAt(dynamics, "hash", trajIdx, pointIdx, trajectoryHash(trajIdx));
}

export function colorForDynamicScalar(
  scalar: number,
  palette: Palette,
  customPalette: CustomPaletteState,
  shift = 0
): THREE.Color {
  const t = ((scalar + shift) % 1 + 1) % 1;
  return samplePalette(palette, t, customPalette);
}

export function buildVertexColorArray(
  trajectoryIndex: number,
  pointCount: number,
  dynamics: VisualField | DynamicScalars | undefined,
  palette: Palette,
  customPalette: CustomPaletteState,
  shift = 0
): Float32Array {
  const colors = new Float32Array(pointCount * 3);
  for (let i = 0; i < pointCount; i++) {
    const fallback = pointCount > 1 ? i / (pointCount - 1) : 0;
    const color = colorForDynamicScalar(
      dynamicScalarAt(dynamics, trajectoryIndex, i, fallback),
      palette,
      customPalette,
      shift
    );
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  return colors;
}

export function buildPaletteTexture(id: Palette, customPalette: CustomPaletteState): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const color = samplePalette(id, t, customPalette).clone().convertLinearToSRGB();
    data[i * 4 + 0] = Math.round(color.r * 255);
    data[i * 4 + 1] = Math.round(color.g * 255);
    data[i * 4 + 2] = Math.round(color.b * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, size, 1, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function colorForTrajectory(
  idx: number,
  palette: Palette,
  customPalette: CustomPaletteState,
  shift = 0,
  spread = 5
): THREE.Color {
  const denom = Math.max(1, spread - 1);
  const base = ((idx % spread) / denom + shift) % 1;
  const t = base < 0 ? base + 1 : base;
  return samplePalette(palette, t, customPalette);
}
