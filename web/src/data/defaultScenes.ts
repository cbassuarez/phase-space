import { SceneSpec, SystemId } from "../types";
import type { CameraProgram } from "../camera/types";

function defaultCameraProgram(): CameraProgram {
  return {
    mode: "orbit",
    speed_scalar: 0.35,
    zoom_scalar: 1.0,
    stability: 0.25,
    orbit: {
      base_radius: 1.2,
      radius_jitter: 0.05,
      azimuth_speed: 0.015,
      polar_speed: 0.025,
      polar_center: 0.9,
      polar_amplitude: 0.25,
      hand_held_jitter: 0.15,
    },
    path_rider: {
      trajectory_index: 0,
      ahead_offset: 150,
      lateral_offset: 0.3,
      up_blend: 0.6,
      time_scale: 1.0,
      loop_mode: "wrap",
    },
    grid_surface: {
      plane_height: 0,
      camera_height: 2.0,
      tilt_angle: 0.4,
      travel_radius: 1.2,
      travel_speed: 0.25,
      path_shape: "circle",
    },
    drone_ghost: {
      system: "lorenz",
      radius_scale: 1.4,
      center_bias: 0.4,
      speed: 1.0,
      mode: "offset",
    },
    lobe_focus: {
      dwell_time: 6.0,
      transition_time: 2.5,
      zoom_inner: 0.9,
      zoom_outer: 1.4,
      cycle_mode: "alternate",
    },
  };
}

const defaultScenes: Record<SystemId, SceneSpec> = {
  lorenz: {
    id: "lorenz-default",
    system: "lorenz",
    params: {
      sigma: 10,
      rho: 28,
      beta: 8 / 3,
    },
    initial_seeds: [
      { x: [0.1, 0.0, 0.0], color_index: 0 },
      { x: [0.1001, 0.0, 0.0], color_index: 1 },
    ],
    integrator: {
      dt: 0.01,
      steps: 50_000,
      discard_initial: 1_000,
      max_radius: 1000.0,
    },
    view: {
      mode: "mode3d",
      plane: null,
      camera: { theta: 0.8, phi: 0.9, r: 25.0 },
      palette: "prism",
      background: "dark",
      point_size: 1.0,
      render_style: "volumetric-cloud",
    },
    random_seed: 42,
    camera: (() => {
      const cam = defaultCameraProgram();
      cam.mode = "orbit";
      cam.zoom_scalar = 1.0;
      cam.stability = 0.2;
      return cam;
    })(),
  },
  rossler: {
    id: "rossler-default",
    system: "rossler",
    params: {
      a: 0.2,
      b: 0.2,
      c: 5.7,
    },
    initial_seeds: [
      { x: [0.1, 0.0, 0.0], color_index: 0 },
      { x: [0.1002, 0.0, 0.0], color_index: 1 },
    ],
    integrator: {
      dt: 0.02,
      steps: 60_000,
      discard_initial: 1_000,
      max_radius: 1000.0,
    },
    view: {
      mode: "mode3d",
      plane: null,
      camera: { theta: 1.0, phi: 0.9, r: 18.0 },
      palette: "viridis",
      background: "dark",
      point_size: 1.0,
      render_style: "volumetric-cloud",
    },
    random_seed: 43,
    camera: (() => {
      const cam = defaultCameraProgram();
      cam.mode = "grid-surface";
      cam.zoom_scalar = 1.1;
      return cam;
    })(),
  },
  aizawa: {
    id: "aizawa-default",
    system: "aizawa",
    params: {
      a: 0.95,
      b: 0.7,
      c: 0.6,
      d: 3.5,
      e: 0.25,
      f: 0.1,
    },
    initial_seeds: [
      { x: [0.1, 0.0, 0.0], color_index: 0 },
      { x: [-0.1, 0.0, 0.0], color_index: 1 },
      { x: [0.0, 0.1, 0.0], color_index: 2 },
    ],
    integrator: {
      dt: 0.01,
      steps: 80_000,
      discard_initial: 2_000,
      max_radius: 1000.0,
    },
    view: {
      mode: "mode3d",
      plane: null,
      camera: { theta: 1.2, phi: 0.9, r: 22.0 },
      palette: "prism",
      background: "dark",
      point_size: 1.0,
      render_style: "volumetric-cloud",
    },
    random_seed: 44,
    camera: (() => {
      const cam = defaultCameraProgram();
      cam.mode = "path-rider";
      cam.path_rider.time_scale = 0.8;
      cam.path_rider.ahead_offset = 220;
      return cam;
    })(),
  },
  thomas: {
    id: "thomas-default",
    system: "thomas",
    params: {
      b: 0.208186,
    },
    initial_seeds: [
      { x: [1.0, 0.0, 0.0], color_index: 0 },
      { x: [-1.0, 0.0, 0.5], color_index: 1 },
      { x: [0.0, 1.0, -0.5], color_index: 2 },
    ],
    integrator: {
      dt: 0.02,
      steps: 80_000,
      discard_initial: 2_000,
      max_radius: 1000.0,
    },
    view: {
      mode: "mode3d",
      plane: null,
      camera: { theta: 0.7, phi: 0.9, r: 16.0 },
      palette: "plasma",
      background: "dark",
      point_size: 1.0,
      render_style: "volumetric-cloud",
    },
    random_seed: 45,
    camera: (() => {
      const cam = defaultCameraProgram();
      cam.mode = "drone-ghost";
      cam.drone_ghost.radius_scale = 1.6;
      cam.drone_ghost.center_bias = 0.35;
      return cam;
    })(),
  },
};

export function getDefaultSceneJSON(system: SystemId): string {
  return JSON.stringify(defaultScenes[system]);
}

export function getDefaultSceneSpec(system: SystemId): SceneSpec {
  return defaultScenes[system];
}
