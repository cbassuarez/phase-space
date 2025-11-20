import * as THREE from "three";

export type PaletteId =
  | "plasma"
  | "viridis"
  | "prism"
  | "solar"
  | "abyss"
  | "mono"
  | "custom-1"
  | "custom-2"
  | "custom-3";

export type PaletteStop = {
  t: number; // 0..1
  color: string; // hex
};

export type PaletteDef = {
  id: PaletteId;
  label: string;
  stops: PaletteStop[];
  interpolation?: "linearRGB" | "oklab";
  triPrimary?: boolean;
};

export type CustomPaletteId = "custom-1" | "custom-2" | "custom-3";

export type CustomPaletteState = {
  id: CustomPaletteId;
  low: string;
  mid: string;
  high: string;
  saturationBoost: boolean;
  gamma: number;
};

export type CustomPaletteBank = Record<CustomPaletteId, CustomPaletteState>;

export const TRI_PRIMARY_ACCENTS = {
  a: "#00FFFF",
  b: "#FF00FF",
  c: "#FFFF00",
};

export const builtinPalettes: PaletteDef[] = [
  {
    id: "plasma",
    label: "Plasma",
    stops: [
      { t: 0, color: "#0d0887" },
      { t: 0.33, color: "#7e03a8" },
      { t: 0.66, color: "#f89441" },
      { t: 1, color: "#f0f921" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "viridis",
    label: "Viridis",
    stops: [
      { t: 0, color: "#440154" },
      { t: 0.33, color: "#31688e" },
      { t: 0.66, color: "#35b779" },
      { t: 1, color: "#fde725" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "prism",
    label: "Prism",
    triPrimary: true,
    stops: [
      { t: 0, color: "#00FFFF" },
      { t: 0.33, color: "#FF00FF" },
      { t: 0.66, color: "#FFFF00" },
      { t: 1, color: "#FFFFFF" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "solar",
    label: "Solar",
    stops: [
      { t: 0, color: "#4A2000" },
      { t: 0.35, color: "#FFB000" },
      { t: 0.7, color: "#FFF3C4" },
      { t: 1, color: "#FFFFFF" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "abyss",
    label: "Abyss",
    stops: [
      { t: 0, color: "#020314" },
      { t: 0.35, color: "#00FFC3" },
      { t: 0.7, color: "#3F6BFF" },
      { t: 1, color: "#C3E6FF" },
    ],
    interpolation: "linearRGB",
  },
  {
    id: "mono",
    label: "Mono",
    stops: [
      { t: 0, color: "#000000" },
      { t: 0.5, color: "#888888" },
      { t: 1, color: "#FFFFFF" },
    ],
    interpolation: "linearRGB",
  },
];

const defaultCustomPalettes: CustomPaletteBank = {
  "custom-1": {
    id: "custom-1",
    low: "#00FFFF",
    mid: "#FF00FF",
    high: "#FFFF00",
    saturationBoost: true,
    gamma: 1,
  },
  "custom-2": {
    id: "custom-2",
    low: "#331100",
    mid: "#FF8C3C",
    high: "#FFE7B3",
    saturationBoost: false,
    gamma: 0.95,
  },
  "custom-3": {
    id: "custom-3",
    low: "#021024",
    mid: "#2AE1FF",
    high: "#B6F1FF",
    saturationBoost: true,
    gamma: 1.05,
  },
};

export const CUSTOM_STORAGE_KEY = "phase-space.customPalettes.v1";

export function getDefaultCustomPaletteBank(): CustomPaletteBank {
  return JSON.parse(JSON.stringify(defaultCustomPalettes)) as CustomPaletteBank;
}

export function loadCustomPaletteBank(): CustomPaletteBank {
  if (typeof window === "undefined") {
    return getDefaultCustomPaletteBank();
  }
  try {
    const saved = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!saved) return getDefaultCustomPaletteBank();
    const parsed = JSON.parse(saved) as Partial<CustomPaletteBank>;
    return {
      ...getDefaultCustomPaletteBank(),
      ...parsed,
    } as CustomPaletteBank;
  } catch (err) {
    console.warn("Failed to load custom palettes", err);
    return getDefaultCustomPaletteBank();
  }
}

export function saveCustomPaletteBank(bank: CustomPaletteBank) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(bank));
  } catch (err) {
    console.warn("Failed to save custom palettes", err);
  }
}

function toLinear(color: string): THREE.Color {
  return new THREE.Color(color).convertSRGBToLinear();
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function enforceTriSaturation(color: THREE.Color): THREE.Color {
  const srgb = color.clone().convertLinearToSRGB();
  const hsl = srgb.getHSL({ h: 0, s: 0, l: 0 });
  if (hsl.s < 0.8) {
    srgb.setHSL(hsl.h, 0.8, hsl.l);
  }
  return srgb.convertSRGBToLinear();
}

function interpolateStops(stops: PaletteStop[], t: number, triPrimary?: boolean): THREE.Color {
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
    const base = toLinear(right.color);
    return triPrimary ? enforceTriSaturation(base) : base;
  }
  const localT = (clamped - left.t) / (right.t - left.t);
  const c1 = toLinear(left.color);
  const c2 = toLinear(right.color);
  const mixed = c1.clone().lerp(c2, localT);
  return triPrimary ? enforceTriSaturation(mixed) : mixed;
}

export function samplePalette(
  id: PaletteId,
  t: number,
  custom?: CustomPaletteBank
): THREE.Color {
  const clampedT = clamp01(t);
  const customBank = custom ?? getDefaultCustomPaletteBank();
  if (id.startsWith("custom-")) {
    const state = customBank[id as CustomPaletteId] ?? getDefaultCustomPaletteBank()[id as CustomPaletteId];
    const stops: PaletteStop[] = [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ];
    const gammaT = Math.pow(clampedT, Math.max(0.0001, state.gamma));
    const color = interpolateStops(stops, gammaT, state.saturationBoost);
    return state.saturationBoost ? enforceTriSaturation(color) : color;
  }

  const def = builtinPalettes.find((p) => p.id === id) ?? builtinPalettes[0];
  return interpolateStops(def.stops, clampedT, def.triPrimary);
}

export function paletteDefById(id: PaletteId, custom?: CustomPaletteBank): PaletteDef | null {
  if (!id.startsWith("custom-")) {
    return builtinPalettes.find((p) => p.id === id) ?? null;
  }
  const bank = custom ?? getDefaultCustomPaletteBank();
  const state = bank[id as CustomPaletteId];
  if (!state) return null;
  return {
    id: id as PaletteId,
    label: id,
    stops: [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ],
    interpolation: "linearRGB",
    triPrimary: state.saturationBoost,
  };
}
