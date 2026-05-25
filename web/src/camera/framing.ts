import type { Vec3 } from "./smoothing";

export interface BoundingSphere {
  center: Vec3;
  radius: number;
}

export function boundingSphereFromAABB(min: Vec3, max: Vec3): BoundingSphere {
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
  return { center, radius };
}

/**
 * Distance at which a sphere of `radius` exactly fits inside a perspective
 * frustum with vertical fov `fovYRad` and viewport `aspect` (width / height).
 * `margin` > 1 adds breathing room.
 */
export function fitDistanceForFov(
  radius: number,
  fovYRad: number,
  aspect: number,
  margin = 1.15
): number {
  const tanY = Math.tan(fovYRad / 2);
  const tanX = tanY * Math.max(0.1, aspect);
  const limit = Math.min(tanY, tanX);
  if (limit <= 1e-6) return radius * 4;
  return (radius / limit) * margin;
}

/**
 * Cached k-means lobe centers per trajectory. Re-uses the trajectory array
 * identity as the WeakMap key, so changing systems drops the stale cache.
 */
interface LobeCache {
  k: number;
  centers: Vec3[];
}

const lobeCache = new WeakMap<object, LobeCache>();

function pickInitialCenters(traj: readonly Vec3[], k: number): Vec3[] {
  const n = traj.length;
  const centers: Vec3[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(((i + 0.5) / k) * n);
    const p = traj[Math.min(n - 1, Math.max(0, idx))];
    centers.push([p[0], p[1], p[2]]);
  }
  return centers;
}

export function lobeCentersFromTrajectory(
  traj: readonly Vec3[],
  k: number
): Vec3[] {
  const safeK = Math.max(1, Math.min(8, Math.floor(k)));
  if (traj.length < safeK) return traj.map((p) => [p[0], p[1], p[2]]);

  const cached = lobeCache.get(traj as unknown as object);
  if (cached && cached.k === safeK) return cached.centers;

  let centers = pickInitialCenters(traj, safeK);
  const assignments = new Int32Array(traj.length);
  const iterations = 12;

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < traj.length; i++) {
      const p = traj[i];
      let bestIdx = 0;
      let bestD = Infinity;
      for (let c = 0; c < safeK; c++) {
        const cx = centers[c];
        const dx = p[0] - cx[0];
        const dy = p[1] - cx[1];
        const dz = p[2] - cx[2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          bestIdx = c;
        }
      }
      assignments[i] = bestIdx;
    }
    const sums = Array.from({ length: safeK }, () => [0, 0, 0, 0] as [number, number, number, number]);
    for (let i = 0; i < traj.length; i++) {
      const a = assignments[i];
      const p = traj[i];
      sums[a][0] += p[0];
      sums[a][1] += p[1];
      sums[a][2] += p[2];
      sums[a][3] += 1;
    }
    const next: Vec3[] = [];
    for (let c = 0; c < safeK; c++) {
      const s = sums[c];
      if (s[3] > 0) next.push([s[0] / s[3], s[1] / s[3], s[2] / s[3]]);
      else next.push([centers[c][0], centers[c][1], centers[c][2]]);
    }
    centers = next;
  }

  lobeCache.set(traj as unknown as object, { k: safeK, centers });
  return centers;
}

/**
 * Heuristic lobe count for an attractor given its AABB. Most chaotic
 * attractors in this app have either 2 wings (Lorenz, Rössler) or
 * 3+ blobs (Aizawa, Thomas). Pick based on the spread along the
 * principal axis: very elongated → 2, balanced → 3.
 */
export function autoLobeCount(min: Vec3, max: Vec3): number {
  const ex = max[0] - min[0];
  const ey = max[1] - min[1];
  const ez = max[2] - min[2];
  const longest = Math.max(ex, ey, ez);
  const shortest = Math.max(1e-6, Math.min(ex, ey, ez));
  const aspect = longest / shortest;
  if (aspect > 2.2) return 2;
  return 3;
}
