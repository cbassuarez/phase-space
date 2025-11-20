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
  t: number;
  color: string;
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

export type PaletteStopSpec = {
  t: number;
  color: string;
};

export type PaletteSpec = {
  stops: PaletteStopSpec[];
};

const STORAGE_KEY = "phase-space.customPalettes.v1";

export const TRI_PRIMARY_ACCENTS = {
  a: "#00ffff",
  b: "#ff00ff",
  c: "#ffff00",
};

export const BUILT_IN_PALETTES: PaletteDef[] = [
  {
    id: "plasma",
    label: "Plasma",
    stops: [
      { t: 0, color: "#0d0887" },
      { t: 0.33, color: "#7e03a8" },
      { t: 0.66, color: "#f89441" },
      { t: 1, color: "#f0f921" },
    ],
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
  },
  {
    id: "prism",
    label: "Prism",
    triPrimary: true,
    stops: [
      { t: 0, color: "#00ffff" },
      { t: 0.33, color: "#ff00ff" },
      { t: 0.66, color: "#ffff00" },
      { t: 1, color: "#ffffff" },
    ],
  },
  {
    id: "solar",
    label: "Solar",
    stops: [
      { t: 0, color: "#4A2000" },
      { t: 0.35, color: "#FFB000" },
      { t: 0.7, color: "#FFF3C4" },
      { t: 1, color: "#ffffff" },
    ],
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
  },
  {
    id: "mono",
    label: "Mono",
    stops: [
      { t: 0, color: "#000000" },
      { t: 0.5, color: "#888888" },
      { t: 1, color: "#ffffff" },
    ],
  },
];

export const CUSTOM_LABELS: Record<CustomPaletteId, string> = {
  "custom-1": "Custom 1",
  "custom-2": "Custom 2",
  "custom-3": "Custom 3",
};

export const defaultCustomPaletteBank: CustomPaletteBank = {
  "custom-1": {
    id: "custom-1",
    low: "#0d0887",
    mid: "#ff00ff",
    high: "#ffff00",
    saturationBoost: true,
    gamma: 1,
  },
  "custom-2": {
    id: "custom-2",
    low: "#4A2000",
    mid: "#FFB000",
    high: "#FFF3C4",
    saturationBoost: false,
    gamma: 1,
  },
  "custom-3": {
    id: "custom-3",
    low: "#020314",
    mid: "#3F6BFF",
    high: "#C3E6FF",
    saturationBoost: false,
    gamma: 1,
  },
};

export function loadCustomPaletteBank(): CustomPaletteBank {
  if (typeof window === "undefined") return { ...defaultCustomPaletteBank };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultCustomPaletteBank };
    const parsed = JSON.parse(raw) as Partial<CustomPaletteBank>;
    return {
      ...defaultCustomPaletteBank,
      ...parsed,
    } as CustomPaletteBank;
  } catch (err) {
    console.warn("Failed to load custom palettes", err);
    return { ...defaultCustomPaletteBank };
  }
}

export function persistCustomPaletteBank(bank: CustomPaletteBank) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
  } catch (err) {
    console.warn("Failed to persist custom palettes", err);
  }
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function enforceTriPrimarySaturation(color: THREE.Color): THREE.Color {
  const srgb = color.clone().convertLinearToSRGB();
  const hsl = { h: 0, s: 0, l: 0 };
  srgb.getHSL(hsl);
  if (hsl.s < 0.8) {
    srgb.setHSL(hsl.h, 0.8, hsl.l);
  }
  return srgb.convertSRGBToLinear();
}

function sortedStops(stops: PaletteStop[]): PaletteStop[] {
  return [...stops].sort((a, b) => a.t - b.t);
}

function interpolateColor(stops: PaletteStop[], t: number): THREE.Color {
  const clamped = clamp01(t);
  const ordered = sortedStops(stops);
  let before = ordered[0];
  let after = ordered[ordered.length - 1];
  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    if (stop.t <= clamped) {
      before = stop;
    }
    if (stop.t >= clamped) {
      after = stop;
      break;
    }
  }
  const span = after.t - before.t;
  const localT = span > 1e-5 ? (clamped - before.t) / span : 0;
  const c1 = new THREE.Color(before.color).convertSRGBToLinear();
  const c2 = new THREE.Color(after.color).convertSRGBToLinear();
  return c1.lerp(c2, clamp01(localT));
}

export function paletteDefForId(id: PaletteId, custom?: CustomPaletteBank): PaletteDef {
  const bank = custom ?? defaultCustomPaletteBank;
  const builtIn = BUILT_IN_PALETTES.find((p) => p.id === id);
  if (builtIn) return builtIn;
  const paletteId = id as CustomPaletteId;
  const state = bank[paletteId] ?? defaultCustomPaletteBank[paletteId];
  return {
    id,
    label: CUSTOM_LABELS[paletteId],
    stops: [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ],
    triPrimary: state.saturationBoost,
  };
}

export function samplePalette(
  id: PaletteId,
  t: number,
  custom?: CustomPaletteBank
): THREE.Color {
  const bank = custom ?? defaultCustomPaletteBank;
  const def = paletteDefForId(id, bank);
  const isCustom = id.startsWith("custom");
  const gamma = isCustom ? bank[id as CustomPaletteId]?.gamma ?? 1 : 1;
  const remappedT = Math.pow(clamp01(t), gamma);
  const interpolated = interpolateColor(def.stops, remappedT);
  const needsSat = def.triPrimary === true || (isCustom && bank[id as CustomPaletteId]?.saturationBoost);
  return needsSat ? enforceTriPrimarySaturation(interpolated) : interpolated;
}

export function paletteOptionsWithLabels(custom?: CustomPaletteBank): PaletteDef[] {
  const bank = custom ?? defaultCustomPaletteBank;
  const customs: PaletteDef[] = (Object.keys(CUSTOM_LABELS) as CustomPaletteId[]).map((id) => ({
    id,
    label: CUSTOM_LABELS[id],
    stops: [
      { t: 0, color: bank[id]?.low ?? defaultCustomPaletteBank[id].low },
      { t: 0.5, color: bank[id]?.mid ?? defaultCustomPaletteBank[id].mid },
      { t: 1, color: bank[id]?.high ?? defaultCustomPaletteBank[id].high },
    ],
    triPrimary: bank[id]?.saturationBoost,
  }));
  return [...BUILT_IN_PALETTES, ...customs];
}
