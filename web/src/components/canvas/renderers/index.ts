import type { RenderStyle } from "../../../types";
import type { RendererStrategy } from "./base";
import { NeonFilamentsRenderer } from "./NeonFilamentsRenderer";
import { VolumetricCloudRenderer } from "./VolumetricCloudRenderer";
import { CrtScopeRenderer } from "./CrtScopeRenderer";
import { RibbonRenderer } from "./RibbonRenderer";
import { PathTraceRenderer } from "./PathTraceRenderer";

export function createRendererForStyle(style: RenderStyle): RendererStrategy {
  switch (style) {
    case "volumetric-cloud":
      return new VolumetricCloudRenderer();
    case "crt-scope":
      return new CrtScopeRenderer();
    case "ribbon":
      return new RibbonRenderer();
    case "path-trace":
      return new PathTraceRenderer();
    case "neon-filaments":
    default:
      return new NeonFilamentsRenderer();
  }
}
