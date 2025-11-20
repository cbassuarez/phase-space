import type { Background, Resolution } from "../types";
import type { CustomBackgrounds } from "../theme/backgroundModes";
import { getBackgroundColors } from "../theme/backgroundModes";

export interface RenderQuality {
  filamentSampleStep: number;
  filamentTrajectoryFraction: number;
  causticsTextureSize: number;
  causticsPointStep: number;
}

export function getRenderQuality(resolution: Resolution): RenderQuality {
  switch (resolution) {
    case "fast":
      return {
        filamentSampleStep: 4,
        filamentTrajectoryFraction: 0.55,
        causticsTextureSize: 256,
        causticsPointStep: 4,
      };
    case "high":
      return {
        filamentSampleStep: 2,
        filamentTrajectoryFraction: 0.95,
        causticsTextureSize: 768,
        causticsPointStep: 2,
      };
    case "ultra":
      return {
        filamentSampleStep: 1,
        filamentTrajectoryFraction: 1,
        causticsTextureSize: 1024,
        causticsPointStep: 1,
      };
    case "default":
    default:
      return {
        filamentSampleStep: 3,
        filamentTrajectoryFraction: 0.8,
        causticsTextureSize: 512,
        causticsPointStep: 3,
      };
  }
}

export function getViewportBackgroundColor(background: Background, custom: CustomBackgrounds): string {
  return getBackgroundColors(background, custom).scene;
}
