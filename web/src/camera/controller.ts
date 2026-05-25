import type {
  CameraContext,
  CameraMode,
  CameraPose,
  CameraProgram,
} from "./types";

/**
 * Camera controller — improved path-rider.
 *
 * Changes vs. the previous version:
 *
 *   1. PATH-RIDER REWRITE. Arc-length parameterization + smoothed
 *      tangent + curvature-based banking + chase distance.
 *      See pathRiderPose for the full rationale.
 *
 *   2. Bug fix: smoothPose now actually gets the previous pose. The
 *      old code passed `null` as prevPose from every mode-specific
 *      function, so the stability slider had no effect.
 *
 *   3. orbit / grid-surface / drone-ghost / lobe-focus left as-is.
 *      The other modes need their own passes but the user asked to
 *      start with path.
 *
 * IMPORTANT — paste-time integration note for the host:
 *
 *   CanvasPanel currently builds `ctx.trajectories` from the RAW
 *   trajectories prop:
 *
 *     trajectories: trajectories as [number, number, number][][],
 *
 *   The renderers draw the *normalized* trajectories (centered at
 *   origin, radius ≈ 6). The orbit camera coincidentally works
 *   because it builds positions from `ctx.centroid` (≈ 0, derived
 *   from normalized) — but path-rider was pulling raw points and
 *   placing the camera at e.g. (28, 17, 22) when the rendered
 *   attractor is at the origin. Off by 30+ units.
 *
 *   Fix that one line in CanvasPanel.tsx to:
 *
 *     trajectories: normalizedTrajectories as [number, number, number][][],
 *
 *   The new path-rider here assumes ctx.trajectories is in the same
 *   space as the rendered attractor. With that one-line change,
 *   path mode lands where the attractor actually is.
 */

// --- math helpers -----------------------------------------------------

type Vec3 = [number, number, number];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vecLen(a: Vec3) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function vecNormalize(a: Vec3): Vec3 {
  const len = vecLen(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

function vecLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function hash01(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function sceneRadius(ctx: CameraContext) {
  const span = vecSub(ctx.bboxMax, ctx.bboxMin);
  const diag = vecLen(span);
  return diag > 0 ? diag * 0.35 : 10;
}

function jitterFromTime(t: number, scale: number) {
  return Math.sin(t * 1.3) * Math.cos(t * 0.7) * scale;
}

// --- arc-length cache -------------------------------------------------

/**
 * Per-trajectory cumulative arc length. Keyed by trajectory array
 * identity via a WeakMap so the cache invalidates automatically
 * when the host swaps trajectories on system / preset change.
 */
interface ArcLengthCache {
  cumLength: Float32Array;
  totalLength: number;
}

const arcCache = new WeakMap<readonly Vec3[], ArcLengthCache>();

function getArcLengthCache(traj: readonly Vec3[]): ArcLengthCache {
  let cache = arcCache.get(traj);
  if (cache) return cache;
  const N = traj.length;
  const cumLength = new Float32Array(N);
  let total = 0;
  for (let i = 1; i < N; i++) {
    const dx = traj[i][0] - traj[i - 1][0];
    const dy = traj[i][1] - traj[i - 1][1];
    const dz = traj[i][2] - traj[i - 1][2];
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    cumLength[i] = total;
  }
  cache = { cumLength, totalLength: total };
  arcCache.set(traj, cache);
  return cache;
}

/**
 * Point on the trajectory at arc-length `s`, linearly interpolated
 * between samples. Binary searches the cumulative-length array.
 * Caller is responsible for wrapping/clamping `s` first.
 */
function pointAtArcLength(traj: readonly Vec3[], cache: ArcLengthCache, s: number): Vec3 {
  const N = traj.length;
  if (s <= 0) return [traj[0][0], traj[0][1], traj[0][2]];
  if (s >= cache.totalLength) {
    const last = traj[N - 1];
    return [last[0], last[1], last[2]];
  }
  let lo = 0;
  let hi = N - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cache.cumLength[mid] <= s) lo = mid;
    else hi = mid;
  }
  const segLen = cache.cumLength[hi] - cache.cumLength[lo];
  const frac = segLen > 1e-9 ? (s - cache.cumLength[lo]) / segLen : 0;
  const a = traj[lo];
  const b = traj[hi];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
  ];
}

