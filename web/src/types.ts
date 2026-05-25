import type { CameraProgram } from "./camera/types";
import type { PaletteId } from "./palettes";

export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas" | "chua";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type Palette = PaletteId;
export type Background = "dark" | "light" | "dim";
export type LineThickness = "thin" | "default" | "thick";
export type RenderStyle =
  | "line"
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

export interface PaletteStopSpec {
  t?: number;
  color?: string;
}

export interface PaletteSpec {
  stops?: PaletteStopSpec[];
}

export interface ViewSpec {
  mode?: "mode3d" | "plane";
  plane?: PlaneSpec | null;
  camera?: CameraSpec;
  palette?: Palette;
  palette_spec?: PaletteSpec | null;
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
    case "line":
    case "volumetric-cloud":
    case "ribbon":
    case "cells":
    case "photon-weave":
    case "caustics":
      return style;
    case "path-trace":
      return "line";
    default:
      return "line";
  }
}

function mapLegacyPalette(palette: Palette | string | undefined | null): Palette {
  switch (palette) {
    case "rainbow":
      return "prism";
    case "inferno":
      return "solar";
    case "magma":
      return "solar";
    case "cividis":
      return "mono";
    case "custom-1":
    case "custom-2":
    case "custom-3":
      return "custom";
    case "plasma":
    case "viridis":
    case "prism":
    case "solar":
    case "abyss":
    case "mono":
    case "custom":
      return palette;
    default:
      return "plasma";
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
  const defaultView: ViewSpec = {
    mode: "mode3d",
    plane: null,
    camera: { theta: 0.8, phi: 0.9, r: 25 },
    palette: "prism",
    background: "dark",
    point_size: 1,
    render_style: "volumetric-cloud",
  };

  if (!view) {
    return defaultView;
  }

  return {
    ...defaultView,
    ...view,
    palette: mapLegacyPalette(view.palette ?? defaultView.palette),
    render_style: mapLegacyRenderStyle(view.render_style ?? defaultView.render_style),
  };
}

export { mapLegacyRenderStyle };
export { mapLegacyPalette };
