import type { SceneSpec } from "../types";
import { createDefaultCameraProgram } from "../camera/migrate";

// A user-defined attractor is pure data: three derivative equations (math
// strings over x,y,z,t + named params), parameter defaults, seeds, and
// integration settings. Safe to store, export, and share — there is no code.

export interface AttractorParam {
  name: string;
  default: number;
  min?: number;
  max?: number;
}

export interface AttractorDef {
  schema: 1;
  id: string; // "local/<slug>" | "<author>/<slug>"
  name: string;
  author?: string;
  description?: string;
  equations: { dx: string; dy: string; dz: string };
  params: AttractorParam[];
  seeds: { x: [number, number, number] }[];
  integrator: { dt: number; steps: number; discardInitial?: number; maxRadius?: number };
  license?: string;
  version?: number;
  /** Provenance, set by the app — not persisted in shared manifests. */
  source?: "local" | "community" | "template";
}

export const ATTRACTOR_SCHEMA = 1 as const;

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "attractor"
  );
}

export function blankAttractor(): AttractorDef {
  return {
    schema: ATTRACTOR_SCHEMA,
    id: `local/${slugify("untitled")}-${Date.now().toString(36)}`,
    name: "Untitled",
    equations: { dx: "sigma*(y - x)", dy: "x*(rho - z) - y", dz: "x*y - beta*z" },
    params: [
      { name: "sigma", default: 10, min: 0, max: 30 },
      { name: "rho", default: 28, min: 0, max: 60 },
      { name: "beta", default: 2.667, min: 0, max: 8 },
    ],
    seeds: [{ x: [0.1, 0, 0] }, { x: [0.1001, 0, 0] }],
    integrator: { dt: 0.01, steps: 12000, discardInitial: 1000, maxRadius: 1000 },
    source: "local",
  };
}

/** Starter templates shown in the modal — teach the syntax by editing. */
export const ATTRACTOR_TEMPLATES: AttractorDef[] = [
  {
    schema: 1,
    id: "template/lorenz",
    name: "Lorenz",
    description: "The classic butterfly.",
    equations: { dx: "sigma*(y - x)", dy: "x*(rho - z) - y", dz: "x*y - beta*z" },
    params: [
      { name: "sigma", default: 10, min: 0, max: 30 },
      { name: "rho", default: 28, min: 0, max: 60 },
      { name: "beta", default: 2.667, min: 0, max: 8 },
    ],
    seeds: [{ x: [0.1, 0, 0] }, { x: [0.1001, 0, 0] }],
    integrator: { dt: 0.01, steps: 12000, discardInitial: 1000, maxRadius: 1000 },
    source: "template",
  },
  {
    schema: 1,
    id: "template/thomas",
    name: "Thomas (cyclic)",
    description: "Cyclically symmetric, uses sin().",
    equations: { dx: "sin(y) - b*x", dy: "sin(z) - b*y", dz: "sin(x) - b*z" },
    params: [{ name: "b", default: 0.208186, min: 0, max: 0.4 }],
    seeds: [{ x: [1.1, 1.1, -0.01] }],
    integrator: { dt: 0.02, steps: 14000, discardInitial: 1500, maxRadius: 1000 },
    source: "template",
  },
  {
    schema: 1,
    id: "template/halvorsen",
    name: "Halvorsen",
    description: "Cyclically symmetric, quadratic.",
    equations: {
      dx: "-a*x - 4*y - 4*z - y^2",
      dy: "-a*y - 4*z - 4*x - z^2",
      dz: "-a*z - 4*x - 4*y - x^2",
    },
    params: [{ name: "a", default: 1.4, min: 0.5, max: 3 }],
    seeds: [{ x: [-1.48, -1.51, 2.04] }],
    integrator: { dt: 0.005, steps: 10000, discardInitial: 800, maxRadius: 200 },
    source: "template",
  },
  {
    schema: 1,
    id: "template/dadras",
    name: "Dadras",
    description: "Multi-scroll.",
    equations: { dx: "y - a*x + b*y*z", dy: "c*y - x*z + z", dz: "d*x*y - h*z" },
    params: [
      { name: "a", default: 3, min: 1, max: 5 },
      { name: "b", default: 2.7, min: 1, max: 4 },
      { name: "c", default: 1.7, min: 1, max: 3 },
      { name: "d", default: 2, min: 1, max: 4 },
      { name: "h", default: 9, min: 5, max: 12 },
    ],
    seeds: [{ x: [1.1, 2.1, -2] }],
    integrator: { dt: 0.01, steps: 12000, discardInitial: 1000, maxRadius: 1000 },
    source: "template",
  },
];