function wrapArcLength(s: number, total: number, mode: "wrap" | "ping-pong" | "clamp"): number {
  if (total <= 0) return 0;
  if (mode === "clamp") return clamp(s, 0, total);
  if (mode === "wrap") return ((s % total) + total) % total;
  const period = total * 2;
  const m = ((s % period) + period) % period;
  return m > total ? period - m : m;
}

// --- mode: orbit (unchanged) -----------------------------------------

function orbitPose(
  program: CameraProgram,
  ctx: CameraContext,
  t: number,
  zoom: number,
  stability: number,
  prev: CameraPose | null
): CameraPose {
  const cfg = program.orbit;
  const radius = Math.max(0.01, cfg.base_radius + cfg.radius_jitter * Math.sin(t * 0.9));
  const r = (radius * sceneRadius(ctx)) / Math.max(0.25, zoom);
  const az = t * cfg.azimuth_speed * 2 * Math.PI;
  const polar = cfg.polar_center + cfg.polar_amplitude * Math.sin(t * cfg.polar_speed);
  const sinPolar = Math.sin(polar);
  const x = r * sinPolar * Math.cos(az);
  const y = r * Math.cos(polar);
  const z = r * sinPolar * Math.sin(az);
  const jitter = cfg.hand_held_jitter * 0.05 * sceneRadius(ctx);
  const pos = vecAdd(ctx.centroid, [x + jitterFromTime(t, jitter), y, z + jitterFromTime(t + 12.0, jitter)]);
  return smoothPose({ position: pos, target: ctx.centroid, up: [0, 1, 0] }, stability, prev);
}

// --- mode: path-rider (NEW) -------------------------------------------

/**
 * Ride the attractor like an onboard racetrack camera.
 *
 * Design:
 *
 *   - ARC-LENGTH PARAMETERIZATION. We precompute cumulative arc
 *     length along the trajectory once, then sample by world
 *     distance instead of by sample index. Lorenz's slow regions
 *     don't bog the camera down anymore; fast slingshots don't
 *     blink past.
 *
 *   - SMOOTHED TANGENT via a windowed difference: tangent(s) =
 *     normalize(point(s + w) - point(s - w)). Cuts the high-
 *     frequency wobble in raw `traj[i+1] - traj[i]`.
 *
 *   - CURVATURE-BASED BANKING. Sample tangent slightly ahead and
 *     slightly behind to estimate the curvature direction (where
 *     the curve is bending toward). Blend that into the up vector
 *     so the camera leans into corners. Looks like an F1 onboard
 *     cam, not a museum tour.
 *
 *   - CHASE DISTANCE. Camera sits a small fraction of the look-
 *     ahead behind the current path point (along the negative
 *     tangent), plus a tiny ride height along the banked up. So
 *     the trajectory itself is visible in frame — you're not
 *     literally inside the line.
 *
 * Config-field re-interpretation (same field names, new semantics):
 *
 *   - time_scale      → cruise speed multiplier (1.0 = lap the
 *                       whole orbit in ~20 s).
 *   - ahead_offset    → look-ahead distance in *average segment
 *                       lengths*. So old values (e.g. 60) map to
 *                       roughly the same visual distance as before.
 *   - lateral_offset  → ride-height factor (height above path).
 *   - up_blend        → "world up weight". 1.0 = no banking
 *                       (level horizon); 0.0 = full banking
 *                       (tilt with the curve). Default ~0.6 reads
 *                       sportiest.
 *   - loop_mode       → wrap / ping-pong / clamp the s-coordinate.
 *
 * Existing presets won't break, but they'll feel different. That's
 * intentional — the old behaviour was broken in space anyway.
 */
