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
import { cameraInput } from "./cameraInput";
import { CAMERA_MODE_GLIDE_TAU } from "../visual/transitionConfig";

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

/**
 * Triangular-weighted average of the curve over an arc-length window of
 * ±halfSpan around `s`. This low-passes the trajectory so a chase camera
 * glides through the mean flow of the attractor instead of tracing every
 * high-frequency curl — the single biggest source of chase-mode jitter
 * and angular "G" spikes on chaotic systems.
 */
function smoothedPointAtArcLength(
  traj: readonly Vec3[],
  cache: ArcLengthCache,
  s: number,
  halfSpan: number,
  mode: ChaseLoopMode,
  samplesPerSide = 5
): Vec3 {
  if (halfSpan <= 1e-6) return pointAtArcLength(traj, cache, s);
  let x = 0;
  let y = 0;
  let z = 0;
  let wSum = 0;
  for (let i = -samplesPerSide; i <= samplesPerSide; i++) {
    const f = i / samplesPerSide; // -1..1
    const w = 1 - Math.abs(f); // triangular kernel
    if (w <= 0) continue;
    const sub = wrapArcLength(s + f * halfSpan, cache.totalLength, mode);
    const p = pointAtArcLength(traj, cache, sub);
    x += p[0] * w;
    y += p[1] * w;
    z += p[2] * w;
    wSum += w;
  }
  const inv = wSum > 1e-9 ? 1 / wSum : 0;
  return [x * inv, y * inv, z * inv];
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

// Survey speed spectrum. The linear 0.25→2.0 Speed range left the gentle low
// end nice but the top too slow, so apply a super-linear curve anchored at the
// low end: f(0.25) ≈ 0.25 (unchanged) while f(2.0) ≈ 16 (~8× the linear top).
function surveySpeedFactor(speedScalar: number): number {
  const s = Math.max(0.05, speedScalar);
  const p = 2.0;
  return Math.pow(s, p) * Math.pow(0.25, 1 - p);
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
  //
  // Speed is tied to *scene scale*, not raw arc length: arc length grows
  // with the integration resolution (more steps → longer summed length),
  // which used to make the camera fly faster at higher resolution and
  // tear through tightly-wound attractors. scene-relative cruise keeps
  // the pace identical across resolutions and calm on chaotic systems.
  // The global Speed control scales the cruise too (chase used to ignore it).
  // The 0.6 trims the overall pace down (top and bottom) for a calmer ride.
  const cruiseSpeed =
    scene * 0.6 * Math.max(0.05, program.speed_scalar) * Math.max(0.01, cfg.time_scale);
  // Clamp dt: a frame hitch (GC, tab refocus) otherwise advances sArc by a
  // huge step and lurches the camera down the path. Cap at ~1/30s so the
  // worst a stutter does is briefly slow the cruise, never pop.
  const dt = clamp(ctx.dt, 1e-4, 1 / 30);
  motion.sArc = wrapArcLength(
    motion.sArc + cruiseSpeed * dt,
    cache.totalLength,
    cfg.loop_mode
  );
  const s = motion.sArc;

  const lookAhead = scene * Math.max(0.05, cfg.look_ahead);
  // Low-pass window for the path samples. Tied to the look-ahead/scene so
  // the smoothing scales with the framing. Larger → calmer, more
  // corner-cutting; smaller → tighter to the true curve.
  const smoothSpan = Math.max(lookAhead * 0.85, scene * 0.18);

  // Anchor (where the camera rides) and the look-ahead point are both
  // sampled from the *smoothed* curve, so the camera glides through the
  // mean flow rather than tracing every micro-curl.
  const anchor = smoothedPointAtArcLength(traj, cache, s, smoothSpan, cfg.loop_mode);
  const ahead = smoothedPointAtArcLength(
    traj,
    cache,
    s + lookAhead,
    smoothSpan,
    cfg.loop_mode
  );

  // Tangent from the smoothed anchor→ahead chord, slerped against the
  // previous frame for extra steadiness. Slerp picks the short arc,
  // eliminating frame-to-frame sign flips.
  const rawTangent = vecNormalize(
    vecSub(ahead, anchor),
    motion.prevTangent ?? [0, 0, 1]
  );
  const tangentBlend = 1 - Math.exp(-4 * dt);
  const tangent = motion.prevTangent
    ? slerp(motion.prevTangent, rawTangent, tangentBlend)
    : rawTangent;
  motion.prevTangent = tangent;

  // Curvature direction for banking, measured between smoothed tangents
  // behind and ahead. Hold the previous value when curvature collapses
  // instead of snapping to world-up.
  const behind = smoothedPointAtArcLength(
    traj,
    cache,
    s - smoothSpan,
    smoothSpan,
    cfg.loop_mode
  );
  const far = smoothedPointAtArcLength(
    traj,
    cache,
    s + lookAhead + smoothSpan,
    smoothSpan,
    cfg.loop_mode
  );
  const tangentBack = vecNormalize(vecSub(anchor, behind), tangent);
  const tangentFar = vecNormalize(vecSub(far, ahead), tangent);
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
  // curvature. Smoothstep replaces the old hard saturation, and the
  // angle itself is eased over time so the roll never twitches.
  if (cfg.bank_strength > 1e-3) {
    const maxAngle = 0.44; // ~25 degrees
    const bankT = smoothstep(0.05, 0.3, curveMag);
    // Direction of bank: positive when the curve bends toward the
    // camera's right (tangent × up). Negate so the camera leans into
    // the turn (top tilts toward the inside).
    const right = vecCross(tangent, up);
    const sideSign = vecDot(binormal, right) >= 0 ? -1 : 1;
    const targetBank = cfg.bank_strength * bankT * maxAngle * sideSign;
    const bankBlend = 1 - Math.exp(-4 * dt);
    const bankAngle =
      motion.prevBankAngle + (targetBank - motion.prevBankAngle) * bankBlend;
    motion.prevBankAngle = bankAngle;
    up = rotateAroundAxis(up, tangent, bankAngle);
  } else {
    motion.prevBankAngle = 0;
  }
  motion.prevUp = up;

  // Chase geometry — both distances scaled by sceneRadius so the look
  // is consistent across attractors and independent of segment density.
  const chaseDist = scene * Math.max(0.02, cfg.chase_distance);
  const rideH = scene * Math.max(0, cfg.ride_height);
  const position: Vec3 = [
    anchor[0] - tangent[0] * chaseDist + up[0] * rideH,
    anchor[1] - tangent[1] * chaseDist + up[1] * rideH,
    anchor[2] - tangent[2] * chaseDist + up[2] * rideH,
  ];

  return { position, target: ahead, up };
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

// --- mode: free -------------------------------------------------------

// A fixed iso overview to start orbiting from. Free mode holds this static
// pose as its "program"; the user grab (below) does all the motion.
function freePose(program: CameraProgram, ctx: CameraContext): CameraPose {
  const sphere = boundingSphereFromAABB(ctx.bboxMin, ctx.bboxMax);
  const aspect = ctx.aspect > 0 ? ctx.aspect : 16 / 9;
  const d = fitDistanceForFov(sphere.radius, FOV_Y, aspect, Math.max(1, program.survey.margin));
  const yaw = Math.PI * 0.35;
  const pitch = 0.5;
  const cp = Math.cos(pitch);
  const dir: Vec3 = [cp * Math.cos(yaw), Math.sin(pitch), cp * Math.sin(yaw)];
  return { position: vecAdd(sphere.center, vecScale(dir, d)), target: sphere.center, up: [0, 1, 0] };
}

// --- user grab: free orbit + universal latch --------------------------

interface GrabState {
  active: boolean;
  weight: number; // 0 = program owns the camera, 1 = user owns it
  theta: number;
  phi: number;
  logR: number;
  thetaVel: number;
  phiVel: number;
  logRVel: number;
}

const grab: GrabState = {
  active: false,
  weight: 0,
  theta: 0,
  phi: 1,
  logR: 2,
  thetaVel: 0,
  phiVel: 0,
  logRVel: 0,
};

const PHI_MIN = 0.12;
const PHI_MAX = Math.PI - 0.12;

// "Return to home": when true (default), a grab in an autonomous mode eases
// back to the program pose after you let go. When false, the grab stays
// latched (like free mode) so the camera holds the position you moved it to.
let returnToHomeEnabled = true;
export function setCameraReturnToHome(value: boolean) {
  returnToHomeEnabled = value;
}

// Program spherical from the previous frame. Lets a non-returning grab carry the
// program's ongoing motion (auto-spin/orbit) so the camera keeps moving at the
// new offset instead of freezing where you let go.
let lastProg: { theta: number; phi: number; logR: number } | null = null;

function resetGrab() {
  grab.active = false;
  grab.weight = 0;
  grab.thetaVel = 0;
  grab.phiVel = 0;
  grab.logRVel = 0;
}

function sphericalFromOffset(offset: Vec3): { theta: number; phi: number; r: number } {
  const r = Math.max(1e-4, vecLen(offset));
  return {
    theta: Math.atan2(offset[2], offset[0]),
    phi: Math.acos(clamp(offset[1] / r, -1, 1)),
    r,
  };
}

/**
 * Applies user drag on top of the program pose. Acceleration comes from the
 * drag rate, inertia from coasting velocity, friction from `stability`. The
 * grab weight snaps on while grabbing/coasting and — in autonomous modes —
 * eases back to 0 so the cinematic program smoothly resumes (free mode latches
 * at 1, parking the camera where it's left).
 */
function applyGrab(programPose: CameraPose, program: CameraProgram, dt: number): CameraPose {
  const input = cameraInput.consume();
  const isFree = program.mode === "free";
  const stability = clamp(program.stability, 0, 1);
  const gain = 0.8 + clamp(program.speed_scalar, 0.1, 3) * 0.5;

  const target = programPose.target;
  const prog = sphericalFromOffset(vecSub(programPose.position, target));
  const progLogR = Math.log(prog.r);
  const prevProg = lastProg;
  lastProg = { theta: prog.theta, phi: prog.phi, logR: progLogR };

  // Seed the orbit from the current framing the moment a grab starts from
  // rest, so the take-over is seamless. Wheel (zoom) counts as a grab too.
  const interacting = isFree || input.dragging || input.pendingZoom !== 0;
  if (!grab.active && interacting) {
    grab.theta = prog.theta;
    grab.phi = prog.phi;
    grab.logR = Math.log(prog.r);
    grab.thetaVel = grab.phiVel = grab.logRVel = 0;
    grab.active = true;
  }

  if (grab.active) {
    // Free mode is pure inertia: very low friction → a long, expressive glide
    // (no program to fall back to). Autonomous modes keep a snappier coast
    // since the program reasserts on release. Stability scales both.
    const frictionRate = isFree ? 0.25 + stability * 1.6 : 1.8 + stability * 7;
    const friction = Math.exp(-frictionRate * dt);

    // Orbit: track the cursor while dragging, coast on release. Velocity is an
    // EMA updated ONLY on real movement — frames without a pointermove event
    // must not reset it to zero (that was the dead-stop bug); holding still
    // while pressed bleeds momentum instead.
    if (input.dragging) {
      const dTheta = input.pendingYaw * gain;
      const dPhi = input.pendingPitch * gain;
      grab.theta += dTheta;
      grab.phi = clamp(grab.phi + dPhi, PHI_MIN, PHI_MAX);
      if (input.pendingYaw !== 0 || input.pendingPitch !== 0) {
        const a = 0.5;
        grab.thetaVel += (dTheta / dt - grab.thetaVel) * a;
        grab.phiVel += (dPhi / dt - grab.phiVel) * a;
      } else {
        grab.thetaVel *= 0.82;
        grab.phiVel *= 0.82;
      }
    } else {
      grab.theta += grab.thetaVel * dt;
      grab.phi = clamp(grab.phi + grab.phiVel * dt, PHI_MIN, PHI_MAX);
      grab.thetaVel *= friction;
      grab.phiVel *= friction;
      // "Return to home" off: carry the program's autonomous motion into the
      // grab so the camera keeps orbiting/spinning from the offset vantage
      // instead of freezing at the spot you released.
      if (!returnToHomeEnabled && !isFree && prevProg) {
        grab.theta += Math.atan2(
          Math.sin(prog.theta - prevProg.theta),
          Math.cos(prog.theta - prevProg.theta)
        );
        grab.phi = clamp(grab.phi + (prog.phi - prevProg.phi), PHI_MIN, PHI_MAX);
        grab.logR += progLogR - prevProg.logR;
      }
    }

    // Zoom: wheel impulses any time (independent of dragging), then coasts.
    if (input.pendingZoom !== 0) {
      grab.logR += input.pendingZoom;
      grab.logRVel = input.pendingZoom / dt;
    } else {
      grab.logR += grab.logRVel * dt;
      grab.logRVel *= friction;
    }
  }

  const velMag = Math.abs(grab.thetaVel) + Math.abs(grab.phiVel) + Math.abs(grab.logRVel);
  // With "return to home" off, a grab that's already engaged stays latched
  // (like free mode) instead of easing back to the program pose.
  const latched = !returnToHomeEnabled && grab.active;
  const want = isFree || latched || input.dragging || input.pendingZoom !== 0 || velMag > 0.02 ? 1 : 0;
  const rate = want > grab.weight ? 18 : 1.1; // snap on, ease off (gradual unlatch)
  grab.weight += (want - grab.weight) * (1 - Math.exp(-rate * dt));

  if (!isFree && !latched && !input.dragging && grab.weight < 4e-3) {
    // Fully returned to the program — drop the grab so the next one re-seeds.
    resetGrab();
    return programPose;
  }
  if (grab.weight < 1e-4) return programPose;

  const r = Math.exp(grab.logR);
  const sp = Math.sin(grab.phi);
  const grabPos: Vec3 = [
    target[0] + r * sp * Math.cos(grab.theta),
    target[1] + r * Math.cos(grab.phi),
    target[2] + r * sp * Math.sin(grab.theta),
  ];
  const w = grab.weight;
  return {
    position: vecLerp(programPose.position, grabPos, w),
    target,
    up: slerp(programPose.up, [0, 1, 0], w),
  };
}

// --- central smoothing pipeline ---------------------------------------

interface GlobalCameraState {
  pose: CameraPose | null;
  posVel: Vec3;
  tgtVel: Vec3;
  lastMode: CameraMode | null;
  // Drives the soft→tight spring ramp after a mode change. Infinity = at rest.
  modeGlideT: number;
}

const globalState: GlobalCameraState = {
  pose: null,
  posVel: [0, 0, 0],
  tgtVel: [0, 0, 0],
  lastMode: null,
  modeGlideT: Infinity,
};

function resetGlobalState(pose: CameraPose, mode: CameraMode) {
  globalState.pose = pose;
  globalState.posVel = [0, 0, 0];
  globalState.tgtVel = [0, 0, 0];
  globalState.lastMode = mode;
  globalState.modeGlideT = Infinity;
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
      // Survey rides its own super-linear speed curve (faster high end).
      raw = surveyPose(program, ctx, ctx.t * surveySpeedFactor(program.speed_scalar));
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
    case "free":
      raw = freePose(program, ctx);
      break;
    default:
      raw = surveyPose(program, ctx, t);
  }
  const target = applyZoom(raw, zoom);

  // A true reset (host dropped the pose on system reload, or first frame)
  // snaps to fresh data. A mode change does NOT snap — we keep the settled
  // pose/velocity and let the spring below ease from the old mode's framing
  // to the new mode's target, for a cinematic cut between modes.
  if (!prevPose || !globalState.pose) {
    resetGlobalState(target, program.mode);
    resetGrab();
    return target;
  }
  if (globalState.lastMode !== program.mode) {
    globalState.lastMode = program.mode;
    globalState.modeGlideT = 0; // start the soft→tight glide ramp
  }

  const dt = clamp(ctx.dt, 1e-4, 1 / 30);

  // After a mode change the spring starts soft (slow, floaty) and tightens
  // back to normal over CAMERA_MODE_GLIDE_TAU, so the transition glides in
  // rather than snapping or whipping.
  let glide = 1;
  if (Number.isFinite(globalState.modeGlideT)) {
    globalState.modeGlideT = Math.min(1, globalState.modeGlideT + dt / CAMERA_MODE_GLIDE_TAU);
    glide = 0.35 + 0.65 * smoothstep(0, 1, globalState.modeGlideT);
    if (globalState.modeGlideT >= 1) globalState.modeGlideT = Infinity;
  }

  // High stability → low omega → slower spring. Range tuned so the
  // default stability (0.25) gives a snappy-but-smooth response.
  // Chase rides an already-smoothed path, so it gets a softer, floatier
  // follow (omega scaled down) for a cinematic glide rather than a tight
  // lock to the curve. The stability slider still scales it relatively.
  const omegaScale = (program.mode === "chase" ? 0.6 : 1) * glide;
  const omegaPos = (3 + (1 - stability) * 13) * omegaScale;
  const omegaTgt = (5 + (1 - stability) * 15) * omegaScale;

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
  // The program pose is settled — now layer the user grab (orbit + inertia)
  // on top. Returns the program pose untouched when nothing is grabbed.
  return applyGrab(globalState.pose, program, dt);
}
