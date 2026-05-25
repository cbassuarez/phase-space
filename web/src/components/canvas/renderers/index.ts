import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { PhotonWeaveRenderer } from "./PhotonWeaveRenderer";
import { RayMarchRenderer } from "./RayMarchRenderer";
import { CausticsRenderer } from "./CausticsRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { CellsRenderer } from "./CellsRenderer";
import { LineRenderer } from "./LineRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "line":
      return new LineRenderer();
    case "volumetric-cloud":
      return new RayMarchRenderer();
    case "caustics":
      return new CausticsRenderer();
    case "ribbon":
      return new RibbonRenderer();
    case "cells":
      return new CellsRenderer();
    case "photon-weave":
      return new PhotonWeaveRenderer();
    default:
      return new LineRenderer();
  }
}
