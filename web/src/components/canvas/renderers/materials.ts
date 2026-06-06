import { Color, Vector3 } from "three";
import type { MaterialStyle, MaterialTransmission } from "../../../types";
import { materialStyleToTransmission } from "../../../types";
import type { LightingConfig } from "../../../visual/lighting";
import { expApproach } from "../../../camera/smoothing";
import { TAU_MATERIAL, TAU_SCALARS } from "../../../visual/transitionConfig";

export interface MaterialUniforms {
  uRoughness: { value: number };
  uMetallic: { value: number };
  uTransmission: { value: number };
  uEmissive: { value: number };
  uFresnelPower: { value: number };
  uMaterialAlpha: { value: number };
  uExposure: { value: number };
}

export interface LightingUniforms {
  uKeyDir: { value: Vector3 };
  uKeyColor: { value: Color };
  uKeyI: { value: number };
  uFillDir: { value: Vector3 };
  uFillColor: { value: Color };
  uFillI: { value: number };
  uAmbient: { value: Color };
}

interface MaterialSettings {
  roughness: number;
  metallic: number;
  transmission: number;
  emissive: number;
  fresnelPower: number;
  alpha: number;
  exposure: number;
}

type MaterialInput = MaterialStyle | MaterialTransmission | undefined;

const MATERIAL_PRESETS: Record<MaterialStyle, MaterialSettings> = {
  metal: {
    roughness: 0.28,
    metallic: 0.82,
    transmission: 0.02,
    emissive: 0.18,
    fresnelPower: 4.4,
    alpha: 0.97,
    exposure: 1.35,
  },
  glass: {
    roughness: 0.18,
    metallic: 0,
    transmission: 0.52,
    emissive: 0.28,
    fresnelPower: 3.1,
    alpha: 0.9,
    exposure: 1.5,
  },
  plasma: {
    roughness: 0.56,
    metallic: 0,
    transmission: 0.16,
    emissive: 1.4,
    fresnelPower: 2.2,
    alpha: 0.93,
    exposure: 1.9,
  },
};

export const materialShaderChunk = `
  uniform float uRoughness;
  uniform float uMetallic;
  uniform float uTransmission;
  uniform float uEmissive;
  uniform float uFresnelPower;
  uniform float uMaterialAlpha;
  uniform float uExposure;

  float psSaturate(float v) {
    return clamp(v, 0.0, 1.0);
  }

  vec3 psSaturation(vec3 c, float s) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return max(vec3(0.0), mix(vec3(l), c, s));
  }

  vec3 psFilmicToneMap(vec3 color) {
    color = max(color, vec3(0.0));
    // Boost chroma in the HDR domain before tone compression: saturated mids
    // stay vivid while hot cores still blow out toward white.
    color = psSaturation(color, 1.5);
    color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
    return clamp(color, 0.0, 1.0);
  }

  float psFresnel(vec3 normal, vec3 viewDir, float power) {
    return pow(1.0 - psSaturate(dot(normalize(normal), normalize(viewDir))), max(0.5, power));
  }

  float psFieldEnergy(vec4 field) {
    return psSaturate(field.x * 0.25 + field.y * 0.35 + field.z * 0.45);
  }

  float psPaletteT(float colorT, vec4 field, float shift) {
    float woven = colorT + field.x * 0.07 - field.y * 0.05 + field.z * 0.11 + field.w * 0.17;
    return fract(woven + shift);
  }

  vec3 psMaterialShade(
    vec3 albedo,
    vec3 normal,
    vec3 viewDir,
    vec3 keyDir,
    vec3 keyColor,
    float keyI,
    vec3 fillDir,
    vec3 fillColor,
    float fillI,
    vec3 ambient,
    float fieldEnergy,
    float rimBias
  ) {
    vec3 N = normalize(normal);
    vec3 V = normalize(viewDir);
    vec3 L = normalize(keyDir);
    vec3 F = normalize(fillDir);
    float key = max(dot(N, L), 0.0);
    float fill = max(dot(N, F) * 0.5 + 0.5, 0.0);
    fill *= fill;

    vec3 H = normalize(L + V);
    float rough = psSaturate(uRoughness);
    float specPower = mix(96.0, 9.0, rough);
    float spec = pow(max(dot(N, H), 0.0), specPower) * mix(1.45, 0.3, rough);
    float fresnel = psFresnel(N, V, uFresnelPower);

    vec3 diffuse =
        albedo * keyColor * key * keyI
      + albedo * fillColor * fill * fillI
      + albedo * ambient;

    vec3 specColor = mix(vec3(1.0), albedo, psSaturate(uMetallic));
    vec3 reflected = specColor * keyColor * spec * keyI;
    // Tint the Fresnel rim toward the albedo so broad grazing surfaces (the
    // whole face of a ribbon/line) carry the palette colour instead of washing
    // to white — which only showed up once the dim background went true black.
    vec3 rimColor = mix(keyColor, albedo, 0.6);
    vec3 rim = rimColor * fresnel * (0.3 + rimBias * 0.45) * (0.5 + keyI * 0.5);
    vec3 transmitted = albedo * uTransmission * (0.18 + fieldEnergy * 0.72) * (1.0 - key * 0.45);
    vec3 emitted = albedo * uEmissive * (0.45 + fieldEnergy * 1.35);

    return diffuse * (1.0 - uMetallic * 0.58) + reflected + rim + transmitted + emitted;
  }
`;

