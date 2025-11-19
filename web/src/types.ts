import type { CameraProgram } from "./camera/types";

export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type Palette = "plasma" | "viridis" | "rainbow" | "inferno" | "magma" | "cividis";
export type Background = "dark" | "light";
export type LineThickness = "thin" | "default" | "thick";

export type Trajectories = number[][][];

export interface IntegratorSpec {
  dt?: number;
  steps?: number;
  discard_initial?: number;
  max_radius?: number;
}

export interface CameraSpec {
  theta?: number;
  phi?: number;
  r?: number;
}

export interface PlaneSpec {
  normal?: [number, number, number];
  offset?: number;
}

export interface ViewSpec {
  mode?: "mode3d" | "plane";
  plane?: PlaneSpec | null;
  camera?: CameraSpec;
  palette?: Palette;
  background?: Background;
  point_size?: number;
}

export interface SceneSpec {
  id?: string | null;
  system?: SystemId;
  params?: Record<string, unknown>;
  initial_seeds?: { x?: [number, number, number]; color_index?: number | null }[];
  integrator?: IntegratorSpec;
  view?: ViewSpec;
  random_seed?: number;
  camera?: CameraProgram;
  [key: string]: unknown;
}
