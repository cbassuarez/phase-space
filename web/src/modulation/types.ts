export type ModBusId = "M1" | "M2" | "M3" | "M4";

export type AudioFeature =
  | "level"
  | "brightness"
  | "low_band"
  | "mid_band"
  | "high_band"
  | "onset"
  | "pitch";

export type VisualFeature =
  | "camera_orbit_phase"
  | "camera_radius_norm"
  | "avg_speed"
  | "curvature"
  | "traj_density"
  | "flow_x"
  | "flow_y"
  | "flow_z"
  | "spatial_spread"
  | "lobe_pulse";

export type SourceDomain = "audio" | "visual";

export interface ModSource {
  domain: SourceDomain;
  feature: AudioFeature | VisualFeature;
  smoothing: number; // 0..1, one-pole LPF
  gain: number; // scalar, default 1
}

export type Curve = "linear" | "exp" | "log" | "step";

export interface ModTarget {
  path: string; // whitelisted param path (see registry below)
  range: [number, number]; // mapped param range
  curve?: Curve;
  bias?: number;
  lag?: number;
}

export interface ModBus {
  id: ModBusId;
  enabled: boolean;
  trim?: number; // 0..1 contribution trim
  source: ModSource;
  targets: ModTarget[];
}

// Runtime state for each bus
export interface ModBusRuntimeState {
  bus: ModBus;
  value: number; // smoothed [0,1]
  rawValue: number; // last raw feature value before smoothing
}
