import type {
  CameraContext,
  CameraMode,
  CameraPose,
  CameraProgram,
} from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function vecAdd(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecScale(a: [number, number, number], s: number): [number, number, number] {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vecLen(a: [number, number, number]) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function vecNormalize(a: [number, number, number]): [number, number, number] {
  const len = vecLen(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

function vecLerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
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

function orbitPose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
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

  return smoothPose({ position: pos, target: ctx.centroid, up: [0, 1, 0] }, stability, null);
}

function wrapIndex(idx: number, len: number, mode: "wrap" | "ping-pong" | "clamp") {
  if (len === 0) return 0;
  if (mode === "clamp") return clamp(idx, 0, len - 1);
  if (mode === "wrap") return ((idx % len) + len) % len;
  // ping-pong
  const period = Math.max(1, len * 2 - 2);
  const m = ((idx % period) + period) % period;
  return m >= len ? period - m : m;
}

function getTrajectoryPoint(traj: [number, number, number][], idx: number, mode: "wrap" | "ping-pong" | "clamp") {
  const clamped = wrapIndex(idx, traj.length, mode);
  return traj[clamped] ?? traj[traj.length - 1];
}

function pathRiderPose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
  const cfg = program.path_rider;
  const idx = clamp(Math.floor(cfg.trajectory_index), 0, Math.max(0, ctx.trajectories.length - 1));
  const traj = ctx.trajectories[idx];
  if (!traj || traj.length < 2) {
    return orbitPose(program, ctx, t, zoom, stability);
  }

  const time = t * cfg.time_scale;
  const baseIndex = Math.floor(time * 60);
  const ahead = baseIndex + cfg.ahead_offset;

  const current = getTrajectoryPoint(traj, baseIndex, cfg.loop_mode);
  const target = getTrajectoryPoint(traj, ahead, cfg.loop_mode);
  const tangent = vecNormalize(vecSub(target, current));
  const baseUp: [number, number, number] = [0, 1, 0];
  const lateral = vecNormalize(cross(tangent, baseUp));
  const offset = vecScale(lateral, cfg.lateral_offset * sceneRadius(ctx) * 0.2);
  const pos = vecAdd(current, offset);
  const up = vecNormalize(vecAdd(vecScale(baseUp, cfg.up_blend), vecScale(lateral, 1 - cfg.up_blend)));

  const distance = vecLen(vecSub(pos, target)) || 1;
  const adjusted = vecAdd(ctx.centroid, vecScale(vecSub(pos, ctx.centroid), 1 / Math.max(zoom, 0.01)));
  return smoothPose({ position: adjusted, target, up }, stability, null, distance * 0.1);
}

function gridSurfacePose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
  const cfg = program.grid_surface;
  const radius = (cfg.travel_radius * sceneRadius(ctx)) / Math.max(zoom, 0.01);
  const phase = t * cfg.travel_speed;

  let px = 0;
  let pz = 0;
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
  const pos: [number, number, number] = [ctx.centroid[0] + px, baseY, ctx.centroid[2] + pz];
  const tilt = cfg.tilt_angle;
  const target: [number, number, number] = [ctx.centroid[0], ctx.centroid[1] + cfg.plane_height, ctx.centroid[2]];
  const up = vecNormalize([Math.sin(tilt) * 0.2, Math.cos(tilt), Math.cos(tilt) * 0.05]);

  return smoothPose({ position: pos, target, up }, stability, null);
}

function droneGhostPose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
  const cfg = program.drone_ghost;
  const r = (cfg.radius_scale * sceneRadius(ctx)) / Math.max(zoom, 0.01);
  const bias = cfg.center_bias;
  const speed = cfg.speed * 0.6;

  const angles = [Math.sin(t * speed), Math.cos(t * speed * 1.3), Math.sin(t * speed * 0.7)];
  const offset = cfg.mode === "spherical"
    ? vecNormalize([angles[0], angles[1], angles[2]])
    : [angles[0] * 0.8, angles[2] * 0.45 + 0.2 * Math.cos(t * 0.5), angles[1] * 0.8];

  const position = vecAdd(vecScale(ctx.centroid, bias), vecScale(vecNormalize(offset), r));
  const target = vecAdd(ctx.centroid, vecScale(offset, 0.5));
  return smoothPose({ position, target, up: [0, 1, 0] }, stability, null);
}

