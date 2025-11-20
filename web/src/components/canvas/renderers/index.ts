import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { NeonFilamentsRenderer } from "./NeonFilamentsRenderer";
import { VolumetricCloudRenderer } from "./VolumetricCloudRenderer";
import { CrtScopeRenderer } from "./CrtScopeRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { CellsRenderer } from "./CellsRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "volumetric-cloud":
      return new VolumetricCloudRenderer();
    case "crt-scope":
      return new CrtScopeRenderer();
    case "ribbon":
      return new RibbonRenderer();
    case "cells":
      return new CellsRenderer();
    case "neon-filaments":
    default:
      return new NeonFilamentsRenderer();
  }
}
