import * as THREE from "three";
import type { CustomPaletteBank } from "../../../palettes";
import { samplePalette } from "../../../palettes";
import type { Palette } from "../../../types";

export function colorForTrajectory(
  idx: number,
  palette: Palette,
  customPalettes: CustomPaletteBank,
  shift = 0,
  spread = 5
): THREE.Color {
  const denom = Math.max(1, spread - 1);
  const base = ((idx % spread) / denom + shift) % 1;
  const t = base < 0 ? base + 1 : base;
  return samplePalette(palette, t, customPalettes);
}
