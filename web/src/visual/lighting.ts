import { Vector3 } from "three";
import { expApproach, slerp } from "../camera/smoothing";
import { TAU_LIGHTING } from "./transitionConfig";

/**
 * Shared lighting state for every renderer.
 *
 * Treated as a singleton: each renderer reads `getLighting()` from
 * its applyDynamic() each frame and pushes the values into its
 * shader uniforms. The host UI (LightingTweaks) writes via
 * `setLighting()` / `setPreset()` and the next animation frame picks
 * up the change.
 *
 * Why a singleton rather than threading through TrajectoryData:
 * lighting is a property of the world, not of the data being drawn.
 * Splitting it out keeps the renderer prop shape stable and means
 * any future overlay or HUD renderer can share the same light rig
 * for free.
 */

export interface LightingConfig {
  /** World-space direction TOWARD the key light (normalized). */
  keyDir: [number, number, number];
  /** Linear RGB. Brightness × tint of the dominant light. */
  keyColor: [number, number, number];
  keyIntensity: number;

  /** Direction TOWARD the fill (usually opposite-ish of key, dimmer). */
  fillDir: [number, number, number];
  fillColor: [number, number, number];
  fillIntensity: number;

  /** Baseline ambient — keeps shadowed sides from going black. */
  ambient: [number, number, number];

  /**
   * 0..1. Used by the ray-march renderer to attenuate self-shadow
   * weight. Independent control because volumetric shadowing tends
   * to over-darken if tuned by global ambient.
   */
  shadowDensity: number;
}

const norm = (v: [number, number, number]): [number, number, number] => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

export const DEFAULT_LIGHTING: LightingConfig = {
  keyDir: norm([0.55, 0.75, 0.4]),
  keyColor: [1.0, 0.95, 0.88],
  keyIntensity: 1.0,

  fillDir: norm([-0.45, -0.2, -0.7]),
  fillColor: [0.55, 0.7, 0.95],
  fillIntensity: 0.35,

  ambient: [0.16, 0.18, 0.24],

  shadowDensity: 0.55,
};

