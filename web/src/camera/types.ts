export type CameraMode =
  | "orbit"
  | "path-rider"
  | "grid-surface"
  | "drone-ghost"
  | "lobe-focus"
  | "macro-micro";

export interface OrbitCameraConfig {
  base_radius: number;
  radius_jitter: number;
  azimuth_speed: number;
  polar_speed: number;
  polar_center: number;
  polar_amplitude: number;
  hand_held_jitter: number;
}

export type PathRiderLoopMode = "wrap" | "ping-pong" | "clamp";

export interface PathRiderCameraConfig {
  trajectory_index: number;
  ahead_offset: number;
  lateral_offset: number;
  up_blend: number;
  time_scale: number;
  loop_mode: PathRiderLoopMode;
}

export type GridSurfacePathShape = "circle" | "lemniscate" | "line-scan";

export interface GridSurfaceCameraConfig {
  plane_height: number;
  camera_height: number;
  tilt_angle: number;
  travel_radius: number;
  travel_speed: number;
  path_shape: GridSurfacePathShape;
}

export type DroneSystem = "lorenz" | "rossler" | "thomas";

export type DroneGhostMode = "spherical" | "offset";

export interface DroneGhostCameraConfig {
  system: DroneSystem;
  radius_scale: number;
  center_bias: number;
  speed: number;
  mode: DroneGhostMode;
}

export type LobeFocusCycleMode = "alternate" | "random";

export interface LobeFocusCameraConfig {
  dwell_time: number;
  transition_time: number;
  zoom_inner: number;
  zoom_outer: number;
  cycle_mode: LobeFocusCycleMode;
}

export type MacroMicroPatchSelection = "random" | "density" | "seeded";

export interface MacroMicroCameraConfig {
  cycle_duration: number;
  micro_hold_fraction: number;
  macro_radius: number;
  micro_radius: number;
  patch_selection: MacroMicroPatchSelection;
}

export interface CameraProgram {
  mode: CameraMode;
  speed_scalar: number;
  zoom_scalar: number;
  stability: number;

  orbit: OrbitCameraConfig;
  path_rider: PathRiderCameraConfig;
  grid_surface: GridSurfaceCameraConfig;
  drone_ghost: DroneGhostCameraConfig;
  lobe_focus: LobeFocusCameraConfig;
  macro_micro: MacroMicroCameraConfig;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
}

export interface CameraContext {
  t: number;
  dt: number;
  randomSeed: number;

  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  centroid: [number, number, number];

  trajectories: [number, number, number][][];
  primaryTrajectoryIndex: number;
  lobeLabels?: number[][];
}
