import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { NeonFilamentsRenderer } from "./NeonFilamentsRenderer";
import { VolumetricCloudRenderer } from "./VolumetricCloudRenderer";
import { CrtScopeRenderer } from "./CrtScopeRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { CellRenderer } from "./CellRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "volumetric-cloud":
      return new VolumetricCloudRenderer();
    case "crt-scope":
      return new CrtScopeRenderer();
    case "ribbon":
      return new RibbonRenderer();
    case "cells":
      return new CellRenderer();
    case "neon-filaments":
    default:
      return new NeonFilamentsRenderer();
  }
}