// "Draw" mode: a light racing the path, with a phosphor-style decay behind it.
// `arc` is the per-vertex normalized arc position (0..1). Returns a brightness
// multiplier — 1 everywhere at uDecay=0 (full path, no change), shrinking to a
// single glowing point at uDecay=1. The head core is >1 (blooms) and scales with
// decay so the full-path end has no spurious hotspot. Gated by uTrace.
export const traceShaderChunk = `
  uniform float uTrace;
  uniform float uHead;
  uniform float uDecay;   // 0 = full path, 1 = point source
  float psCometMask(float arc) {
    float behind = fract(uHead - arc);            // 0 at head, →1 going backwards
    float p = exp2(uDecay * 15.0) - 1.0;          // 0 (full) → ~32767 (tight point)
    float body = pow(max(0.0, 1.0 - behind), p);  // phosphor decay behind the head
    float head = (1.0 - smoothstep(0.0, 0.004, behind)) * uDecay; // glowing tip
    return clamp(body + head * 1.6, 0.0, 4.0);
  }
`;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerpValue(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function lerpSettings(from: MaterialSettings, to: MaterialSettings, t: number): MaterialSettings {
  return {
    roughness: lerpValue(from.roughness, to.roughness, t),
    metallic: lerpValue(from.metallic, to.metallic, t),
    transmission: lerpValue(from.transmission, to.transmission, t),
    emissive: lerpValue(from.emissive, to.emissive, t),
    fresnelPower: lerpValue(from.fresnelPower, to.fresnelPower, t),
    alpha: lerpValue(from.alpha, to.alpha, t),
    exposure: lerpValue(from.exposure, to.exposure, t),
  };
}

export function materialSettings(input: MaterialInput): MaterialSettings {
  const transmission =
    typeof input === "number" ? clamp01(input) : materialStyleToTransmission(input);

  if (transmission <= 0.5) {
    return lerpSettings(MATERIAL_PRESETS.metal, MATERIAL_PRESETS.glass, transmission / 0.5);
  }

  return lerpSettings(MATERIAL_PRESETS.glass, MATERIAL_PRESETS.plasma, (transmission - 0.5) / 0.5);
}

// Global attractor opacity ("opacity layer control"). A single multiplier on
// every material's alpha, set live from the UI — lets the user fade the
// attractor down off the blown-out HDR ceiling without touching exposure.
// Eased toward its target so the fade glides instead of snapping.
let materialOpacity = 1;
let materialOpacityTarget = 1;

export function setMaterialOpacity(value: number) {
  materialOpacityTarget = Math.max(0.05, Math.min(1, value));
}

// Eased material settings. The discrete style enum becomes continuous here:
// `advanceMaterialTransition` lerps these toward the target style's preset once
// per frame, and the uniform readers below read the eased values — so switching
// material (and fading opacity) glides with zero renderer changes.
let easedSettings: MaterialSettings = materialSettings("glass");
let materialEasedInit = false;

export function advanceMaterialTransition(
  dt: number,
  targetMaterial: MaterialInput,
  reduced = false
) {
  const tgt = materialSettings(targetMaterial);
  if (!materialEasedInit || reduced) {
    easedSettings = { ...tgt };
    materialOpacity = materialOpacityTarget;
    materialEasedInit = true;
    return;
  }
  easedSettings.roughness = expApproach(easedSettings.roughness, tgt.roughness, dt, TAU_MATERIAL);
  easedSettings.metallic = expApproach(easedSettings.metallic, tgt.metallic, dt, TAU_MATERIAL);
  easedSettings.transmission = expApproach(easedSettings.transmission, tgt.transmission, dt, TAU_MATERIAL);
  easedSettings.emissive = expApproach(easedSettings.emissive, tgt.emissive, dt, TAU_MATERIAL);
  easedSettings.fresnelPower = expApproach(easedSettings.fresnelPower, tgt.fresnelPower, dt, TAU_MATERIAL);
  easedSettings.alpha = expApproach(easedSettings.alpha, tgt.alpha, dt, TAU_MATERIAL);
  easedSettings.exposure = expApproach(easedSettings.exposure, tgt.exposure, dt, TAU_MATERIAL);
  materialOpacity = expApproach(materialOpacity, materialOpacityTarget, dt, TAU_SCALARS);
}

export function createMaterialUniforms(_material: MaterialInput): MaterialUniforms {
  const s = easedSettings;
  return {
    uRoughness: { value: s.roughness },
    uMetallic: { value: s.metallic },
    uTransmission: { value: s.transmission },
    uEmissive: { value: s.emissive },
    uFresnelPower: { value: s.fresnelPower },
    uMaterialAlpha: { value: s.alpha * materialOpacity },
    uExposure: { value: s.exposure },
  };
}

export function applyMaterialUniforms(
  uniforms: Partial<MaterialUniforms>,
  _material: MaterialInput,
  emissiveBoost = 0
) {
  const s = easedSettings; // eased per-frame by advanceMaterialTransition
  if (uniforms.uRoughness) uniforms.uRoughness.value = s.roughness;
  if (uniforms.uMetallic) uniforms.uMetallic.value = s.metallic;
  if (uniforms.uTransmission) uniforms.uTransmission.value = s.transmission;
  if (uniforms.uEmissive) uniforms.uEmissive.value = s.emissive + emissiveBoost * 0.35;
  if (uniforms.uFresnelPower) uniforms.uFresnelPower.value = s.fresnelPower;
  if (uniforms.uMaterialAlpha) uniforms.uMaterialAlpha.value = s.alpha * materialOpacity;
  if (uniforms.uExposure) uniforms.uExposure.value = s.exposure;
}

export function createLightingUniforms(lighting: LightingConfig): LightingUniforms {
  return {
    uKeyDir: { value: new Vector3().fromArray(lighting.keyDir) },
    uKeyColor: { value: new Color().fromArray(lighting.keyColor) },
    uKeyI: { value: lighting.keyIntensity },
    uFillDir: { value: new Vector3().fromArray(lighting.fillDir) },
    uFillColor: { value: new Color().fromArray(lighting.fillColor) },
    uFillI: { value: lighting.fillIntensity },
    uAmbient: { value: new Color().fromArray(lighting.ambient) },
  };
}

export function applyLightingUniforms(uniforms: Partial<LightingUniforms>, lighting: LightingConfig) {
  if (uniforms.uKeyDir) uniforms.uKeyDir.value.fromArray(lighting.keyDir);
  if (uniforms.uKeyColor) uniforms.uKeyColor.value.fromArray(lighting.keyColor);
  if (uniforms.uKeyI) uniforms.uKeyI.value = lighting.keyIntensity;
  if (uniforms.uFillDir) uniforms.uFillDir.value.fromArray(lighting.fillDir);
  if (uniforms.uFillColor) uniforms.uFillColor.value.fromArray(lighting.fillColor);
  if (uniforms.uFillI) uniforms.uFillI.value = lighting.fillIntensity;
  if (uniforms.uAmbient) uniforms.uAmbient.value.fromArray(lighting.ambient);
}
