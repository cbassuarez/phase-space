import * as THREE from "three";
import type { Palette } from "../../../types";

export function colorForTrajectory(idx: number, palette: Palette, shift = 0): THREE.Color {
  if (palette === "plasma") {
    const colors = ["#f72585", "#b5179e", "#7209b7", "#4361ee", "#4cc9f0"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  if (palette === "viridis") {
    const colors = ["#440154", "#482878", "#3e4989", "#26828e", "#35b779", "#90d743", "#fde725"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  if (palette === "rainbow") {
    const colors = ["#ff7a73", "#ffd66b", "#7cffc4", "#4f6fff", "#c084fc"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  if (palette === "inferno") {
    const colors = ["#000004", "#3a0b39", "#781c6d", "#b0304f", "#ed6925", "#fbb61a", "#fcffa4"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  if (palette === "magma") {
    const colors = ["#0b0623", "#3c0f70", "#7c1f7c", "#b53679", "#e16462", "#f8c266", "#fbfbd4"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  if (palette === "cividis") {
    const colors = ["#00224e", "#2e4a87", "#4f6da1", "#7a8c7f", "#a6a86c", "#d0c86f", "#f5e58d"];
    return new THREE.Color(colors[((idx + Math.floor(shift * colors.length)) % colors.length + colors.length) % colors.length]);
  }
  const base = ["#4f6fff", "#ff7a73", "#ffd66b", "#6ee7b7", "#a78bfa"];
  return new THREE.Color(base[((idx + Math.floor(shift * base.length)) % base.length + base.length) % base.length]);
}
