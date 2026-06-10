import type { VisualFeatureFrame } from "./visualFeatures";

let latestVisualFrame: VisualFeatureFrame | null = null;

export function setLatestVisualFrame(frame: VisualFeatureFrame): void {
  latestVisualFrame = frame;
}

export function getLatestVisualFrame(): VisualFeatureFrame | null {
  return latestVisualFrame;
}
