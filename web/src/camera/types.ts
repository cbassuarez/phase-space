export type CameraMode = "survey" | "orbit" | "chase" | "lobe";

export type SurveyDirPreset = "iso" | "front" | "top";

export interface SurveyCameraConfig {
  rotate: boolean;
  rotate_speed: number;
  margin: number;
  pitch: number;
  dir_preset: SurveyDirPreset;
}

export interface OrbitCameraConfig {
  base_radius: number;
  azimuth_speed: number;
  polar_speed: number;
  polar_center: number;
  polar_amplitude: number;
}

export type ChaseLoopMode = "wrap" | "ping-pong" | "clamp";

export interface ChaseCameraConfig {
  trajectory_index: number;
  chase_distance: number;
  ride_height: number;
  look_ahead: number;
  bank_strength: number;
  time_scale: number;
  loop_mode: ChaseLoopMode;
}

export type LobeCycleMode = "alternate" | "random";
export type LobeCount = "auto" | 2 | 3 | 4;

export interface LobeCameraConfig {
  lobe_count: LobeCount;
  dwell_time: number;
  transition_time: number;
  zoom: number;
  cycle_mode: LobeCycleMode;
}

export interface CameraProgram {
  mode: CameraMode;
  speed_scalar: number;
  zoom_scalar: number;
  stability: number;

  survey: SurveyCameraConfig;
  orbit: OrbitCameraConfig;
  chase: ChaseCameraConfig;
  lobe: LobeCameraConfig;
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

  aspect: number;

  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  centroid: [number, number, number];

  trajectories: [number, number, number][][];
  primaryTrajectoryIndex: number;
  lobeLabels?: number[][];
}