/** Curated lighting setups. Tweaks UI cycles through these as presets. */
export const LIGHTING_PRESETS: { id: string; label: string; config: LightingConfig }[] = [
  {
    id: "studio",
    label: "Studio",
    config: DEFAULT_LIGHTING,
  },
  {
    id: "noir",
    label: "Noir",
    config: {
      keyDir: norm([0.9, 0.3, 0.2]),
      keyColor: [1.0, 0.85, 0.7],
      keyIntensity: 1.2,
      fillDir: norm([-0.9, -0.1, 0.4]),
      fillColor: [0.25, 0.3, 0.55],
      fillIntensity: 0.15,
      ambient: [0.04, 0.05, 0.08],
      shadowDensity: 0.95,
    },
  },
  {
    id: "twilight",
    label: "Twilight",
    config: {
      keyDir: norm([0.3, -0.2, 0.9]),
      keyColor: [1.0, 0.6, 0.35],
      keyIntensity: 0.9,
      fillDir: norm([-0.6, 0.7, -0.3]),
      fillColor: [0.35, 0.45, 0.95],
      fillIntensity: 0.5,
      ambient: [0.12, 0.10, 0.22],
      shadowDensity: 0.65,
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    config: {
      keyDir: norm([0.1, 0.95, 0.2]),
      keyColor: [0.65, 1.0, 0.85],
      keyIntensity: 1.1,
      fillDir: norm([-0.4, -0.6, -0.7]),
      fillColor: [0.7, 0.4, 0.95],
      fillIntensity: 0.55,
      ambient: [0.10, 0.16, 0.20],
      shadowDensity: 0.45,
    },
  },
  {
    id: "flat",
    label: "Flat",
    config: {
      keyDir: norm([0, 1, 0]),
      keyColor: [1, 1, 1],
      keyIntensity: 0.7,
      fillDir: norm([0, -1, 0]),
      fillColor: [1, 1, 1],
      fillIntensity: 0.7,
      ambient: [0.45, 0.45, 0.45],
      shadowDensity: 0.15,
    },
  },
];

let _state: LightingConfig = { ...DEFAULT_LIGHTING };
let _presetId = "studio";

// Eased copy of the lighting the renderers actually use, so preset/slider
// changes glide instead of snapping. `_state` stays the immediate target (read
// by the UI); `_eased` is advanced toward it once per frame.
let _eased: LightingConfig = cloneLighting(DEFAULT_LIGHTING);
let _lightingEasedInit = false;

function cloneLighting(c: LightingConfig): LightingConfig {
  return {
    keyDir: [c.keyDir[0], c.keyDir[1], c.keyDir[2]],
    keyColor: [c.keyColor[0], c.keyColor[1], c.keyColor[2]],
    keyIntensity: c.keyIntensity,
    fillDir: [c.fillDir[0], c.fillDir[1], c.fillDir[2]],
    fillColor: [c.fillColor[0], c.fillColor[1], c.fillColor[2]],
    fillIntensity: c.fillIntensity,
    ambient: [c.ambient[0], c.ambient[1], c.ambient[2]],
    shadowDensity: c.shadowDensity,
  };
}

function easeTriple(
  out: [number, number, number],
  tgt: readonly [number, number, number],
  dt: number
) {
  out[0] = expApproach(out[0], tgt[0], dt, TAU_LIGHTING);
  out[1] = expApproach(out[1], tgt[1], dt, TAU_LIGHTING);
  out[2] = expApproach(out[2], tgt[2], dt, TAU_LIGHTING);
}

type Subscriber = (state: LightingConfig, presetId: string) => void;
const subscribers: Subscriber[] = [];

/** The eased lighting the renderers consume each frame (glides on changes). */
export function getLighting(): LightingConfig {
  return _eased;
}

/** The immediate target lighting — for UI sliders that must reflect the set value. */
export function getLightingTarget(): LightingConfig {
  return _state;
}

/** Advance the eased lighting toward the target. Call once per frame. */
export function advanceLightingTransition(dt: number, reduced = false): void {
  if (!_lightingEasedInit || reduced) {
    _eased = cloneLighting(_state);
    _lightingEasedInit = true;
    return;
  }
  _eased.keyIntensity = expApproach(_eased.keyIntensity, _state.keyIntensity, dt, TAU_LIGHTING);
  _eased.fillIntensity = expApproach(_eased.fillIntensity, _state.fillIntensity, dt, TAU_LIGHTING);
  _eased.shadowDensity = expApproach(_eased.shadowDensity, _state.shadowDensity, dt, TAU_LIGHTING);
  easeTriple(_eased.keyColor, _state.keyColor, dt);
  easeTriple(_eased.fillColor, _state.fillColor, dt);
  easeTriple(_eased.ambient, _state.ambient, dt);
  // Directions are unit vectors — slerp for a clean rotation, then store back.
  const t = 1 - Math.exp(-Math.min(Math.max(dt, 1e-4), 1 / 30) / TAU_LIGHTING);
  const kd = slerp(_eased.keyDir, _state.keyDir, t);
  _eased.keyDir = [kd[0], kd[1], kd[2]];
  const fd = slerp(_eased.fillDir, _state.fillDir, t);
  _eased.fillDir = [fd[0], fd[1], fd[2]];
}

export function getLightingPresetId(): string {
  return _presetId;
}

export function setLighting(patch: Partial<LightingConfig>, opts?: { keepPresetId?: boolean }) {
  _state = { ..._state, ...patch };
  if (!opts?.keepPresetId) _presetId = "custom";
  subscribers.forEach((fn) => fn(_state, _presetId));
}

export function setLightingPreset(id: string) {
  const preset = LIGHTING_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  _state = { ...preset.config };
  _presetId = id;
  subscribers.forEach((fn) => fn(_state, _presetId));
}

/**
 * Rotate the key light around the world Y axis by `azimuthRadians`,
 * preserving its elevation. Useful for a single-slider "swing the
 * sun" tweak.
 */
export function setKeyAzimuth(azimuthRadians: number) {
  const [, y] = _state.keyDir;
  // Use current elevation, replace azimuth.
  const horizMag = Math.sqrt(Math.max(0, 1 - y * y));
  const newDir: [number, number, number] = [
    Math.cos(azimuthRadians) * horizMag,
    y,
    Math.sin(azimuthRadians) * horizMag,
  ];
  setLighting({ keyDir: newDir });
}

export function getKeyAzimuth(): number {
  const [x, , z] = _state.keyDir;
  return Math.atan2(z, x);
}

export function subscribeLighting(fn: Subscriber): () => void {
  subscribers.push(fn);
  fn(_state, _presetId);
  return () => {
    const i = subscribers.indexOf(fn);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

/** Helper for renderers: copy the eased keyDir into a reusable Vector3. */
export function copyKeyDir(out: Vector3): Vector3 {
  return out.set(_eased.keyDir[0], _eased.keyDir[1], _eased.keyDir[2]);
}

/** Helper for renderers: copy the eased fillDir into a reusable Vector3. */
export function copyFillDir(out: Vector3): Vector3 {
  return out.set(_eased.fillDir[0], _eased.fillDir[1], _eased.fillDir[2]);
}
