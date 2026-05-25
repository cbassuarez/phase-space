import type {
  CameraContext,
  CameraMode,
  CameraPose,
  CameraProgram,
  ChaseLoopMode,
  SurveyCameraConfig,
} from "./types";
import {
  getCameraMotionState,
  parallelTransport,
  rotateAroundAxis,
  slerp,
  smoothstep,
  springVec3,
  vecAdd,
  vecCross,
  vecDot,
  vecLen,
  vecLerp,
  vecNormalize,
  vecScale,
  vecSub,
  type Vec3,
} from "./smoothing";
import {
  autoLobeCount,
  boundingSphereFromAABB,
  fitDistanceForFov,
  lobeCentersFromTrajectory,
} from "./framing";

const FOV_Y = Math.PI / 4; // matches Canvas fov={45}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

function hash01(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function sceneRadius(ctx: CameraContext): number {
  const span = vecSub(ctx.bboxMax, ctx.bboxMin);
  const diag = vecLen(span);
  return diag > 0 ? diag * 0.35 : 10;
}

// --- arc-length cache -------------------------------------------------

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

function pointAtArcLength(
  traj: readonly Vec3[],
  cache: ArcLengthCache,
  s: number
): Vec3 {
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

function wrapArcLength(s: number, total: number, mode: ChaseLoopMode): number {
  if (total <= 0) return 0;
  if (mode === "clamp") return clamp(s, 0, total);
  if (mode === "wrap") return ((s % total) + total) % total;
  const period = total * 2;
  const m = ((s % period) + period) % period;
  return m > total ? period - m : m;
}

// --- mode: survey -----------------------------------------------------

function surveyDirection(t: number, cfg: SurveyCameraConfig): Vec3 {
  let yawBase: number;
  let pitch: number;
  switch (cfg.dir_preset) {
    case "front":
      yawBase = 0;
      pitch = 0.18;
      break;
    case "top":
      yawBase = 0;
      pitch = 1.3;
      break;
    case "iso":
    default:
      yawBase = Math.PI * 0.35;
      pitch = 0.5;
      break;
  }
  if (cfg.pitch && Math.abs(cfg.pitch) > 1e-3) pitch = cfg.pitch;
  const yaw = cfg.rotate ? yawBase + t * cfg.rotate_speed : yawBase;
  const cp = Math.cos(pitch);
  return [cp * Math.cos(yaw), Math.sin(pitch), cp * Math.sin(yaw)];
}

function surveyPose(program: CameraProgram, ctx: CameraContext, t: number): CameraPose {
  const cfg = program.survey;
  const sphere = boundingSphereFromAABB(ctx.bboxMin, ctx.bboxMax);
  const aspect = ctx.aspect > 0 ? ctx.aspect : 16 / 9;
  const d = fitDistanceForFov(sphere.radius, FOV_Y, aspect, Math.max(1, cfg.margin));
  const dir = surveyDirection(t, cfg);
  const pos = vecAdd(sphere.center, vecScale(dir, d));
  return { position: pos, target: sphere.center, up: [0, 1, 0] };
}

// --- mode: orbit ------------------------------------------------------

function orbitPose(program: CameraProgram, ctx: CameraContext, t: number): CameraPose {
  const cfg = program.orbit;
  const r = sceneRadius(ctx) * Math.max(0.1, cfg.base_radius);
  const az = t * cfg.azimuth_speed * 2 * Math.PI;
  const polar = cfg.polar_center + cfg.polar_amplitude * Math.sin(t * cfg.polar_speed);
  const sp = Math.sin(polar);
  const pos = vecAdd(ctx.centroid, [
    r * sp * Math.cos(az),
    r * Math.cos(polar),
    r * sp * Math.sin(az),
  ]);
  return {
    position: pos,
    target: [ctx.centroid[0], ctx.centroid[1], ctx.centroid[2]],
    up: [0, 1, 0],
  };
}

// --- mode: chase ------------------------------------------------------

function chasePose(program: CameraProgram, ctx: CameraContext, t: number): CameraPose {
  const cfg = program.chase;
  const trajList = ctx.trajectories;
  if (!trajList.length) return surveyPose(program, ctx, t);
  const idx = clamp(
    Math.floor(cfg.trajectory_index),
    0,
    Math.max(0, trajList.length - 1)
  );
  const traj = trajList[idx] as Vec3[] | undefined;
  if (!traj || traj.length < 4) return surveyPose(program, ctx, t);

  const cache = getArcLengthCache(traj);
  if (cache.totalLength <= 1e-6) return surveyPose(program, ctx, t);

  const motion = getCameraMotionState(traj);
  const scene = sceneRadius(ctx);

  // Persisted arc position. Integrates by dt so pausing the sim doesn't
  // teleport the camera and changing trajectories starts fresh.
  const cruiseSpeed =
    cache.totalLength * 0.05 * Math.max(0.01, cfg.time_scale);
  const dt = Math.max(ctx.dt, 1e-4);
  motion.sArc = wrapArcLength(
    motion.sArc + cruiseSpeed * dt,
    cache.totalLength,
    cfg.loop_mode
  );
  const s = motion.sArc;

  // Sampling: five points around s for tangent + curvature estimation.
  const lookAhead = scene * Math.max(0.05, cfg.look_ahead);
  const avgSeg = cache.totalLength / Math.max(1, traj.length - 1);
  const tangentWindow = Math.max(avgSeg * 3, lookAhead * 0.18);

  const sBehind = wrapArcLength(s - tangentWindow, cache.totalLength, cfg.loop_mode);
  const sAhead = wrapArcLength(s + tangentWindow, cache.totalLength, cfg.loop_mode);
  const sTarget = wrapArcLength(s + lookAhead, cache.totalLength, cfg.loop_mode);
  const sFar = wrapArcLength(
    s + lookAhead + tangentWindow,
    cache.totalLength,
    cfg.loop_mode
  );

  const pCurrent = pointAtArcLength(traj, cache, s);
  const pBehind = pointAtArcLength(traj, cache, sBehind);
  const pAhead = pointAtArcLength(traj, cache, sAhead);
  const pTarget = pointAtArcLength(traj, cache, sTarget);
  const pFar = pointAtArcLength(traj, cache, sFar);

  // Tangent — smoothed via slerp against the previous frame's tangent.
  // Slerp picks the short arc, eliminating frame-to-frame sign flips.
  const rawTangent = vecNormalize(vecSub(pAhead, pBehind));
  const tangentBlend = 1 - Math.exp(-6 * dt);
  const tangent = motion.prevTangent
    ? slerp(motion.prevTangent, rawTangent, tangentBlend)
    : rawTangent;
  motion.prevTangent = tangent;

  // Curvature direction (the "binormal" — really the unit vector of
  // d(tangent)/ds — points into the curve). Hold the previous value
  // when curvature collapses instead of snapping to world-up.
  const tangentBack = vecNormalize(vecSub(pCurrent, pBehind));
  const tangentFar = vecNormalize(vecSub(pFar, pTarget));
  const curveDir: Vec3 = [
    tangentFar[0] - tangentBack[0],
    tangentFar[1] - tangentBack[1],
    tangentFar[2] - tangentBack[2],
  ];
  const curveMag = vecLen(curveDir);
  const binormal =
    curveMag > 1e-4
      ? vecNormalize(curveDir)
      : motion.prevBinormal ?? [0, 1, 0];
  motion.prevBinormal = binormal;

  // Up vector via one-step parallel transport from the previous frame's
  // up. This preserves frame coherence; the up vector cannot flip.
  const seedUp: Vec3 = motion.prevUp ?? [0, 1, 0];
  let up = parallelTransport(seedUp, tangent);

  // Banking: rotate up around tangent by an angle proportional to
  // curvature. Smoothstep replaces the old hard saturation.
  if (cfg.bank_strength > 1e-3) {
    const maxAngle = 0.44; // ~25 degrees
    const bankT = smoothstep(0.05, 0.3, curveMag);
    // Direction of bank: positive when the curve bends toward the
    // camera's right (tangent × up). Negate so the camera leans into
    // the turn (top tilts toward the inside).
    const right = vecCross(tangent, up);
    const sideSign = vecDot(binormal, right) >= 0 ? -1 : 1;
    const bankAngle = cfg.bank_strength * bankT * maxAngle * sideSign;
    up = rotateAroundAxis(up, tangent, bankAngle);
  }
  motion.prevUp = up;

  // Chase geometry — both distances scaled by sceneRadius so the look
  // is consistent across attractors and independent of segment density.
  const chaseDist = scene * Math.max(0.02, cfg.chase_distance);
  const rideH = scene * Math.max(0, cfg.ride_height);
  const position: Vec3 = [
    pCurrent[0] - tangent[0] * chaseDist + up[0] * rideH,
    pCurrent[1] - tangent[1] * chaseDist + up[1] * rideH,
    pCurrent[2] - tangent[2] * chaseDist + up[2] * rideH,
  ];

  return { position, target: pTarget, up };
}

// --- mode: lobe -------------------------------------------------------

function lobePose(program: CameraProgram, ctx: CameraContext, t: number): CameraPose {
  const cfg = program.lobe;
  const trajList = ctx.trajectories;
  if (!trajList.length) return surveyPose(program, ctx, t);
  const idx = Math.max(0, Math.min(trajList.length - 1, ctx.primaryTrajectoryIndex));
  const traj = trajList[idx] as Vec3[] | undefined;
  if (!traj || traj.length < 8) return surveyPose(program, ctx, t);

  const k =
    cfg.lobe_count === "auto"
      ? autoLobeCount(ctx.bboxMin, ctx.bboxMax)
      : cfg.lobe_count;
  const centers = lobeCentersFromTrajectory(traj, k);
  if (centers.length === 0) return surveyPose(program, ctx, t);

  const cycle = Math.max(0.05, cfg.dwell_time + cfg.transition_time);
  const phase = ((t % cycle) + cycle) % cycle;
  const cycleIndex = Math.floor(t / cycle);
  const i =
    cfg.cycle_mode === "random"
      ? Math.floor(hash01(ctx.randomSeed + cycleIndex) * centers.length)
      : ((cycleIndex % centers.length) + centers.length) % centers.length;
  const nextI = (i + 1) % centers.length;
  const transitionPhase =
    cfg.transition_time > 1e-3
      ? clamp((phase - cfg.dwell_time) / cfg.transition_time, 0, 1)
      : phase >= cfg.dwell_time
        ? 1
        : 0;
  const mix = smoothstep(0, 1, transitionPhase);
  const center: Vec3 =
    mix > 0 ? vecLerp(centers[i], centers[nextI], mix) : centers[i];

  const orbit = program.orbit;
  const r = sceneRadius(ctx) * Math.max(0.25, cfg.zoom) * 0.6;
  const az = t * Math.max(0.02, orbit.azimuth_speed) * 2 * Math.PI;
  const polar =
    orbit.polar_center + orbit.polar_amplitude * Math.sin(t * orbit.polar_speed);
  const sp = Math.sin(polar);
  const position = vecAdd(center, [
    r * sp * Math.cos(az),
    r * Math.cos(polar),
    r * sp * Math.sin(az),
  ]);
  return { position, target: center, up: [0, 1, 0] };
}

// --- central smoothing pipeline ---------------------------------------

interface GlobalCameraState {
  pose: CameraPose | null;
  posVel: Vec3;
  tgtVel: Vec3;
  lastMode: CameraMode | null;
}

const globalState: GlobalCameraState = {
  pose: null,
  posVel: [0, 0, 0],
  tgtVel: [0, 0, 0],
  lastMode: null,
};

function resetGlobalState(pose: CameraPose, mode: CameraMode) {
  globalState.pose = pose;
  globalState.posVel = [0, 0, 0];
  globalState.tgtVel = [0, 0, 0];
  globalState.lastMode = mode;
}

function applyZoom(pose: CameraPose, zoom: number): CameraPose {
  if (Math.abs(zoom - 1) < 1e-3) return pose;
  const fromTarget = vecSub(pose.position, pose.target);
  const z = Math.max(0.05, zoom);
  return {
    position: vecAdd(pose.target, vecScale(fromTarget, z)),
    target: pose.target,
    up: pose.up,
  };
}

export function computeCameraPose(
  program: CameraProgram,
  ctx: CameraContext,
  prevPose: CameraPose | null
): CameraPose {
  const t = ctx.t * program.speed_scalar;
  const zoom = program.zoom_scalar;
  const stability = clamp(program.stability, 0, 1);

  let raw: CameraPose;
  switch (program.mode as CameraMode) {
    case "survey":
      raw = surveyPose(program, ctx, t);
      break;
    case "orbit":
      raw = orbitPose(program, ctx, t);
      break;
    case "chase":
      raw = chasePose(program, ctx, t);
      break;
    case "lobe":
      raw = lobePose(program, ctx, t);
      break;
    default:
      raw = surveyPose(program, ctx, t);
  }
  const target = applyZoom(raw, zoom);

  // Reset internal state when the host drops the previous pose (system
  // reload) or when the mode changes — both cases want a fresh snap.
  if (
    !prevPose ||
    !globalState.pose ||
    globalState.lastMode !== program.mode
  ) {
    resetGlobalState(target, program.mode);
    return target;
  }

  const dt = Math.max(ctx.dt, 1e-4);
  // High stability → low omega → slower spring. Range tuned so the
  // default stability (0.25) gives a snappy-but-smooth response.
  const omegaPos = 3 + (1 - stability) * 13;
  const omegaTgt = 5 + (1 - stability) * 15;

  const posOut = springVec3(
    globalState.pose.position,
    target.position,
    globalState.posVel,
    omegaPos,
    dt
  );
  const tgtOut = springVec3(
    globalState.pose.target,
    target.target,
    globalState.tgtVel,
    omegaTgt,
    dt
  );
  globalState.posVel = posOut.velocity;
  globalState.tgtVel = tgtOut.velocity;

  const upBlend = 1 - Math.exp(-omegaTgt * dt);
  const up = slerp(globalState.pose.up, target.up, upBlend);

  globalState.pose = {
    position: posOut.value,
    target: tgtOut.value,
    up,
  };
  return globalState.pose;
}
