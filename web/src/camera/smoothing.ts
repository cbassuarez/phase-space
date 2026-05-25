export type Vec3 = [number, number, number];

const EPSILON = 1e-9;

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vecLen(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vecNormalize(a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const len = vecLen(a);
  if (len < EPSILON) return [fallback[0], fallback[1], fallback[2]];
  const inv = 1 / len;
  return [a[0] * inv, a[1] * inv, a[2] * inv];
}

export function vecLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Critically-damped spring (Unity SmoothDamp). Frame-rate independent.
 * `omega` is the natural frequency in rad/s. Larger = stiffer/faster.
 * `omega ≈ 2/responseTime` for "settle in roughly responseTime seconds".
 * `velocity` is mutated in place via the returned tuple.
 */
export function springScalar(
  current: number,
  target: number,
  velocity: number,
  omega: number,
  dt: number
): [number, number] {
  const x = omega * dt;
  const expX = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVel = (velocity - omega * temp) * expX;
  const newVal = target + (change + temp) * expX;
  return [newVal, newVel];
}

export function springVec3(
  current: Vec3,
  target: Vec3,
  velocity: Vec3,
  omega: number,
  dt: number
): { value: Vec3; velocity: Vec3 } {
  const [x, vx] = springScalar(current[0], target[0], velocity[0], omega, dt);
  const [y, vy] = springScalar(current[1], target[1], velocity[1], omega, dt);
  const [z, vz] = springScalar(current[2], target[2], velocity[2], omega, dt);
  return { value: [x, y, z], velocity: [vx, vy, vz] };
}

/**
 * Unit-vector slerp. Picks the short arc; falls back to lerp+normalize
 * for nearly-parallel inputs and to the first input for nearly-antiparallel.
 */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = clamp(vecDot(a, b), -1, 1);
  if (d > 0.9995) return vecNormalize(vecLerp(a, b, t), a);
  if (d < -0.9995) return [a[0], a[1], a[2]];
  const theta = Math.acos(d) * t;
  const rel = vecNormalize(
    [b[0] - a[0] * d, b[1] - a[1] * d, b[2] - a[2] * d],
    a
  );
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return [
    a[0] * cosT + rel[0] * sinT,
    a[1] * cosT + rel[1] * sinT,
    a[2] * cosT + rel[2] * sinT,
  ];
}

/**
 * One-step parallel transport of `prevUp` onto the plane perpendicular
 * to `newTangent`. This preserves frame coherence between consecutive
 * camera frames — no flips even when the tangent swings hard.
 */
export function parallelTransport(prevUp: Vec3, newTangent: Vec3): Vec3 {
  const d = vecDot(prevUp, newTangent);
  const proj: Vec3 = [
    prevUp[0] - newTangent[0] * d,
    prevUp[1] - newTangent[1] * d,
    prevUp[2] - newTangent[2] * d,
  ];
  if (vecLen(proj) < EPSILON) {
    const alt: Vec3 = Math.abs(newTangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const altD = vecDot(alt, newTangent);
    return vecNormalize([
      alt[0] - newTangent[0] * altD,
      alt[1] - newTangent[1] * altD,
      alt[2] - newTangent[2] * altD,
    ]);
  }
  return vecNormalize(proj);
}

/** Rodrigues rotation: rotate `v` around unit `axis` by `angle` radians. */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = 1 - c;
  const d = vecDot(axis, v);
  const cr = vecCross(axis, v);
  return [
    v[0] * c + cr[0] * s + axis[0] * d * k,
    v[1] * c + cr[1] * s + axis[1] * d * k,
    v[2] * c + cr[2] * s + axis[2] * d * k,
  ];
}

/**
 * Per-trajectory chase-mode motion state. Held in a module-scope WeakMap
 * keyed on the trajectory array reference, so swapping trajectories
 * (system change, preset change) drops the stale state automatically.
 */
export interface CameraMotionState {
  prevTangent: Vec3 | null;
  prevUp: Vec3 | null;
  prevBinormal: Vec3 | null;
  posVel: Vec3;
  tgtVel: Vec3;
  sArc: number;
  initialized: boolean;
}

const motionStateMap = new WeakMap<object, CameraMotionState>();

export function getCameraMotionState(key: object): CameraMotionState {
  let s = motionStateMap.get(key);
  if (!s) {
    s = {
      prevTangent: null,
      prevUp: null,
      prevBinormal: null,
      posVel: [0, 0, 0],
      tgtVel: [0, 0, 0],
      sArc: 0,
      initialized: false,
    };
    motionStateMap.set(key, s);
  }
  return s;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(EPSILON, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
