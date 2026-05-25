import type {
  CameraMode,
  CameraProgram,
  ChaseLoopMode,
  LobeCount,
  LobeCycleMode,
  SurveyDirPreset,
} from "./types";

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === "boolean" ? x : fallback;
}

function pickEnum<T extends string>(
  x: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof x === "string" && (allowed as readonly string[]).includes(x)
    ? (x as T)
    : fallback;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

const MODE_MAP: Record<string, CameraMode> = {
  survey: "survey",
  orbit: "orbit",
  chase: "chase",
  lobe: "lobe",
  "path-rider": "chase",
  "grid-surface": "survey",
  "drone-ghost": "orbit",
  "lobe-focus": "lobe",
};

export function createDefaultCameraProgram(): CameraProgram {
  return {
    mode: "survey",
    speed_scalar: 0.35,
    zoom_scalar: 1.0,
    stability: 0.25,
    survey: {
      rotate: true,
      rotate_speed: 0.05,
      margin: 1.15,
      pitch: 0.5,
      dir_preset: "iso",
    },
    orbit: {
      base_radius: 1.2,
      azimuth_speed: 0.05,
      polar_speed: 0.08,
      polar_center: 0.9,
      polar_amplitude: 0.25,
    },
    chase: {
      trajectory_index: 0,
      chase_distance: 0.15,
      ride_height: 0.04,
      look_ahead: 0.25,
      bank_strength: 0.3,
      time_scale: 1.0,
      loop_mode: "wrap",
    },
    lobe: {
      lobe_count: "auto",
      dwell_time: 6.0,
      transition_time: 2.5,
      zoom: 1.1,
      cycle_mode: "alternate",
    },
  };
}

export function migrateCameraProgram(input: unknown): CameraProgram {
  const out = createDefaultCameraProgram();
  if (!input || typeof input !== "object") return out;
  const p = input as Record<string, unknown>;

  const rawMode = typeof p.mode === "string" ? p.mode : "";
  out.mode = MODE_MAP[rawMode] ?? "survey";

  out.speed_scalar = num(p.speed_scalar, out.speed_scalar);
  out.zoom_scalar = num(p.zoom_scalar, out.zoom_scalar);
  out.stability = num(p.stability, out.stability);

  if (p.survey && typeof p.survey === "object") {
    const s = p.survey as Record<string, unknown>;
    out.survey.rotate = bool(s.rotate, out.survey.rotate);
    out.survey.rotate_speed = num(s.rotate_speed, out.survey.rotate_speed);
    out.survey.margin = num(s.margin, out.survey.margin);
    out.survey.pitch = num(s.pitch, out.survey.pitch);
    out.survey.dir_preset = pickEnum<SurveyDirPreset>(
      s.dir_preset,
      ["iso", "front", "top"],
      out.survey.dir_preset
    );
  } else if (p.grid_surface && typeof p.grid_surface === "object") {
    const g = p.grid_surface as Record<string, unknown>;
    const travelRadius = num(g.travel_radius, 1.2);
    out.survey.margin = clamp(travelRadius, 1.0, 1.4);
  }

  if (p.orbit && typeof p.orbit === "object") {
    const o = p.orbit as Record<string, unknown>;
    out.orbit.base_radius = num(o.base_radius, out.orbit.base_radius);
    out.orbit.azimuth_speed = num(o.azimuth_speed, out.orbit.azimuth_speed);
    out.orbit.polar_speed = num(o.polar_speed, out.orbit.polar_speed);
    out.orbit.polar_center = num(o.polar_center, out.orbit.polar_center);
    out.orbit.polar_amplitude = num(o.polar_amplitude, out.orbit.polar_amplitude);
  }
  if (rawMode === "drone-ghost" && p.drone_ghost && typeof p.drone_ghost === "object") {
    const d = p.drone_ghost as Record<string, unknown>;
    out.orbit.base_radius = num(d.radius_scale, out.orbit.base_radius);
    out.orbit.azimuth_speed = num(d.speed, 1.0) * 0.05;
  }

  if (p.chase && typeof p.chase === "object") {
    const c = p.chase as Record<string, unknown>;
    out.chase.trajectory_index = num(c.trajectory_index, out.chase.trajectory_index);
    out.chase.chase_distance = num(c.chase_distance, out.chase.chase_distance);
    out.chase.ride_height = num(c.ride_height, out.chase.ride_height);
    out.chase.look_ahead = num(c.look_ahead, out.chase.look_ahead);
    out.chase.bank_strength = num(c.bank_strength, out.chase.bank_strength);
    out.chase.time_scale = num(c.time_scale, out.chase.time_scale);
    out.chase.loop_mode = pickEnum<ChaseLoopMode>(
      c.loop_mode,
      ["wrap", "ping-pong", "clamp"],
      out.chase.loop_mode
    );
  } else if (p.path_rider && typeof p.path_rider === "object") {
    const pr = p.path_rider as Record<string, unknown>;
    out.chase.trajectory_index = num(pr.trajectory_index, out.chase.trajectory_index);
    out.chase.time_scale = num(pr.time_scale, out.chase.time_scale);
    out.chase.loop_mode = pickEnum<ChaseLoopMode>(
      pr.loop_mode,
      ["wrap", "ping-pong", "clamp"],
      out.chase.loop_mode
    );
  }

  if (p.lobe && typeof p.lobe === "object") {
    const l = p.lobe as Record<string, unknown>;
    const rawCount = l.lobe_count;
    if (rawCount === "auto") out.lobe.lobe_count = "auto";
    else if (rawCount === 2 || rawCount === 3 || rawCount === 4)
      out.lobe.lobe_count = rawCount as LobeCount;
    out.lobe.dwell_time = num(l.dwell_time, out.lobe.dwell_time);
    out.lobe.transition_time = num(l.transition_time, out.lobe.transition_time);
    out.lobe.zoom = num(l.zoom, out.lobe.zoom);
    out.lobe.cycle_mode = pickEnum<LobeCycleMode>(
      l.cycle_mode,
      ["alternate", "random"],
      out.lobe.cycle_mode
    );
  } else if (p.lobe_focus && typeof p.lobe_focus === "object") {
    const lf = p.lobe_focus as Record<string, unknown>;
    out.lobe.dwell_time = num(lf.dwell_time, out.lobe.dwell_time);
    out.lobe.transition_time = num(lf.transition_time, out.lobe.transition_time);
    out.lobe.zoom = num(lf.zoom_outer, out.lobe.zoom);
    out.lobe.cycle_mode = pickEnum<LobeCycleMode>(
      lf.cycle_mode,
      ["alternate", "random"],
      out.lobe.cycle_mode
    );
  }

  return out;
}