function pathRiderPose(
  program: CameraProgram,
  ctx: CameraContext,
  t: number,
  zoom: number,
  stability: number,
  prev: CameraPose | null
): CameraPose {
  const cfg = program.path_rider;
  const idx = clamp(Math.floor(cfg.trajectory_index), 0, Math.max(0, ctx.trajectories.length - 1));
  const traj = ctx.trajectories[idx] as Vec3[] | undefined;
  if (!traj || traj.length < 4) {
    return orbitPose(program, ctx, t, zoom, stability, prev);
  }

  const cache = getArcLengthCache(traj);
  if (cache.totalLength <= 1e-6) {
    return orbitPose(program, ctx, t, zoom, stability, prev);
  }

  // Cruise speed: percentage of total path per second, scaled by
  // time_scale. With time_scale=1.0 we lap the orbit in ~20s, which
  // reads well for visually-dense attractors. Tunable by the slider.
  const cruiseSpeed = cache.totalLength * 0.05 * Math.max(0.01, cfg.time_scale);
  const sRaw = t * cruiseSpeed;
  const s = wrapArcLength(sRaw, cache.totalLength, cfg.loop_mode);

  // Look-ahead distance. avgSegLen normalizes the old
  // ahead_offset (which was an index count) into world units, so
  // existing presets shift behaviour minimally.
  const avgSegLen = cache.totalLength / Math.max(1, traj.length - 1);
  const lookAhead = Math.max(avgSegLen * 4, cfg.ahead_offset * avgSegLen);

  // Tangent-smoothing window: a fraction of look-ahead. Bigger
  // window = smoother camera but later to react to corners.
  const tangentWindow = Math.max(avgSegLen * 3, lookAhead * 0.18);

  // Sample five points around s:
  //   sBack ─ sBehind ─ s ─ sAhead ─ sTarget
  // Distance back and ahead matched so the tangent estimate is
  // centered on the camera's current path position.
  const sBehind = wrapArcLength(s - tangentWindow, cache.totalLength, cfg.loop_mode);
  const sAhead  = wrapArcLength(s + tangentWindow, cache.totalLength, cfg.loop_mode);
  const sTarget = wrapArcLength(s + lookAhead,     cache.totalLength, cfg.loop_mode);
  const sFar    = wrapArcLength(s + lookAhead + tangentWindow, cache.totalLength, cfg.loop_mode);

  const pCurrent = pointAtArcLength(traj, cache, s);
  const pBehind  = pointAtArcLength(traj, cache, sBehind);
  const pAhead   = pointAtArcLength(traj, cache, sAhead);
  const pTarget  = pointAtArcLength(traj, cache, sTarget);
  const pFar     = pointAtArcLength(traj, cache, sFar);

  // Smoothed tangent at the camera location.
  const tangent = vecNormalize(vecSub(pAhead, pBehind));

  // Curvature: how much the tangent direction changes as we look
  // ahead. Direction of (tangentAhead - tangentBehind) is roughly
  // the curve's binormal projected into the bending plane — close
  // enough to use for banking.
  const tangentBack    = vecNormalize(vecSub(pCurrent, pBehind));
  const tangentForward = vecNormalize(vecSub(pTarget,  pAhead));
  const tangentFar     = vecNormalize(vecSub(pFar,     pTarget));
  const curveDir = vecSub(tangentFar, tangentBack);
  const curveMag = vecLen(curveDir);
  const curvature: Vec3 = curveMag > 1e-6 ? vecScale(curveDir, 1 / curveMag) : [0, 1, 0];

  // Banked up vector. up_blend close to 1 keeps the horizon level;
  // close to 0 banks fully with the turn.
  const worldUp: Vec3 = [0, 1, 0];
  const worldWeight = clamp(cfg.up_blend, 0, 1);
  // Bake banking magnitude into the curvature contribution so
  // gentle turns don't tilt the camera as hard as hairpins. Clamp
  // so very tight curves don't make the camera spin.
  const bankStrength = Math.min(1, curveMag * 4) * (1 - worldWeight);
  const up = vecNormalize(vecAdd(
    vecScale(worldUp, 1 - bankStrength),
    vecScale(curvature, bankStrength)
  ));

  // Ride height and chase distance, both in world units. Scale by
  // the tangent-window so values stay in the same regime across
  // very different attractor sizes.
  const rideHeight    = cfg.lateral_offset * tangentWindow * 1.6;
  const chaseDistance = tangentWindow * 0.8;

  // Suppress unused warning for tangentForward (it's computed for
  // future per-frame analysis but not used in the current pose
  // formula).
  void tangentForward;

  // Camera position: chase a bit behind current path point, lifted
  // along the banked up.
  const pos: Vec3 = [
    pCurrent[0] - tangent[0] * chaseDistance + up[0] * rideHeight,
    pCurrent[1] - tangent[1] * chaseDistance + up[1] * rideHeight,
    pCurrent[2] - tangent[2] * chaseDistance + up[2] * rideHeight,
  ];

  // Zoom: push the camera farther from the target without changing
  // where it's looking. 1.0 = no change; 2.0 = twice as far back.
  // Smaller than 1 brings it in (close to the line).
  const fromTarget = vecSub(pos, pTarget);
  const zoomed = vecAdd(pTarget, vecScale(fromTarget, Math.max(0.05, zoom)));

  return smoothPose({ position: zoomed, target: pTarget, up }, stability, prev);
}

