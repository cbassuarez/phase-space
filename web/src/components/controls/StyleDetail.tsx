import type { ChangeEvent } from "react";
import { useViewerState } from "../../state/viewerState";
import type { CellShape, LineThickness } from "../../types";
import ToggleSwitch from "./ToggleSwitch";
import {
  rangeClass,
  segmentedButtonClass,
  segmentedGroupClass,
} from "./controlStyles";

const widthOptions: { id: LineThickness; label: string }[] = [
  { id: "thin", label: "Thin" },
  { id: "default", label: "Medium" },
  { id: "thick", label: "Thick" },
];

const cellShapeOptions: { id: CellShape; label: string }[] = [
  { id: "circular", label: "Round" },
  { id: "cel", label: "Cel" },
  { id: "square", label: "Square" },
];

const filamentOptions = [
  { id: "low", label: "Sparse" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "Dense" },
] as const;

const projectionOptions = [
  { id: "auto", label: "Auto" },
  { id: "xy", label: "XY" },
  { id: "xz", label: "XZ" },
  { id: "yz", label: "YZ" },
] as const;

const colorModeOptions = [
  { id: "global", label: "Palette" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-[color:var(--ps-text-soft)]">{children}</span>;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value));
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[11px] text-[color:var(--ps-text-soft)]">
        <span>{label}</span>
        <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">
          {(format ?? ((v) => `${Math.round(v * 100)}%`))(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handle}
        className={rangeClass}
      />
    </label>
  );
}

/**
 * The per-style "form" control — the old single Thickness picker, now
 * contextual to the active render style. Each style surfaces the knobs that
 * actually shape it: line/cell width, cell shape, cloud density, ribbon width,
 * the photon-weave filament controls, and caustic interaction.
 */
export function StyleDetail() {
  const {
    renderStyle,
    lineThickness,
    setLineThickness,
    cellShape,
    setCellShape,
    cloudDensity,
    setCloudDensity,
    ribbonWidth,
    setRibbonWidth,
    photonWeaveSettings,
    setPhotonWeaveSettings,
    causticsSettings,
    setCausticsSettings,
  } = useViewerState();

  if (renderStyle === "line") {
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel>Line weight</FieldLabel>
        <div className={segmentedGroupClass}>
          {widthOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLineThickness(opt.id)}
              aria-pressed={lineThickness === opt.id}
              className={segmentedButtonClass(lineThickness === opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (renderStyle === "cells") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <FieldLabel>Cell size</FieldLabel>
          <div className={segmentedGroupClass}>
            {widthOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLineThickness(opt.id)}
                aria-pressed={lineThickness === opt.id}
                className={segmentedButtonClass(lineThickness === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>Cell shape</FieldLabel>
          <div className={segmentedGroupClass}>
            {cellShapeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCellShape(opt.id)}
                aria-pressed={cellShape === opt.id}
                className={segmentedButtonClass(cellShape === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (renderStyle === "volumetric-cloud") {
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel>Cloud density</FieldLabel>
        <Slider
          label="Density"
          value={cloudDensity}
          min={0.3}
          max={2.2}
          onChange={setCloudDensity}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </div>
    );
  }

  if (renderStyle === "ribbon") {
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel>Ribbon width</FieldLabel>
        <Slider
          label="Width"
          value={ribbonWidth}
          min={0.4}
          max={2.6}
          onChange={setRibbonWidth}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </div>
    );
  }

  if (renderStyle === "photon-weave") {
    return (
      <div className="flex flex-col gap-3">
        <FieldLabel>Filament density</FieldLabel>
        <div className={segmentedGroupClass}>
          {filamentOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPhotonWeaveSettings({ filamentDensity: opt.id })}
              aria-pressed={photonWeaveSettings.filamentDensity === opt.id}
              className={segmentedButtonClass(photonWeaveSettings.filamentDensity === opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Slider
          label="Brightness"
          value={photonWeaveSettings.brightness}
          min={0}
          max={2}
          onChange={(v) => setPhotonWeaveSettings({ brightness: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Trail length"
          value={photonWeaveSettings.trailLength}
          min={0.5}
          max={2}
          onChange={(v) => setPhotonWeaveSettings({ trailLength: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <ToggleSwitch
          label="Shimmer"
          checked={photonWeaveSettings.shimmer}
          onToggle={() => setPhotonWeaveSettings({ shimmer: !photonWeaveSettings.shimmer })}
        />
      </div>
    );
  }

  if (renderStyle === "caustics") {
    return (
      <div className="flex flex-col gap-3">
        <FieldLabel>Caustic interaction</FieldLabel>
        <Slider
          label="Intensity"
          value={causticsSettings.intensity}
          min={0}
          max={2.5}
          onChange={(v) => setCausticsSettings({ intensity: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Blur radius"
          value={causticsSettings.blurRadius}
          min={0.1}
          max={1.2}
          onChange={(v) => setCausticsSettings({ blurRadius: v })}
          format={(v) => v.toFixed(2)}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel>Projection</FieldLabel>
          <div className="grid grid-cols-4 gap-1">
            {projectionOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCausticsSettings({ projectionAxis: opt.id })}
                aria-pressed={causticsSettings.projectionAxis === opt.id}
                className={segmentedButtonClass(causticsSettings.projectionAxis === opt.id, {
                  size: "sm",
                  marker: false,
                })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>Color mode</FieldLabel>
          <div className="grid grid-cols-3 gap-1">
            {colorModeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCausticsSettings({ colorMode: opt.id })}
                aria-pressed={causticsSettings.colorMode === opt.id}
                className={segmentedButtonClass(causticsSettings.colorMode === opt.id, {
                  size: "sm",
                  marker: false,
                })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default StyleDetail;
