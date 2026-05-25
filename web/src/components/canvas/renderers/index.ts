import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { PhotonWeaveRenderer } from "./PhotonWeaveRenderer";
import { RayMarchRenderer } from "./RayMarchRenderer";
import { CausticsRenderer } from "./CausticsRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { CellsRenderer } from "./CellsRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "volumetric-cloud":
      // Was VolumetricCloudRenderer (soft point sprites). The
      // "volumetric" slot is now actually volumetric: a true
      // ray-marched density field with self-shadowing. The legacy
      // file VolumetricCloudRenderer.ts can be deleted.
      return new RayMarchRenderer();
    case "caustics":
      return new CausticsRenderer();
    case "ribbon":
      return new RibbonRenderer();
    case "cells":
      return new CellsRenderer();
    default:
      return new PhotonWeaveRenderer();
  }
}
