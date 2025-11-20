import type { Trajectories } from "../../../types";

export interface NormalizedTrajectories {
  trajectories: Trajectories;
  positions: Float32Array;
  bounds: {
    radius: number;
    center: [number, number, number];
    scale: number;
  };
  pointCount: number;
}

export function normalizeTrajectories(trajectories: Trajectories): NormalizedTrajectories {
  if (!trajectories.length) {
    return {
      trajectories: [],
      positions: new Float32Array(0),
      bounds: { radius: 6, center: [0, 0, 0], scale: 1 },
      pointCount: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  let totalPoints = 0;
  trajectories.forEach((traj) => {
    totalPoints += traj.length;
    traj.forEach(([x, y, z]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    });
  });

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  let rMax = 0;
  trajectories.forEach((traj) => {
    traj.forEach(([x, y, z]) => {
      const dx = x - cx;
      const dy = y - cy;
      const dz = z - cz;
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > rMax) rMax = r2;
    });
  });
  const radius = Math.sqrt(Math.max(rMax, 1e-6));
  const targetRadius = 6;
  const scale = targetRadius / Math.max(radius, 1e-6);

  const positions = new Float32Array(totalPoints * 3);
  const normalized: Trajectories = [];
  let offset = 0;
  trajectories.forEach((traj) => {
    const normTraj: [number, number, number][] = [];
    traj.forEach(([x, y, z]) => {
      const nx = (x - cx) * scale;
      const ny = (y - cy) * scale;
      const nz = (z - cz) * scale;
      positions[offset++] = nx;
      positions[offset++] = ny;
      positions[offset++] = nz;
      normTraj.push([nx, ny, nz]);
    });
    normalized.push(normTraj);
  });

  return {
    trajectories: normalized,
    positions,
    bounds: {
      radius: targetRadius,
      center: [0, 0, 0],
      scale,
    },
    pointCount: totalPoints,
  };
}
