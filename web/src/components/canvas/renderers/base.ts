import type {
  Background,
  CausticsSettings,
  LineThickness,
  Palette,
  PhotonWeaveSettings,
  RenderStyle,
} from "../../../types";
import type { RenderQuality } from "../../../visual/renderQuality";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";

export interface TrajectoryData {
  trajectories: number[][][];
  palette: Palette;
  lineThickness: LineThickness;
  background: Background;
  paletteShift?: number;
  emissiveBoost?: number | null;
  ribbonWidth?: number | null;
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
