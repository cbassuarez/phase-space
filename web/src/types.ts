import type { CameraProgram } from "./camera/types";
import type { PaletteId } from "./palettes";

export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas" | "chua";
export type Resolution = "fast" | "default" | "high" | "ultra";
export type Palette = PaletteId;
export type Background = "dark" | "light" | "dim";
export type LineThickness = "thin" | "default" | "thick";
export type CellShape = "circular" | "cel" | "square";
export type MaterialStyle = "glass" | "metal" | "plasma";
export type MaterialTransmission = number;
export type LineWeight = number;
export type CellSize = number;
export type RenderStyle =
  | "line"
  | "photon-weave"
  | "volumetric-cloud"
  | "caustics"
  | "ribbon"
  | "cells";

export type FilamentDensity = "low" | "medium" | "high";
export type FilamentDensityValue = number;
export type ProjectionAxis = "xy" | "xz" | "yz" | "auto";
export type CausticsColorMode = "global" | "warm" | "cool";

export interface PhotonWeaveSettings {
  brightness: number;
  trailLength: number;
  filamentDensity: FilamentDensity;
  filamentDensityValue: FilamentDensityValue;
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
  material_style?: MaterialStyle;
  material_transmission?: MaterialTransmission;
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

function mapLegacyMaterialStyle(style: MaterialStyle | string | undefined | null): MaterialStyle {
  switch (style) {
    case "metal":
    case "plasma":
    case "glass":
      return style;
    default:
      return "glass";
  }
}

function materialStyleToTransmission(style: MaterialStyle | string | undefined | null): MaterialTransmission {
  switch (style) {
    case "metal":
      return 0;
    case "plasma":
      return 1;
    case "glass":
    default:
      return 0.5;
  }
}

function materialTransmissionToStyle(value: number | undefined | null): MaterialStyle {
  const transmission = normalizeMaterialTransmission(value, "glass");
  if (transmission < 0.25) return "metal";
  if (transmission > 0.75) return "plasma";
  return "glass";
}

function filamentDensityToValue(density: FilamentDensity | string | undefined | null): FilamentDensityValue {
  switch (density) {
    case "low":
      return 0;
    case "high":
      return 1;
    case "medium":
    default:
      return 0.5;
  }
}

function filamentDensityValueToPreset(value: number | undefined | null): FilamentDensity {
  const density = normalizeFilamentDensityValue(value, "medium");
  if (density < 0.25) return "low";
  if (density > 0.75) return "high";
  return "medium";
}

function normalizeFilamentDensityValue(
  value: unknown,
  fallbackDensity: FilamentDensity | string | undefined | null = "medium"
): FilamentDensityValue {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(1, numeric));
  }
  return filamentDensityToValue(fallbackDensity);
}

function normalizeMaterialTransmission(
  value: unknown,
  fallbackStyle: MaterialStyle | string | undefined | null = "glass"
): MaterialTransmission {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(1, numeric));
  }
  return materialStyleToTransmission(fallbackStyle);
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
    material_style: "glass",
    material_transmission: materialStyleToTransmission("glass"),
  };

  if (!view) {
    return defaultView;
  }

  return {
    ...defaultView,
    ...view,
    palette: mapLegacyPalette(view.palette ?? defaultView.palette),
    render_style: mapLegacyRenderStyle(view.render_style ?? defaultView.render_style),
    material_style: mapLegacyMaterialStyle(view.material_style ?? defaultView.material_style),
    material_transmission: normalizeMaterialTransmission(
      view.material_transmission,
      view.material_style ?? defaultView.material_style
    ),
  };
}

export { mapLegacyRenderStyle };
export { mapLegacyMaterialStyle };
export { materialStyleToTransmission };
export { materialTransmissionToStyle };
export { normalizeMaterialTransmission };
export { filamentDensityToValue };
export { filamentDensityValueToPreset };
export { normalizeFilamentDensityValue };
export { mapLegacyPalette };
