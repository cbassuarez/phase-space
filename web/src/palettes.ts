import * as THREE from "three";

export type PaletteId =
  | "plasma"
  | "viridis"
  | "prism"
  | "solar"
  | "abyss"
  | "mono"
  | "custom";

export type PaletteStop = {
  t: number; // 0..1
  color: string; // hex
};

export type PaletteDef = {
  id: PaletteId;
  label: string;
  stops: PaletteStop[];
  interpolation?: "linearRGB" | "oklab";
};

export type CustomPaletteState = {
  low: string;
  mid: string;
  high: string;
};

export const TRI_PRIMARY_ANCHORS = {
  red: "#FF1A1A",
  yellow: "#FFD600",
  blue: "#0057FF",
};

export const builtinPalettes: PaletteDef[] = [
  {
    id: "prism",
    label: "Signal",
    stops: [
      { t: 0, color: "#ff2a6d" },
      { t: 0.33, color: "#05d9e8" },
      { t: 0.66, color: "#f9f871" },
      { t: 1, color: "#7a5cff" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "plasma",
    label: "Ion",
    stops: [
      { t: 0, color: "#16052d" },
      { t: 0.33, color: "#5b2cff" },
      { t: 0.66, color: "#ff3ea5" },
      { t: 1, color: "#ffe66d" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "viridis",
    label: "Biolume",
    stops: [
      { t: 0, color: "#061a23" },
      { t: 0.33, color: "#00d1ff" },
      { t: 0.66, color: "#00ff9f" },
      { t: 1, color: "#f7ff6a" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "solar",
    label: "Arc",
    stops: [
      { t: 0, color: "#18020a" },
      { t: 0.33, color: "#ff3d00" },
      { t: 0.66, color: "#ffb000" },
      { t: 1, color: "#ffffff" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "abyss",
    label: "X-Ray",
    stops: [
      { t: 0, color: "#01030f" },
      { t: 0.33, color: "#005cff" },
      { t: 0.66, color: "#00f5ff" },
      { t: 1, color: "#f8fbff" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "mono",
    label: "Graphite",
    stops: [
      { t: 0, color: "#000000" },
      { t: 0.5, color: "#888888" },
      { t: 1, color: "#FFFFFF" },
    ],
    interpolation: "linearRGB",
  },
];

const defaultCustomPalette: CustomPaletteState = {
  low: TRI_PRIMARY_ANCHORS.red,
  mid: TRI_PRIMARY_ANCHORS.yellow,
  high: TRI_PRIMARY_ANCHORS.blue,
};

export const CUSTOM_STORAGE_KEY = "phase-space.customPalette.v2";
const LEGACY_CUSTOM_STORAGE_KEY = "phase-space.customPalettes.v1";

function cloneCustomPalette(state: CustomPaletteState): CustomPaletteState {
  return { ...state };
}

export function getDefaultCustomPalette(): CustomPaletteState {
  return cloneCustomPalette(defaultCustomPalette);
}

function normalizeCustomPalette(state?: Partial<CustomPaletteState>): CustomPaletteState {
  const fallback = getDefaultCustomPalette();
  return {
    low: state?.low ?? fallback.low,
    mid: state?.mid ?? fallback.mid,
    high: state?.high ?? fallback.high,
  };
}

function loadLegacyCustomPalette(): CustomPaletteState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(LEGACY_CUSTOM_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Record<string, any>;
    const first = parsed?.["custom-1"];
    if (first) {
      return normalizeCustomPalette({ low: first.low, mid: first.mid, high: first.high });
    }
  } catch (err) {
    console.warn("Failed to load legacy custom palette", err);
  }
  return null;
}

export function loadCustomPalette(): CustomPaletteState {
  if (typeof window === "undefined") {
    return getDefaultCustomPalette();
  }
  try {
    const saved = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<CustomPaletteState>;
      return normalizeCustomPalette(parsed);
    }
    const legacy = loadLegacyCustomPalette();
    if (legacy) return legacy;
  } catch (err) {
    console.warn("Failed to load custom palette", err);
  }
  return getDefaultCustomPalette();
}

export function saveCustomPalette(palette: CustomPaletteState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(normalizeCustomPalette(palette)));
  } catch (err) {
    console.warn("Failed to save custom palette", err);
  }
}

function toLinear(color: string): THREE.Color {
  return new THREE.Color(color).convertSRGBToLinear();
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function interpolateStops(stops: PaletteStop[], t: number): THREE.Color {
  const ordered = [...stops].sort((a, b) => a.t - b.t);
  const clamped = clamp01(t);
  if (ordered.length === 0) return new THREE.Color(1, 1, 1);
  let left = ordered[0];
  let right = ordered[ordered.length - 1];
  for (let i = 0; i < ordered.length; i++) {
    if (clamped <= ordered[i].t) {
      right = ordered[i];
      break;
    }
    left = ordered[i];
  }
  if (right.t === left.t) {
    return toLinear(right.color);
  }
  const localT = (clamped - left.t) / (right.t - left.t);
  const c1 = toLinear(left.color);
  const c2 = toLinear(right.color);
  return c1.clone().lerp(c2, localT);
}

export function samplePalette(id: PaletteId, t: number, custom?: CustomPaletteState): THREE.Color {
  const clampedT = clamp01(t);
  if (id === "custom") {
    const state = normalizeCustomPalette(custom);
    const stops: PaletteStop[] = [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ];
    return interpolateStops(stops, clampedT);
  }

  const def = builtinPalettes.find((p) => p.id === id) ?? builtinPalettes[0];
  return interpolateStops(def.stops, clampedT);
}

export function paletteDefById(id: PaletteId, custom?: CustomPaletteState): PaletteDef | null {
  if (id !== "custom") {
    return builtinPalettes.find((p) => p.id === id) ?? null;
  }

  const state = normalizeCustomPalette(custom);
  return {
    id: "custom",
    label: "Custom",
    stops: [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ],
    interpolation: "linearRGB",
  };
}