function lobeFocusPose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
  if (!ctx.lobeLabels || ctx.lobeLabels.length === 0) {
    return orbitPose(program, ctx, t, zoom, stability);
  }
  const cfg = program.lobe_focus;
  const lobeCenters: [number, number, number][] = [];

  ctx.lobeLabels.forEach((labels, trajIdx) => {
    const traj = ctx.trajectories[trajIdx];
    if (!traj) return;
    const sums: Record<number, { p: [number, number, number]; n: number }> = {};
    labels.forEach((label, i) => {
      const p = traj[i];
      if (!p) return;
      if (!sums[label]) {
        sums[label] = { p: [0, 0, 0], n: 0 };
      }
      const s = sums[label];
      s.p[0] += p[0];
      s.p[1] += p[1];
      s.p[2] += p[2];
      s.n += 1;
    });
    Object.values(sums).forEach((s) => {
      if (s.n > 0) {
        lobeCenters.push([s.p[0] / s.n, s.p[1] / s.n, s.p[2] / s.n]);
      }
    });
  });

  if (lobeCenters.length === 0) {
    return orbitPose(program, ctx, t, zoom, stability);
  }

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

  return smoothPose({ position, target: center, up: [0, 1, 0] }, stability, null);
}

function macroMicroPose(program: CameraProgram, ctx: CameraContext, t: number, zoom: number, stability: number): CameraPose {
  const cfg = program.macro_micro;
  const phase = (t % Math.max(cfg.cycle_duration, 0.001)) / Math.max(cfg.cycle_duration, 0.001);
  const microPhase = phase < cfg.micro_hold_fraction;

  const macroCenter = ctx.centroid;
  const macroRadius = (cfg.macro_radius * sceneRadius(ctx)) / Math.max(zoom, 0.01);

  let microCenter: [number, number, number] = macroCenter;
  if (ctx.trajectories.length > 0) {
    const seed = ctx.randomSeed + 17;
    const trajIdx = Math.floor(hash01(seed) * ctx.trajectories.length);
    const traj = ctx.trajectories[trajIdx];
    const pointIdx = Math.floor(hash01(seed * 3.1) * Math.max(1, traj.length - 1));
    microCenter = traj[pointIdx] ?? macroCenter;
  }

  const orbit = program.orbit;
  const localT = t * 0.9;
  const radius = (microPhase ? cfg.micro_radius : cfg.macro_radius) * sceneRadius(ctx) / Math.max(zoom, 0.01);
  const az = localT * orbit.azimuth_speed;
  const polar = orbit.polar_center + orbit.polar_amplitude * Math.sin(localT * orbit.polar_speed);
  const x = radius * Math.sin(polar) * Math.cos(az);
  const y = radius * Math.cos(polar);
  const z = radius * Math.sin(polar) * Math.sin(az);
  const center = microPhase ? microCenter : macroCenter;
  const position = vecAdd(center, [x, y, z]);

  return smoothPose({ position, target: center, up: [0, 1, 0] }, stability, null);
}

function smoothPose(targetPose: CameraPose, stability: number, prevPose: CameraPose | null, biasDistance?: number): CameraPose {
  if (!prevPose || stability <= 0) {
    return targetPose;
  }
  const blend = clamp(1 - stability * 0.5, 0.1, 1);
  const pos = vecLerp(prevPose.position, targetPose.position, blend);
  const tgt = vecLerp(prevPose.target, targetPose.target, blend);
  const up = vecNormalize(vecLerp(prevPose.up, targetPose.up, blend));

  if (biasDistance && vecLen(vecSub(targetPose.position, targetPose.target)) < biasDistance) {
    return { position: targetPose.position, target: tgt, up };
  }

  return { position: pos, target: tgt, up };
}

export function computeCameraPose(program: CameraProgram, ctx: CameraContext, prevPose: CameraPose | null): CameraPose {
  const t = ctx.t * program.speed_scalar;
  const zoom = program.zoom_scalar;
  const stability = clamp(program.stability, 0, 1);

  switch (program.mode as CameraMode) {
    case "orbit":
      return orbitPose(program, ctx, t, zoom, stability);
    case "path-rider":
      return pathRiderPose(program, ctx, t, zoom, stability);
    case "grid-surface":
      return gridSurfacePose(program, ctx, t, zoom, stability);
    case "drone-ghost":
      return droneGhostPose(program, ctx, t, zoom, stability);
    case "lobe-focus":
      return lobeFocusPose(program, ctx, t, zoom, stability);
    case "macro-micro":
      return macroMicroPose(program, ctx, t, zoom, stability);
    default:
      return orbitPose(program, ctx, t, zoom, stability);
  }
}
