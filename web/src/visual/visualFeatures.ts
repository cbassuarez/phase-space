import type { Trajectories } from "../types";

export interface VisualFeatureFrame {
  camera_orbit_phase: number; // 0..1
  camera_radius_norm: number; // 0..1
  avg_speed: number; // 0..1
  curvature: number; // 0..1
  traj_density: number; // 0..1
  flow_x: number; // 0..1, signed average tangent mapped from -1..1
  flow_y: number; // 0..1, signed average tangent mapped from -1..1
  flow_z: number; // 0..1, signed average tangent mapped from -1..1
  spatial_spread: number; // 0..1
  lobe_pulse: number; // 0..1
}

interface CameraState {
  theta: number;
  phi: number;
  r: number;
  minR: number;
  maxR: number;
}

interface ViewerDynamicsState {
  camera: CameraState;
  trajectories: Trajectories;
}

export function computeVisualFeatures(
  state: ViewerDynamicsState,
  prev?: VisualFeatureFrame
): VisualFeatureFrame {
  const { camera, trajectories } = state;

  const orbitPhase = ((camera.theta / (2 * Math.PI)) % 1 + 1) % 1;
  const radiusNorm =
    camera.maxR > camera.minR
      ? (camera.r - camera.minR) / (camera.maxR - camera.minR)
      : 0;

  let avgSpeed = prev?.avg_speed ?? 0;
  let curvature = prev?.curvature ?? 0;
  let trajDensity = 0;

  let speedAccum = 0;
  let speedCount = 0;

  let curveAccum = 0;
  let curveCount = 0;
  let flowX = 0;
  let flowY = 0;
  let flowZ = 0;
  let flowCount = 0;
  let radiusAccum = 0;
  let radiusCount = 0;
  let xPositive = 0;
  let xNegative = 0;
  let yPositive = 0;
  let yNegative = 0;

  trajectories.forEach((traj) => {
    const len = traj.length;
    if (len < 3) return;

    const step = Math.max(1, Math.floor(len / 64));
    for (let i = step; i < len - step; i += step) {
      const p0 = traj[i - step];
      const p1 = traj[i];
      const p2 = traj[i + step];

      const dx1 = p1[0] - p0[0];
      const dy1 = p1[1] - p0[1];
      const dz1 = p1[2] - p0[2];
      const v1 = Math.hypot(dx1, dy1, dz1);

      const dx2 = p2[0] - p1[0];
      const dy2 = p2[1] - p1[1];
      const dz2 = p2[2] - p1[2];
      const v2 = Math.hypot(dx2, dy2, dz2);

      if (v1 > 0 && v2 > 0) {
        flowX += dx2 / v2;
        flowY += dy2 / v2;
        flowZ += dz2 / v2;
        flowCount++;

        const dot = dx1 * dx2 + dy1 * dy2 + dz1 * dz2;
        const cosAngle = Math.max(-1, Math.min(1, dot / (v1 * v2)));
        const angle = Math.acos(cosAngle);
        curveAccum += angle;
        curveCount++;
      }

      speedAccum += v1;
      speedCount++;

      const radius = Math.hypot(p1[0], p1[1], p1[2]);
      radiusAccum += radius * radius;
      radiusCount++;
      if (p1[0] >= 0) xPositive++;
      else xNegative++;
      if (p1[1] >= 0) yPositive++;
      else yNegative++;
    }

    trajDensity += len;
  });

  if (speedCount > 0) {
    avgSpeed = Math.min(1, (speedAccum / speedCount) * 0.5);
  }

  if (curveCount > 0) {
    curvature = Math.min(1, (curveAccum / curveCount) * 0.2);
  }

  const densityNorm = Math.min(1, trajDensity / 200_000);
  trajDensity = densityNorm;
  const flowNorm = (axis: number) => {
    const signed = flowCount > 0 ? axis / flowCount : 0;
    return Math.max(0, Math.min(1, 0.5 + signed * 0.5));
  };
  const spreadRaw = radiusCount > 0 ? Math.sqrt(radiusAccum / radiusCount) / 6 : 0;
  const spatialSpread = Math.max(0, Math.min(1, spreadRaw));
  const lobeTotal = Math.max(1, xPositive + xNegative + yPositive + yNegative);
  const lobeBalance =
    (Math.abs(xPositive - xNegative) + Math.abs(yPositive - yNegative)) / lobeTotal;
  const lobeWave = 0.5 + 0.5 * Math.sin((orbitPhase + lobeBalance * 0.75 + curvature * 0.25) * Math.PI * 2);
  const lobePulse = Math.max(0, Math.min(1, lobeBalance * 0.45 + lobeWave * 0.55));

  return {
    camera_orbit_phase: orbitPhase,
    camera_radius_norm: Math.max(0, Math.min(1, radiusNorm)),
    avg_speed: avgSpeed,
    curvature,
    traj_density: trajDensity,
    flow_x: flowNorm(flowX),
    flow_y: flowNorm(flowY),
    flow_z: flowNorm(flowZ),
    spatial_spread: spatialSpread,
    lobe_pulse: lobePulse,
  };
}