// --- mode: grid-surface (unchanged) ----------------------------------

function gridSurfacePose(
  program: CameraProgram,
  ctx: CameraContext,
  t: number,
  zoom: number,
  stability: number,
  prev: CameraPose | null
): CameraPose {
  const cfg = program.grid_surface;
  const radius = (cfg.travel_radius * sceneRadius(ctx)) / Math.max(zoom, 0.01);
  const phase = t * cfg.travel_speed;
  let px = 0, pz = 0;
  switch (cfg.path_shape) {
    case "lemniscate":
      px = radius * Math.sin(phase);
      pz = radius * Math.sin(phase) * Math.cos(phase);
      break;
    case "line-scan":
      px = radius * Math.cos(phase);
      pz = radius * 0.35 * Math.sin(phase * 0.35);
      break;
    case "circle":
    default:
      px = radius * Math.cos(phase);
      pz = radius * Math.sin(phase);
      break;
  }
  const baseY = cfg.camera_height + cfg.plane_height;
  const pos: Vec3 = [ctx.centroid[0] + px, baseY, ctx.centroid[2] + pz];
  const tilt = cfg.tilt_angle;
  const target: Vec3 = [ctx.centroid[0], ctx.centroid[1] + cfg.plane_height, ctx.centroid[2]];
  const up: Vec3 = vecNormalize([Math.sin(tilt) * 0.2, Math.cos(tilt), Math.cos(tilt) * 0.05]);
  return smoothPose({ position: pos, target, up }, stability, prev);
}

// --- mode: drone-ghost (unchanged) -----------------------------------

function droneGhostPose(
  program: CameraProgram,
  ctx: CameraContext,
  t: number,
  zoom: number,
  stability: number,
  prev: CameraPose | null
): CameraPose {
  const cfg = program.drone_ghost;
  const r = (cfg.radius_scale * sceneRadius(ctx)) / Math.max(zoom, 0.01);
  const bias = cfg.center_bias;
  const speed = cfg.speed * 0.6;
  const angles: Vec3 = [Math.sin(t * speed), Math.cos(t * speed * 1.3), Math.sin(t * speed * 0.7)];
  const offset: Vec3 =
    cfg.mode === "spherical"
      ? vecNormalize(angles)
      : [angles[0] * 0.8, angles[2] * 0.45 + 0.2 * Math.cos(t * 0.5), angles[1] * 0.8];
  const position = vecAdd(vecScale(ctx.centroid, bias), vecScale(vecNormalize(offset), r));
  const target = vecAdd(ctx.centroid, vecScale(offset, 0.5));
  return smoothPose({ position, target, up: [0, 1, 0] }, stability, prev);
}

// --- mode: lobe-focus (unchanged) ------------------------------------

