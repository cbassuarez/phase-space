import type {
  Background,
  CausticsSettings,
  CellShape,
  LineThickness,
  MaterialStyle,
  Palette,
  PhotonWeaveSettings,
  RenderStyle,
} from "../../../types";
import type { CustomPaletteState } from "../../../palettes";
import type { RenderQuality } from "../../../visual/renderQuality";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { NormalizedTrajectories } from "./normalize";
import type { VisualField } from "./utils";

export interface TrajectoryData {
  trajectories: number[][][];
  normalized?: NormalizedTrajectories;
  dynamics?: VisualField;
  palette: Palette;
  customPalette: CustomPaletteState;
  lineThickness: LineThickness;
  cellShape?: CellShape;
  materialStyle: MaterialStyle;
  background: Background;
  paletteShift?: number;
  renderEnergy?: number;
  renderPulse?: number;
  lineWidthScale?: number | null;
  cellSizeScale?: number | null;
  emissiveBoost?: number | null;
  ribbonWidth?: number | null;
  ribbonGlow?: number | null;
  cloudDensity?: number | null;
  backgroundBrightness?: number;
  photonWeave?: PhotonWeaveSettings;
  caustics?: CausticsSettings;
  quality?: RenderQuality;
}

export interface RenderContext {
  threeScene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
}

/**
 * Additive blending gives the luminous "neon on black" look, but it
 * accumulates overlapping segments in the framebuffer and clips to white
 * on dense, wound attractors. Reserve it for the true `dark` background
 * where that glow is the intent. `dim` (and `light`) use normal alpha
 * compositing so colors stay readable instead of washing out to a white
 * blob.
 */
export function useAdditiveBlending(background: Background): boolean {
  return background === "dark";
}

export interface RendererStrategy {
  readonly style: RenderStyle;
  init(context: RenderContext, data: TrajectoryData): void;
  update(context: RenderContext, data: TrajectoryData): void;
  dispose(context: RenderContext): void;
  updateDrawWindow?(trajectoryIndex: number, start: number, count: number): void;
  renderStill?(context: RenderContext): void;
   applyDynamic?(data: TrajectoryData): void;
}
