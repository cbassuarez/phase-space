import type { SystemId } from "./systems";

export type FieldNote = {
  id: string;
  title: string;
  system: SystemId;
  summary: string;
  body: string;
  thumbnail?: string;
  // Optional deep link into viewer
  query?: {
    system?: SystemId;
    preset?: string;
  };
};

export const fieldNotes: FieldNote[] = [
  {
    id: "lorenz-high-rho",
    title: "Lorenz at high ρ",
    system: "lorenz",
    summary:
      "Pushing ρ upward spreads the wings into a noisier halo, making transitions more dramatic.",
    body:
      "When ρ increases beyond the classic 28, the two lobes of the Lorenz attractor stretch and blur. The trajectories still hop back and forth, but the 'butterfly' begins to feel more like a cloud. It’s a great place for orbit or lobe-focus modes: the global shape remains familiar, but local detail becomes more surprising.",
    thumbnail: "https://cdn.jsdelivr.net/gh/cbassuarez/phase-space/docs/media/lorenz-hero.png",
    query: { system: "lorenz", preset: "high-rho" },
  },
  {
    id: "aizawa-dense-core",
    title: "Aizawa dense core",
    system: "aizawa",
    summary:
      "Tuning parameters toward a tighter core yields a bright knot of trajectories with a softer outer bloom.",
    body:
      "By nudging parameters to favor the central region, Aizawa forms a knot-like core with a fuzzier envelope around it. Drone-style camera passes reveal how the filaments wrap and unwrap around that core, and a slower path rider along a single trajectory can make the structure feel architectural.",
    thumbnail: "https://cdn.jsdelivr.net/gh/cbassuarez/phase-space/docs/media/aizawa-hero.png",
    query: { system: "aizawa", preset: "dense-core" },
  },
];
