import { useEffect, useState } from "react";
import {
  LIGHTING_PRESETS,
  getKeyAzimuth,
  getLightingTarget,
  getLightingPresetId,
  setKeyAzimuth,
  setLighting,
  setLightingPreset,
  subscribeLighting,
} from "../visual/lighting";
import {
  rangeClass,
  segmentedButtonClass,
  sectionHeadingClass,
} from "./controls/controlStyles";

/**
 * LightingTweaks — small floating panel that lets the user reshape
 * the global lighting that every renderer reads from. Self-
 * contained: drop `<LightingTweaks />` anywhere inside the viewer
 * layout and it subscribes to / writes the lighting singleton in
 * `src/visual/lighting.ts`.
 *
 * Controls:
 *   - Preset selector: studio / noir / twilight / aurora / flat.
 *     Each rewrites the whole config in one click.
 *   - Key azimuth: orbits the dominant light around the world Y
 *     axis. Visual effect is "swing the sun."
 *   - Key intensity: dims/boosts the dominant light.
 *   - Ambient: a single scalar that scales the ambient triple (so
 *     the user gets one slider instead of three).
 *   - Shadow density: only visible-meaningful in ray-march mode,
 *     but kept here because it's part of the same lighting config.
 *
 * Visual conventions: lowercase labels, square corners (the project
 * has a global border-radius-0 override), Tailwind utility classes
 * matching the existing control panels. No internal state for
 * values — everything reads from the singleton on each render after
 * subscribing.
 */

export function LightingControlGroup() {
  const [, setVersion] = useState(0);
  const [presetId, setPresetId] = useState<string>(getLightingPresetId());

  // Subscribe to lighting changes from anywhere — when another
  // component (or this one) mutates the singleton, force a re-render.
  useEffect(() => {
    return subscribeLighting((_state, id) => {
      setPresetId(id);
      setVersion((v) => v + 1);
    });
  }, []);

  const light = getLightingTarget();
  const azimuth = getKeyAzimuth();
  // Treat the ambient triple as a brightness scalar by reading the
  // luminance and offering a single slider; setting writes uniformly.
  const ambientLum =
    (light.ambient[0] * 0.299 + light.ambient[1] * 0.587 + light.ambient[2] * 0.114);

  return (
    <div className="text-[color:var(--ps-text,#141722)]">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={sectionHeadingClass}>Lighting</span>
        <span className="text-[10px] text-[color:var(--ps-text-muted,#8b90a5)]">
          {presetId}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-5 gap-1">
        {LIGHTING_PRESETS.map((p) => {
          const active = p.id === presetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightingPreset(p.id)}
              aria-pressed={active}
              className={`${segmentedButtonClass(active, { size: "touch", fill: false, marker: false })} w-full md:min-h-7 md:px-2 md:py-1 md:text-[10px]`}
              title={p.label}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <LightingSlider
        label="key azimuth"
        value={azimuth}
        min={-Math.PI}
        max={Math.PI}
        step={0.01}
        format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
        onChange={(v) => setKeyAzimuth(v)}
      />

      <LightingSlider
        label="key intensity"
        value={light.keyIntensity}
        min={0}
        max={2.5}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setLighting({ keyIntensity: v })}
      />

      <LightingSlider
        label="ambient"
        value={ambientLum}
        min={0}
        max={0.8}
        step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={(v) => {
          // Preserve the hue ratio of the existing ambient triple
          // while scaling its luminance to the new value.
          const cur =
            light.ambient[0] * 0.299 + light.ambient[1] * 0.587 + light.ambient[2] * 0.114;
          const scale = cur > 1e-5 ? v / cur : 1;
          setLighting({
            ambient:
              cur > 1e-5
                ? [light.ambient[0] * scale, light.ambient[1] * scale, light.ambient[2] * scale]
                : [v, v, v],
          });
        }}
      />

      <LightingSlider
        label="shadow density"
        value={light.shadowDensity}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setLighting({ shadowDensity: v })}
        hint="ray-march"
      />
    </div>
  );
}

export function LightingTweaks() {
  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-30 w-[260px] rounded-[10px] border border-[color:var(--ps-border-subtle,#e0e4f2)] bg-[color:var(--ps-panel-bg,#ffffff)] p-3 shadow-[var(--ps-shadow-soft,0_4px_24px_rgba(0,0,0,0.08))]"
    >
      <LightingControlGroup />
    </div>
  );
}

interface LightingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

function LightingSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: LightingSliderProps) {
  return (
    <label className="mb-2 block">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-[11px] text-[color:var(--ps-text-soft,#5b6074)]">
          {label}
          {hint && (
            <span className="ml-1 text-[9px] text-[color:var(--ps-text-muted,#8b90a5)]">
              ({hint})
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[color:var(--ps-text,#141722)]">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={rangeClass}
      />
    </label>
  );
}