/** Build a runnable SceneSpec from a manifest (+ optional live param values). */
export function buildCustomScene(
  def: AttractorDef,
  paramValues?: Record<string, number>
): SceneSpec {
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.name] = paramValues?.[p.name] ?? p.default;

  const camera = createDefaultCameraProgram();
  camera.mode = "chase";

  const scene = {
    id: def.id,
    system: "custom",
    params,
    custom: { equations: { ...def.equations } },
    initial_seeds: def.seeds.map((s, i) => ({ x: s.x, color_index: i })),
    integrator: {
      dt: def.integrator.dt,
      steps: def.integrator.steps,
      discard_initial: def.integrator.discardInitial ?? 0,
      max_radius: def.integrator.maxRadius ?? 1000,
    },
    view: {
      mode: "mode3d",
      plane: null,
      camera: { theta: 0.8, phi: 0.9, r: 25 },
      palette: "prism",
      background: "dark",
      point_size: 1,
      render_style: "line",
    },
    random_seed: 1,
    camera,
  };
  return scene as unknown as SceneSpec;
}

/** The exact payload `validate_attractor` (and the integrator) expect. */
export function validationInput(def: AttractorDef, paramValues?: Record<string, number>) {
  const params: Record<string, number> = {};
  for (const p of def.params) params[p.name] = paramValues?.[p.name] ?? p.default;
  return JSON.stringify({ equations: def.equations, params });
}

// --- local library (localStorage) ------------------------------------------

const STORAGE_KEY = "phase-space.attractors";

export function loadUserAttractors(): AttractorDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as AttractorDef[];
    return Array.isArray(list) ? list.map((d) => ({ ...d, source: "local" as const })) : [];
  } catch {
    return [];
  }
}

export function saveUserAttractors(list: AttractorDef[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

export function upsertUserAttractor(def: AttractorDef): AttractorDef[] {
  const list = loadUserAttractors();
  const i = list.findIndex((d) => d.id === def.id);
  const clean = { ...def, source: "local" as const };
  if (i >= 0) list[i] = clean;
  else list.push(clean);
  saveUserAttractors(list);
  return list;
}

export function deleteUserAttractor(id: string): AttractorDef[] {
  const list = loadUserAttractors().filter((d) => d.id !== id);
  saveUserAttractors(list);
  return list;
}

// --- sharing (export / import / URL) ---------------------------------------

/** Strip provenance/transient fields for a clean shareable manifest. */
export function toManifest(def: AttractorDef): Omit<AttractorDef, "source"> {
  const { source: _source, ...rest } = def;
  return { ...rest, schema: ATTRACTOR_SCHEMA };
}

export function exportJSON(def: AttractorDef): string {
  return JSON.stringify(toManifest(def), null, 2);
}

export function parseManifest(json: string): AttractorDef {
  const obj = JSON.parse(json) as AttractorDef;
  if (!obj || !obj.equations || !obj.equations.dx) {
    throw new Error("Not an attractor manifest");
  }
  return { ...obj, schema: ATTRACTOR_SCHEMA, source: "local" };
}

export function encodeToHash(def: AttractorDef): string {
  return "#attractor=" + encodeURIComponent(btoa(JSON.stringify(toManifest(def))));
}

export function decodeFromHash(hash: string): AttractorDef | null {
  const m = /[#&]attractor=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    return parseManifest(atob(decodeURIComponent(m[1])));
  } catch {
    return null;
  }
}
