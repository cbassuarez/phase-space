import * as THREE from "three";
import type { PaletteDef } from "../../../palettes";
import { samplePalette } from "../../../palettes";

export function colorForTrajectory(idx: number, palette: PaletteDef, shift = 0): THREE.Color {
  const t = ((idx * 0.23 + shift) % 1 + 1) % 1;
  const { r, g, b } = samplePalette(palette, t);
  return new THREE.Color(r, g, b);
}
