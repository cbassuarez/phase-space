import type {
  Background,
  CausticsSettings,
  LineThickness,
  Palette,
  PhotonWeaveSettings,
  RenderStyle,
} from "../../../types";
import type { CustomPaletteState } from "../../../palettes";
import type { RenderQuality } from "../../../visual/renderQuality";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { NormalizedTrajectories } from "./normalize";
import type { DynamicScalars } from "./utils";

export interface TrajectoryData {
  trajectories: number[][][];
  normalized?: NormalizedTrajectories;
  dynamics?: DynamicScalars;
  palette: Palette;
  customPalette: CustomPaletteState;
  lineThickness: LineThickness;
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

export interface RendererStrategy {
  readonly style: RenderStyle;
  init(context: RenderContext, data: TrajectoryData): void;
  update(context: RenderContext, data: TrajectoryData): void;
  dispose(context: RenderContext): void;
  updateDrawWindow?(trajectoryIndex: number, start: number, count: number): void;
  renderStill?(context: RenderContext): void;
   applyDynamic?(data: TrajectoryData): void;
}
