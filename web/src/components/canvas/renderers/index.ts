import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { PhotonWeaveRenderer } from "./PhotonWeaveRenderer";
import { VolumetricCloudRenderer } from "./VolumetricCloudRenderer";
import { CausticsRenderer } from "./CausticsRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { CellsRenderer } from "./CellsRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "volumetric-cloud":
      return new VolumetricCloudRenderer();
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
