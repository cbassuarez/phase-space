import type { Background } from "../types";

export type BackgroundMode = Background;

export const DEFAULT_CUSTOM_BACKGROUNDS = {
  custom1: "#050816",
  custom2: "#F5F5F5",
};

export type CustomBackgrounds = typeof DEFAULT_CUSTOM_BACKGROUNDS;

const BASE_BACKGROUND_COLORS: Record<BackgroundMode, { scene: string; page: string }> = {
  light: { scene: "#FFFFFF", page: "#F9FAFB" },
  dim: { scene: "#020617", page: "#0B1120" },
  custom1: { scene: DEFAULT_CUSTOM_BACKGROUNDS.custom1, page: DEFAULT_CUSTOM_BACKGROUNDS.custom1 },
  custom2: { scene: DEFAULT_CUSTOM_BACKGROUNDS.custom2, page: DEFAULT_CUSTOM_BACKGROUNDS.custom2 },
};

export function getBackgroundColors(
  mode: BackgroundMode,
  custom: CustomBackgrounds
): { scene: string; page: string } {
  if (mode === "custom1") {
    return { scene: custom.custom1, page: custom.custom1 };
  }
  if (mode === "custom2") {
    return { scene: custom.custom2, page: custom.custom2 };
  }
  return BASE_BACKGROUND_COLORS[mode];
}

export function getBackgroundDisplayName(mode: BackgroundMode): string {
  switch (mode) {
    case "light":
      return "Light";
    case "dim":
      return "Dim";
    case "custom1":
      return "Custom 1";
    case "custom2":
      return "Custom 2";
    default:
      return mode;
  }
}
