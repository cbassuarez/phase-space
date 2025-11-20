import type { CameraProgram } from "./camera/types";

export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type Palette = "system" | "plasma" | "viridis" | "rainbow" | "inferno" | "magma" | "cividis";
export type Background = "dark" | "light" | "dim";
export type LineThickness = "thin" | "default" | "thick";
export type RenderStyle =
  | "photon-weave"
  | "volumetric-cloud"
  | "caustics"
  | "ribbon"
  | "cells";

export type FilamentDensity = "low" | "medium" | "high";
export type ProjectionAxis = "xy" | "xz" | "yz" | "auto";
export type CausticsColorMode = "global" | "warm" | "cool";

export interface PhotonWeaveSettings {
  brightness: number;
  trailLength: number;
  filamentDensity: FilamentDensity;
  shimmer: boolean;
}

export interface CausticsSettings {
  blurRadius: number;
  intensity: number;
  projectionAxis: ProjectionAxis;
  colorMode: CausticsColorMode;
}

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
  render_style?: RenderStyle;
}

function mapLegacyRenderStyle(style: RenderStyle | string | undefined | null): RenderStyle {
  switch (style) {
    case "neon-filaments":
      return "photon-weave";
    case "crt-scope":
      return "caustics";
    case "volumetric-cloud":
    case "ribbon":
    case "cells":
    case "photon-weave":
    case "caustics":
      return style;
    case "path-trace":
      return "cells";
    default:
      return "cells";
  }
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

export function normalizeViewSpec(view: ViewSpec | undefined): ViewSpec {
  if (!view) {
    return {
      mode: "mode3d",
      plane: null,
      camera: { theta: 0.8, phi: 0.9, r: 25 },
      palette: "plasma",
      background: "dark",
      point_size: 1,
      render_style: "photon-weave",
    };
  }

  return {
    ...view,
    render_style: mapLegacyRenderStyle(view.render_style),
  };
}

export { mapLegacyRenderStyle };
