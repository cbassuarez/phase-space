import * as THREE from "three";
import type { Palette } from "../../../types";

export function colorForTrajectory(idx: number, palette: Palette): THREE.Color {
  if (palette === "plasma") {
    const colors = ["#f72585", "#b5179e", "#7209b7", "#4361ee", "#4cc9f0"];
    return new THREE.Color(colors[idx % colors.length]);
  }
  if (palette === "viridis") {
    const colors = ["#440154", "#482878", "#3e4989", "#26828e", "#35b779", "#90d743", "#fde725"];
    return new THREE.Color(colors[idx % colors.length]);
  }
  if (palette === "rainbow") {
    const colors = ["#ff7a73", "#ffd66b", "#7cffc4", "#4f6fff", "#c084fc"];
    return new THREE.Color(colors[idx % colors.length]);
  }
  const base = ["#4f6fff", "#ff7a73", "#ffd66b", "#6ee7b7", "#a78bfa"];
  return new THREE.Color(base[idx % base.length]);
}
