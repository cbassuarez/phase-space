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
      { t: 0, color: "#07111f" },
      { t: 0.22, color: "#3157ff" },
      { t: 0.48, color: "#27e2d1" },
      { t: 0.72, color: "#fff2a8" },
      { t: 1, color: "#ff4f8b" },
    ],
    interpolation: "oklab",
  },
  {
    id: "plasma",
    label: "Ion",
    stops: [
      { t: 0, color: "#12071d" },
      { t: 0.25, color: "#3a2b8f" },
      { t: 0.5, color: "#c03dd7" },
      { t: 0.76, color: "#ff8f5a" },
      { t: 1, color: "#fff0b8" },
    ],
    interpolation: "oklab",
  },
  {
    id: "viridis",
    label: "Biolume",
    stops: [
      { t: 0, color: "#041318" },
      { t: 0.28, color: "#0b6e78" },
      { t: 0.52, color: "#23c58a" },
      { t: 0.78, color: "#b6f06f" },
      { t: 1, color: "#f8ffe0" },
    ],
    interpolation: "oklab",
  },
  {
    id: "solar",
    label: "Arc",
    stops: [
      { t: 0, color: "#17070a" },
      { t: 0.25, color: "#8e1f16" },
      { t: 0.52, color: "#f36b20" },
      { t: 0.78, color: "#ffc66d" },
      { t: 1, color: "#fff7e6" },
    ],
    interpolation: "oklab",
  },
  {
    id: "abyss",
    label: "X-Ray",
    stops: [
      { t: 0, color: "#020512" },
      { t: 0.24, color: "#10246e" },
      { t: 0.5, color: "#1a8fe3" },
      { t: 0.76, color: "#8eeaff" },
      { t: 1, color: "#fbfdff" },
    ],
    interpolation: "oklab",
  },
  {
    id: "mono",
    label: "Graphite",
    stops: [
      { t: 0, color: "#050607" },
      { t: 0.38, color: "#3b4149" },
      { t: 0.72, color: "#a7b0bd" },
      { t: 1, color: "#ffffff" },
    ],
    interpolation: "oklab",
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

function linearRgbToOklab(color: THREE.Color): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * color.r + 0.5363325363 * color.g + 0.0514459929 * color.b);
  const m = Math.cbrt(0.2119034982 * color.r + 0.6806995451 * color.g + 0.1073969566 * color.b);
  const s = Math.cbrt(0.0883024619 * color.r + 0.2817188376 * color.g + 0.6299787005 * color.b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToLinearRgb([L, a, b]: [number, number, number]): THREE.Color {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  return new THREE.Color(
    clamp01(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clamp01(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clamp01(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)
  );
}

function interpolateOklab(left: string, right: string, t: number): THREE.Color {
  const a = linearRgbToOklab(toLinear(left));
  const b = linearRgbToOklab(toLinear(right));
  return oklabToLinearRgb([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

function interpolateStops(stops: PaletteStop[], t: number, interpolation: PaletteDef["interpolation"] = "linearRGB"): THREE.Color {
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
  if (interpolation === "oklab") {
    return interpolateOklab(left.color, right.color, localT);
  }
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
    return interpolateStops(stops, clampedT, "oklab");
  }

  const def = builtinPalettes.find((p) => p.id === id) ?? builtinPalettes[0];
  return interpolateStops(def.stops, clampedT, def.interpolation);
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
    interpolation: "oklab",
  };
}
