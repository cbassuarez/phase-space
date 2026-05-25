import { SceneSpec, SystemId } from "../types";
import type { CameraProgram } from "../camera/types";
import { createDefaultCameraProgram } from "../camera/migrate";

function cameraFor(mode: CameraProgram["mode"], tweak?: (c: CameraProgram) => void): CameraProgram {
  const cam = createDefaultCameraProgram();
  cam.mode = mode;
  tweak?.(cam);
  return cam;
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
    camera: cameraFor("chase", (c) => {
      c.chase.bank_strength = 0.35;
      c.chase.time_scale = 0.9;
    }),
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
    camera: cameraFor("survey", (c) => {
      c.survey.dir_preset = "iso";
      c.survey.margin = 1.2;
    }),
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
    camera: cameraFor("lobe", (c) => {
      c.lobe.lobe_count = "auto";
      c.lobe.dwell_time = 5.0;
      c.lobe.transition_time = 2.0;
    }),
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
    camera: cameraFor("orbit", (c) => {
      c.orbit.base_radius = 1.4;
      c.orbit.azimuth_speed = 0.07;
    }),
  },
};

export function getDefaultSceneJSON(system: SystemId): string {
  return JSON.stringify(defaultScenes[system]);
}

export function getDefaultSceneSpec(system: SystemId): SceneSpec {
  return defaultScenes[system];
}
