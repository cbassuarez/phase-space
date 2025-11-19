export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type Palette = "system" | "plasma" | "viridis" | "rainbow";
export type Background = "light" | "dim";
export type LineThickness = "thin" | "default" | "thick";

export type Trajectories = number[][][];

export interface IntegratorSpec {
  dt?: number;
  steps?: number;
  discard_initial?: number;
}

export interface CameraSpec {
  theta?: number;
  phi?: number;
  r?: number;
}

export interface ViewSpec {
  camera?: CameraSpec;
}

export interface SceneSpec {
  integrator?: IntegratorSpec;
  view?: ViewSpec;
  [key: string]: unknown;
}