function lobeFocusPose(
  program: CameraProgram,
  ctx: CameraContext,
  t: number,
  zoom: number,
  stability: number,
  prev: CameraPose | null
): CameraPose {
  if (!ctx.lobeLabels || ctx.lobeLabels.length === 0) {
    return orbitPose(program, ctx, t, zoom, stability, prev);
  }
  const cfg = program.lobe_focus;
  const lobeCenters: Vec3[] = [];
  ctx.lobeLabels.forEach((labels, trajIdx) => {
    const traj = ctx.trajectories[trajIdx];
    if (!traj) return;
    const sums: Record<number, { p: Vec3; n: number }> = {};
    labels.forEach((label, i) => {
      const p = traj[i];
      if (!p) return;
      if (!sums[label]) sums[label] = { p: [0, 0, 0], n: 0 };
      const s = sums[label];
      s.p[0] += p[0]; s.p[1] += p[1]; s.p[2] += p[2]; s.n += 1;
    });
    Object.values(sums).forEach((s) => {
      if (s.n > 0) lobeCenters.push([s.p[0] / s.n, s.p[1] / s.n, s.p[2] / s.n]);
    });
  });
  if (lobeCenters.length === 0) return orbitPose(program, ctx, t, zoom, stability, prev);

  const cycle = cfg.dwell_time + cfg.transition_time;
  const phase = t % Math.max(cycle, 0.001);
  const idx = cfg.cycle_mode === "random"
    ? Math.floor(hash01(ctx.randomSeed + Math.floor(t / cycle)) * lobeCenters.length)
    : Math.floor(Math.floor(t / cycle) % lobeCenters.length);
  const nextIdx = (idx + 1) % lobeCenters.length;
  const mix = clamp(phase / Math.max(cfg.transition_time, 0.001) - (cfg.dwell_time / Math.max(cfg.transition_time, 0.001)), 0, 1);
  const center = mix > 0 ? vecLerp(lobeCenters[idx], lobeCenters[nextIdx], mix) : lobeCenters[idx];

  const orbit = program.orbit;
  const localT = t * 0.6;
  const baseRadius = ((cfg.zoom_outer - cfg.zoom_inner) * mix + cfg.zoom_inner) * sceneRadius(ctx) / Math.max(zoom, 0.01);
  const az = localT * orbit.azimuth_speed;
  const polar = orbit.polar_center + orbit.polar_amplitude * Math.sin(localT * orbit.polar_speed);
  const x = baseRadius * Math.sin(polar) * Math.cos(az);
  const y = baseRadius * Math.cos(polar);
  const z = baseRadius * Math.sin(polar) * Math.sin(az);
  const position = vecAdd(center, [x, y, z]);
  return smoothPose({ position, target: center, up: [0, 1, 0] }, stability, prev);
}

// --- pose smoothing ---------------------------------------------------

function smoothPose(targetPose: CameraPose, stability: number, prevPose: CameraPose | null): CameraPose {
  if (!prevPose || stability <= 0) return targetPose;
  const blend = clamp(1 - stability * 0.5, 0.1, 1);
  const pos = vecLerp(prevPose.position, targetPose.position, blend);
  const tgt = vecLerp(prevPose.target, targetPose.target, blend);
  const up = vecNormalize(vecLerp(prevPose.up, targetPose.up, blend));
  return { position: pos, target: tgt, up };
}

// --- entry point ------------------------------------------------------

export function computeCameraPose(program: CameraProgram, ctx: CameraContext, prevPose: CameraPose | null): CameraPose {
  const t = ctx.t * program.speed_scalar;
  const zoom = program.zoom_scalar;
  const stability = clamp(program.stability, 0, 1);

  switch (program.mode as CameraMode) {
    case "orbit":         return orbitPose(program, ctx, t, zoom, stability, prevPose);
    case "path-rider":    return pathRiderPose(program, ctx, t, zoom, stability, prevPose);
    case "grid-surface":  return gridSurfacePose(program, ctx, t, zoom, stability, prevPose);
    case "drone-ghost":   return droneGhostPose(program, ctx, t, zoom, stability, prevPose);
    case "lobe-focus":    return lobeFocusPose(program, ctx, t, zoom, stability, prevPose);
    default:              return orbitPose(program, ctx, t, zoom, stability, prevPose);
  }
}
