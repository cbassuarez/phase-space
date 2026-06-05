import { Color, Vector3 } from "three";
import type { MaterialStyle } from "../../../types";
import type { LightingConfig } from "../../../visual/lighting";

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

export function materialSettings(style: MaterialStyle | undefined): MaterialSettings {
  switch (style) {
    case "metal":
      return {
        roughness: 0.28,
        metallic: 0.82,
        transmission: 0.02,
        emissive: 0.18,
        fresnelPower: 4.4,
        alpha: 0.97,
        exposure: 1.35,
      };
    case "plasma":
      return {
        roughness: 0.56,
        metallic: 0,
        transmission: 0.16,
        emissive: 1.4,
        fresnelPower: 2.2,
        alpha: 0.93,
        exposure: 1.9,
      };
    case "glass":
    default:
      return {
        roughness: 0.18,
        metallic: 0,
        transmission: 0.52,
        emissive: 0.28,
        fresnelPower: 3.1,
        alpha: 0.9,
        exposure: 1.5,
      };
  }
}

// Global attractor opacity ("opacity layer control"). A single multiplier on
// every material's alpha, set live from the UI — lets the user fade the
// attractor down off the blown-out HDR ceiling without touching exposure.
let materialOpacity = 1;

export function setMaterialOpacity(value: number) {
  materialOpacity = Math.max(0.05, Math.min(1, value));
}

export function createMaterialUniforms(style: MaterialStyle | undefined): MaterialUniforms {
  const settings = materialSettings(style);
  return {
    uRoughness: { value: settings.roughness },
    uMetallic: { value: settings.metallic },
    uTransmission: { value: settings.transmission },
    uEmissive: { value: settings.emissive },
    uFresnelPower: { value: settings.fresnelPower },
    uMaterialAlpha: { value: settings.alpha * materialOpacity },
    uExposure: { value: settings.exposure },
  };
}

export function applyMaterialUniforms(
  uniforms: Partial<MaterialUniforms>,
  style: MaterialStyle | undefined,
  emissiveBoost = 0
) {
  const settings = materialSettings(style);
  if (uniforms.uRoughness) uniforms.uRoughness.value = settings.roughness;
  if (uniforms.uMetallic) uniforms.uMetallic.value = settings.metallic;
  if (uniforms.uTransmission) uniforms.uTransmission.value = settings.transmission;
  if (uniforms.uEmissive) uniforms.uEmissive.value = settings.emissive + emissiveBoost * 0.35;
  if (uniforms.uFresnelPower) uniforms.uFresnelPower.value = settings.fresnelPower;
  if (uniforms.uMaterialAlpha) uniforms.uMaterialAlpha.value = settings.alpha * materialOpacity;
  if (uniforms.uExposure) uniforms.uExposure.value = settings.exposure;
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
