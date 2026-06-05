import type { Background, RenderStyle, Resolution } from "../types";

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

export function getViewportBackgroundColor(_style: RenderStyle, background: Background): string {
  const darkBase = "#0e1019";
  const lightBase = "#f1f3fb";
  const dimBase = "#000000";

  if (background === "dark") return darkBase;
  if (background === "dim") return dimBase;

  // All styles share the same background per theme — weave/caustics no longer
  // get a custom light-mode tint.
  return lightBase;
}
