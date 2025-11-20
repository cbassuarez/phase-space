import * as THREE from "three";
import type { Palette } from "../../../types";
import type { CustomPaletteBank } from "../../../palettes";
import { samplePalette } from "../../../palettes";

export function colorForTrajectory(
  idx: number,
  total: number,
  palette: Palette,
  customPalettes: CustomPaletteBank,
  shift = 0
): THREE.Color {
  const baseT = total > 1 ? idx / Math.max(1, total - 1) : 0;
  const shifted = (baseT + shift) % 1;
  const wrapped = shifted < 0 ? shifted + 1 : shifted;
  return samplePalette(palette, wrapped, customPalettes);
}
