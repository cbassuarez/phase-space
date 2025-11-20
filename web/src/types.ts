import type { CameraProgram } from "./camera/types";

export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type PaletteId = "plasma" | "viridis" | "prism" | "solar" | "abyss" | "mono" | "custom";
export type CustomPaletteSlotId = "custom-1" | "custom-2" | "custom-3";
export type Palette = PaletteId;
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

export interface PaletteStop {
  t: number;
  color: string;
}

export interface PaletteSpec {
  stops: PaletteStop[];
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
  palette_spec?: PaletteSpec;
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
  const palette = view?.palette ? mapLegacyPalette(view.palette) : undefined;
  const paletteSpec = view?.palette_spec;
  if (!view) {
    return {
      mode: "mode3d",
      plane: null,
      camera: { theta: 0.8, phi: 0.9, r: 25 },
      palette: palette ?? "prism",
      palette_spec: paletteSpec,
      background: "dark",
      point_size: 1,
      render_style: "photon-weave",
    };
  }

  return {
    ...view,
    palette: palette ?? "prism",
    palette_spec: paletteSpec,
    render_style: mapLegacyRenderStyle(view.render_style),
  };
}

export { mapLegacyRenderStyle };

export function mapLegacyPalette(palette?: Palette | string | null): Palette {
  switch (palette) {
    case "viridis":
    case "prism":
    case "plasma":
    case "solar":
    case "abyss":
    case "mono":
    case "custom":
      return palette;
    case "rainbow":
      return "prism";
    case "inferno":
      return "solar";
    case "magma":
    case "cividis":
    case "system":
    default:
      return "plasma";
  }
}
