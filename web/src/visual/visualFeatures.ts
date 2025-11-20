import type { Trajectories } from "../types";

export interface VisualFeatureFrame {
  camera_orbit_phase: number; // 0..1
  camera_radius_norm: number; // 0..1
  avg_speed: number; // 0..1
  curvature: number; // 0..1
  traj_density: number; // 0..1
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
        const dot = dx1 * dx2 + dy1 * dy2 + dz1 * dz2;
        const cosAngle = Math.max(-1, Math.min(1, dot / (v1 * v2)));
        const angle = Math.acos(cosAngle);
        curveAccum += angle;
        curveCount++;
      }

      speedAccum += v1;
      speedCount++;
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

  return {
    camera_orbit_phase: orbitPhase,
    camera_radius_norm: Math.max(0, Math.min(1, radiusNorm)),
    avg_speed: avgSpeed,
    curvature,
    traj_density: trajDensity,
  };
}
