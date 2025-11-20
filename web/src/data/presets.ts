import type { SystemId } from "./systems";

export type Preset = {
  id: string;
  name: string;
  system: SystemId;
  tags: string[];
  cameraMode?: string;
  description: string;
  thumbnail?: string;
  // Optional: for deep-linking; viewer will interpret these query params.
  query: {
    system?: SystemId;
    preset?: string;
  };
};

export const presets: Preset[] = [
  {
    id: "lorenz-classic",
    name: "Lorenz: Classic Butterfly",
    system: "lorenz",
    tags: ["default", "balanced", "two-lobed"],
    cameraMode: "orbit",
    description: "The canonical Lorenz attractor at σ=10, ρ=28, β=8/3.",
    thumbnail: "/images/presets/lorenz-classic.png",
    query: { system: "lorenz", preset: "classic" },
  },
  {
    id: "rossler-sheet",
    name: "Rössler: Spiral Sheet",
    system: "rossler",
    tags: ["spiral", "sheet", "surface"],
    cameraMode: "grid-surface",
    description: "A smooth spiral sheet that shows off the surface-like structure.",
    thumbnail: "/images/presets/rossler-sheet.png",
    query: { system: "rossler", preset: "sheet" },
  },
  {
    id: "aizawa-bloom",
    name: "Aizawa: Knotted Bloom",
    system: "aizawa",
    tags: ["knot", "volumetric", "dense"],
    cameraMode: "drone-ghost",
    description: "A dense, flower-like attractor with filaments weaving through each other.",
    thumbnail: "/images/presets/aizawa-bloom.png",
    query: { system: "aizawa", preset: "bloom" },
  },
  {
    id: "thomas-ghost-rings",
    name: "Thomas: Ghost Rings",
    system: "thomas",
    tags: ["torus-like", "loop", "gentle"],
    cameraMode: "path-rider",
    description: "Soft loop-like trajectories that feel like drifting ghost rings.",
    thumbnail: "/images/presets/thomas-ghost-rings.png",
    query: { system: "thomas", preset: "ghost-rings" },
  },
];
