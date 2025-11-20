import { clamp } from "three/src/math/MathUtils.js";
import type {
  CustomPaletteSlotId,
  Palette,
  PaletteId,
  PaletteSpec,
  PaletteStop,
} from "./types";

export type PaletteDef = {
  id: PaletteId;
  label: string;
  stops: PaletteStop[];
  interpolation?: "linearRGB" | "oklab";
  triPrimary?: boolean;
  gamma?: number;
};

export type CustomPaletteState = {
  low: string;
  mid: string;
  high: string;
  triPrimary: boolean;
  gamma: number;
};

export type CustomPaletteBank = Record<CustomPaletteSlotId, CustomPaletteState>;

export const defaultCustomPaletteBank: CustomPaletteBank = {
  "custom-1": { low: "#ff0000", mid: "#00ff00", high: "#0000ff", triPrimary: true, gamma: 1 },
  "custom-2": { low: "#ff4500", mid: "#ffc800", high: "#ffeedd", triPrimary: false, gamma: 0.95 },
  "custom-3": { low: "#001a4d", mid: "#3f6bff", high: "#00ffc3", triPrimary: false, gamma: 1.05 },
};

export const builtInPalettes: PaletteDef[] = [
  {
    id: "plasma",
    label: "Plasma",
    interpolation: "linearRGB",
    stops: [
      { t: 0, color: "#0d0887" },
      { t: 0.25, color: "#7e03a8" },
      { t: 0.5, color: "#cc4778" },
      { t: 0.75, color: "#f89441" },
      { t: 1, color: "#f0f921" },
    ],
  },
  {
    id: "viridis",
    label: "Viridis",
    interpolation: "linearRGB",
    stops: [
      { t: 0, color: "#440154" },
      { t: 0.33, color: "#355c7d" },
      { t: 0.66, color: "#1f9e89" },
      { t: 1, color: "#fde725" },
    ],
  },
  {
    id: "prism",
    label: "Prism (RGB tri-primary)",
    interpolation: "linearRGB",
    triPrimary: true,
    stops: [
      { t: 0.0, color: "#ff0000" },
      { t: 0.33, color: "#00ff00" },
      { t: 0.66, color: "#0000ff" },
      { t: 1.0, color: "#ffffff" },
    ],
  },
  {
    id: "solar",
    label: "Solar (warm caustic)",
    interpolation: "linearRGB",
    stops: [
      { t: 0.0, color: "#4A2000" },
      { t: 0.35, color: "#FFB000" },
      { t: 0.7, color: "#FFF3C4" },
      { t: 1.0, color: "#FFFFFF" },
    ],
  },
  {
    id: "abyss",
    label: "Abyss (deep cool)",
    interpolation: "linearRGB",
    stops: [
      { t: 0.0, color: "#020314" },
      { t: 0.35, color: "#00FFC3" },
      { t: 0.7, color: "#3F6BFF" },
      { t: 1.0, color: "#C3E6FF" },
    ],
  },
  {
    id: "mono",
    label: "Mono",
    interpolation: "linearRGB",
    stops: [
      { t: 0.0, color: "#000000" },
      { t: 0.5, color: "#888888" },
      { t: 1.0, color: "#FFFFFF" },
    ],
  },
];

export function paletteDefFromSpec(id: PaletteId, spec: PaletteSpec, triPrimary = false): PaletteDef {
  return {
    id,
    label: "Custom palette",
    stops: [...spec.stops].sort((a, b) => a.t - b.t),
    interpolation: "linearRGB",
    triPrimary,
  };
}

export function customSlotToDef(slotId: CustomPaletteSlotId, state: CustomPaletteBank): PaletteDef {
  const slot = state[slotId];
  const stops: PaletteStop[] = [
    { t: 0, color: slot.low },
    { t: 0.5, color: slot.mid },
    { t: 1, color: slot.high },
  ];
  return {
    id: "custom",
    label: `Custom (${slotId})`,
    stops,
    interpolation: "linearRGB",
    triPrimary: slot.triPrimary,
    gamma: slot.gamma,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
}

function interpolate(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function samplePalette(palette: PaletteDef, t: number): { r: number; g: number; b: number } {
  const clamped = clamp(t, 0, 1);
  const gamma = palette.gamma ?? 1;
  const shapedT = gamma !== 1 ? Math.pow(clamped, gamma) : clamped;

  if (palette.stops.length === 0) return { r: shapedT, g: shapedT, b: shapedT };
  if (palette.stops.length === 1) return hexToRgb(palette.stops[0].color);

  const stops = [...palette.stops].sort((a, b) => a.t - b.t);
  const nextIdx = stops.findIndex((s) => s.t >= shapedT);
  if (nextIdx <= 0) return hexToRgb(stops[0].color);
  if (nextIdx === -1) return hexToRgb(stops[stops.length - 1].color);

  const prev = stops[nextIdx - 1];
  const next = stops[nextIdx];
  const span = next.t - prev.t || 1;
  const localT = clamp((shapedT - prev.t) / span, 0, 1);
  const a = hexToRgb(prev.color);
  const b = hexToRgb(next.color);
  let rgb = {
    r: interpolate(a.r, b.r, localT),
    g: interpolate(a.g, b.g, localT),
    b: interpolate(a.b, b.b, localT),
  };

  if (palette.triPrimary) {
    const hsl = rgbToHsl(rgb);
    const minSat = 0.8;
    const saturated = hslToRgb({ h: hsl.h, s: Math.max(hsl.s, minSat), l: hsl.l });
    rgb = saturated;
  }

  return rgb;
}

export function getPaletteDefinition(
  id: Palette,
  options: {
    customSlot?: CustomPaletteSlotId;
    customPalettes?: CustomPaletteBank;
    paletteSpec?: PaletteSpec;
  } = {}
): PaletteDef {
  if (id === "custom") {
    if (options.paletteSpec) {
      return paletteDefFromSpec("custom", options.paletteSpec, options.paletteSpec?.stops.length >= 3);
    }
    const slot = options.customSlot ?? "custom-1";
    const bank = options.customPalettes ?? defaultCustomPaletteBank;
    return customSlotToDef(slot, bank);
  }
  const builtIn = builtInPalettes.find((p) => p.id === id);
  if (builtIn) return builtIn;
  return builtInPalettes[0];
}
