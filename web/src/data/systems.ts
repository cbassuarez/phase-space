export type SystemId = "lorenz" | "rossler" | "aizawa" | "thomas";

export type SystemMeta = {
  id: SystemId;
  name: string;
  slug: string;
  tagline: string;
  descriptionShort: string;
  tags: string[];
  heroImage?: string;
  parameterSummary: { name: string; range: string; effect: string }[];
  recommendedCameraModes: { id: string; label: string; description: string }[];
};

export const systems: SystemMeta[] = [
  {
    id: "lorenz",
    slug: "lorenz",
    name: "Lorenz System",
    tagline: "The classic butterfly attractor.",
    descriptionShort:
      "A two-lobed chaotic system whose trajectories swirl between 'wings' in phase space.",
    tags: ["chaotic", "two-lobed", "butterfly"],
    heroImage: "/docs/media/lorenz-hero.png",
    parameterSummary: [
      {
        name: "σ (sigma)",
        range: "≈ 10",
        effect: "Controls how strongly trajectories are pulled toward the central manifold.",
      },
      {
        name: "ρ (rho)",
        range: "≈ 28",
        effect: "Sets how far the 'wings' spread and how trajectories switch between them.",
      },
      {
        name: "β (beta)",
        range: "≈ 8/3",
        effect: "Shapes the thickness and curvature of the attractor.",
      },
    ],
    recommendedCameraModes: [
      {
        id: "orbit",
        label: "Orbit",
        description: "Slowly circles the butterfly, showing both lobes in profile.",
      },
      {
        id: "path-rider",
        label: "Path Rider",
        description: "Rides along a single trajectory as it hops between wings.",
      },
      {
        id: "lobe-focus",
        label: "Lobe Focus",
        description: "Hovers near one lobe at a time, occasionally jumping to the other.",
      },
    ],
  },
  {
    id: "rossler",
    slug: "rossler",
    name: "Rössler System",
    tagline: "A spiraling sheet of chaos.",
    descriptionShort:
      "Trajectories wind around a core and peel off into a warped, spiraling surface.",
    tags: ["spiral", "sheet", "loop"],
    heroImage: "/docs/media/rossler-hero.png",
    parameterSummary: [
      {
        name: "a",
        range: "≈ 0.2",
        effect: "Influences the thickness of the spiral band.",
      },
      {
        name: "b",
        range: "≈ 0.2",
        effect: "Adjusts how trajectories escape and return to the core.",
      },
      {
        name: "c",
        range: "≈ 5.7",
        effect: "Controls how stretched and folded the spiral sheet becomes.",
      },
    ],
    recommendedCameraModes: [
      {
        id: "orbit",
        label: "Orbit",
        description: "Circles the spiral, emphasizing the sheet-like structure.",
      },
      {
        id: "grid-surface",
        label: "Grid Surface",
        description: "Positions the camera relative to a grid plane cutting through the sheet.",
      },
    ],
  },
  {
    id: "aizawa",
    slug: "aizawa",
    name: "Aizawa System",
    tagline: "A knotted bloom of orbits.",
    descriptionShort:
      "Trajectories weave into a dense, flower-like volume with twisting filaments.",
    tags: ["knot", "volumetric", "flower"],
    heroImage: "/docs/media/aizawa-hero.png",
    parameterSummary: [
      { name: "a", range: "≈ 0.95", effect: "Helps shape the core of the attractor." },
      { name: "b", range: "≈ 0.7", effect: "Influences how trajectories wrap around the center." },
      { name: "c", range: "≈ 0.6", effect: "Adjusts the density of loops near the core." },
      { name: "d", range: "≈ 3.5", effect: "Controls how quickly trajectories flare outward." },
      { name: "e", range: "≈ 0.25", effect: "Fine-tunes the thickness of the outer bloom." },
      { name: "f", range: "≈ 0.1", effect: "Adds small distortions to the overall shape." },
    ],
    recommendedCameraModes: [
      {
        id: "orbit",
        label: "Orbit",
        description: "Glides around the bloom to reveal its inner knot.",
      },
      {
        id: "drone-ghost",
        label: "Drone Ghost",
        description: "Floats through the volume like a slow camera drone.",
      },
      { id: "grid-surface", label: "Grid Surface", description: "Skims a plane across the dense bloom." },
      {
        id: "lobe-focus",
        label: "Lobe Focus",
        description: "Hovers near one lobe at a time, occasionally jumping to the other.",
      },
    ],
  },
  {
    id: "thomas",
    slug: "thomas",
    name: "Thomas System",
    tagline: "Ghostly rings in phase space.",
    descriptionShort:
      "Trajectories trace out loop-like shapes that feel like soft, drifting rings.",
    tags: ["torus-like", "cyclic", "ghost"],
    heroImage: "/docs/media/thomas-hero.png",
    parameterSummary: [
      {
        name: "b",
        range: "≈ 0.208",
        effect: "Controls how tightly trajectories loop and how fast they explore the ring.",
      },
    ],
    recommendedCameraModes: [
      {
        id: "orbit",
        label: "Orbit",
        description: "Circles the ring-like structure to show its symmetry.",
      },
      {
        id: "path-rider",
        label: "Path Rider",
        description: "Moves along a single loop, hugging the ring.",
      },
      {
        id: "drone-ghost",
        label: "Drone Ghost",
        description: "Drifts through the ring structure with gentle offsets.",
      },
    ],
  },
];

export function getSystem(id: SystemId): SystemMeta | undefined {
  return systems.find((s) => s.id === id);
}
