import type {
  Background,
  CausticsSettings,
  CellShape,
  LineThickness,
  MaterialStyle,
  MaterialTransmission,
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
  /** Eased numeric override for the cell shape (0 round, 1 cel, 2 square). */
  cellShapeNumber?: number;
  /** Eased cell size multiplier from the UI. */
  cellSize?: number;
  /** Eased line/cell weight tier (0 thin, 1 default, 2 thick) for smooth width changes. */
  thicknessT?: number;
  /** Draw mode: render a single comet racing the path instead of the whole path. */
  traceActive?: boolean;
  /** Comet head position, 0..1 looping arc fraction (shared across trajectories). */
  traceHead?: number;
  /** Comet tail length as an arc fraction of the path. */
  traceDecay?: number;
  materialStyle: MaterialStyle;
  materialTransmission: MaterialTransmission;
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

/** Continuous thin→default→thick interpolation from a tier scalar (0..2). */
export function lerpThickness(t: number, thin: number, def: number, thick: number): number {
  if (t <= 1) return thin + (def - thin) * Math.max(0, t);
  return def + (thick - def) * Math.min(1, t - 1);
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
