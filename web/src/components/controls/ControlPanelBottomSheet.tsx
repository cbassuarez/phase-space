import clsx from "clsx";
import { motion } from "framer-motion";
import { ChevronUp, Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useViewerState } from "../../state/viewerState";
import type { Palette, SystemId } from "../../types";
import ResolutionSlider from "./ResolutionSlider";
import ToggleSwitch from "./ToggleSwitch";
import ModulationSection from "./ModulationSection";
import { builtinPalettes } from "../../palettes";
import CustomPaletteEditor from "./CustomPaletteEditor";
import { LightingControlGroup } from "../LightingTweaks";
import {
  commandButtonClass,
  radioIndicatorClass,
  radioRowClass,
  rangeClass,
  sectionHeadingClass,
  segmentedButtonClass,
  sheetHandleButtonClass,
  srInputClass,
} from "./controlStyles";

const systemLabels: { id: SystemId; label: string }[] = [
  { id: "lorenz", label: "Lorenz" },
  { id: "rossler", label: "Rössler" },
  { id: "aizawa", label: "Aizawa" },
  { id: "thomas", label: "Thomas" },
  { id: "chua", label: "Chua" },
];

const cameraModes = [
  { id: "survey", label: "View" },
  { id: "orbit", label: "Orbit" },
  { id: "chase", label: "Chase" },
  { id: "lobe", label: "Lobes" },
] as const;

function ControlPanelBottomSheet() {
  const {
    system,
    resolution,
    autoSpin,
    returnToHome,
	    drawTrace,
	    traceSpeed,
	    traceDecay,
	    lineWeight,
	    cellSize,
	    materialTransmission,
    renderStyle,
    photonWeaveSettings,
    causticsSettings,
    setPhotonWeaveSettings,
    setCausticsSettings,
    palette,
    customPalette,
    setSystem,
    setResolution,
    toggleAutoSpin,
    toggleReturnToHome,
    toggleDrawTrace,
	    setTraceSpeed,
	    setTraceDecay,
	    setLineWeight,
	    setCellSize,
	    setMaterialTransmission,
    setRenderStyle,
    setPalette,
    setCustomPalette,
    cameraProgram,
    setCameraProgram,
  } = useViewerState();

  const paletteOptions: { id: Palette; label: string; swatch: string }[] = useMemo(() => {
    const base = builtinPalettes.map((p) => {
      const stops = p.stops;
      const a = stops[0]?.color ?? "#ffffff";
      const b = stops[Math.floor(stops.length / 2)]?.color ?? a;
      const c = stops[stops.length - 1]?.color ?? b;
      return { id: p.id, label: p.label, swatch: `linear-gradient(90deg, ${a}, ${b}, ${c})` };
    });
    const customOption = {
      id: "custom" as Palette,
      label: "Custom",
      swatch: `linear-gradient(90deg, ${customPalette.low}, ${customPalette.mid}, ${customPalette.high})`,
    };
    return [...base, customOption];
  }, [customPalette]);

  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ y: open ? 0 : "calc(100% - 48px)" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      className="fixed bottom-0 left-0 right-0 z-20 rounded-t-[18px] border-t border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] shadow-[var(--ps-shadow-soft)]"
    >
      <button
        type="button"
        className={sheetHandleButtonClass}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div
          className={clsx(
            "h-1.5 w-12 rounded-full transition-[background-color,box-shadow] duration-150",
            open
              ? "bg-[color:var(--ps-accent-subtle)] shadow-[0_0_0_3px_rgba(0,87,255,0.12)]"
              : "bg-[color:var(--ps-border-strong)]"
          )}
        />
        <span className="inline-flex items-center gap-1">
          Controls
          <ChevronUp className={clsx("h-3.5 w-3.5 transition-transform", !open && "rotate-180")} />
        </span>
      </button>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
        <section className="flex flex-col gap-2 py-2">
          <div className={sectionHeadingClass}>SYSTEM</div>
          <div className="grid grid-cols-2 gap-2">
            {systemLabels.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSystem(opt.id)}
                aria-pressed={system === opt.id}
                className={clsx(segmentedButtonClass(system === opt.id, { size: "touch", fill: false }), "w-full")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <ResolutionSlider value={resolution} onChange={setResolution} />

        <section className="mt-2 flex flex-col gap-2">
          <div className={sectionHeadingClass}>VIEW</div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-[color:var(--ps-text-soft)]">Auto-spin camera</span>
            <button
              type="button"
              onClick={toggleAutoSpin}
              aria-pressed={autoSpin}
              className={commandButtonClass(autoSpin, { size: "touch" })}
            >
              {autoSpin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{autoSpin ? "Pause spin" : "Auto spin"}</span>
              <span className="sm:hidden">{autoSpin ? "Pause" : "Play"}</span>
            </button>
          </div>
          <ToggleSwitch label="Return to home" checked={returnToHome} onToggle={toggleReturnToHome} />
          <ToggleSwitch label="Draw (racing light)" checked={drawTrace} onToggle={toggleDrawTrace} />
          {drawTrace && (
            <div className="space-y-2 pl-1">
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Trace speed</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{traceSpeed.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0.002}
                  max={0.2}
                  step={0.002}
                  value={traceSpeed}
                  onChange={(e) => setTraceSpeed(parseFloat(e.target.value))}
                  className={rangeClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Decay</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{traceDecay.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={traceDecay}
                  onChange={(e) => setTraceDecay(parseFloat(e.target.value))}
                  className={rangeClass}
                />
              </label>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[{ id: "line", label: "Line" }, { id: "volumetric-cloud", label: "Cloud" }, { id: "cells", label: "Cells" }].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                aria-pressed={renderStyle === opt.id}
                className={clsx(segmentedButtonClass(renderStyle === opt.id, { size: "touch", fill: false }), "w-full")}
              >
                {opt.label}
              </button>
            ))}
            {[{ id: "ribbon", label: "Ribbon" }, { id: "photon-weave", label: "Weave" }, { id: "caustics", label: "Caustics" }].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                aria-pressed={renderStyle === opt.id}
                className={clsx(segmentedButtonClass(renderStyle === opt.id, { size: "touch", fill: false }), "w-full")}
              >
                {opt.label}
              </button>
            ))}
          </div>
	          {renderStyle === "line" && (
	            <label className="mt-1 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
	              <div className="flex items-center justify-between">
	                <span>Line weight</span>
	                <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{lineWeight.toFixed(2)}</span>
	              </div>
	              <input
	                type="range"
	                min={0}
	                max={2}
	                step={0.01}
	                value={lineWeight}
	                onChange={(e) => setLineWeight(parseFloat(e.target.value))}
	                className={rangeClass}
	              />
	              <div className="grid grid-cols-3 text-[10px] text-[color:var(--ps-text-muted)]">
	                <span>Thin</span>
	                <span className="text-center">Medium</span>
	                <span className="text-right">Thick</span>
	              </div>
	            </label>
	          )}
	          {renderStyle === "cells" && (
	            <label className="mt-1 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
	              <div className="flex items-center justify-between">
	                <span>Cell size</span>
	                <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{cellSize.toFixed(2)}×</span>
	              </div>
	              <input
	                type="range"
	                min={0.35}
	                max={3.4}
	                step={0.01}
	                value={cellSize}
	                onChange={(e) => setCellSize(parseFloat(e.target.value))}
	                className={rangeClass}
	              />
	              <div className="grid grid-cols-3 text-[10px] text-[color:var(--ps-text-muted)]">
	                <span>Small</span>
	                <span className="text-center">Medium</span>
	                <span className="text-right">Large</span>
	              </div>
	            </label>
	          )}
          <label className="mt-1 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <div className="flex items-center justify-between">
              <span>Transmission</span>
              <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">
                {materialTransmission.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={materialTransmission}
              onChange={(e) => setMaterialTransmission(parseFloat(e.target.value))}
              className={rangeClass}
            />
            <div className="grid grid-cols-3 text-[10px] text-[color:var(--ps-text-muted)]">
              <span>Metal</span>
              <span className="text-center">Glass</span>
              <span className="text-right">Plasma</span>
            </div>
          </label>
          {renderStyle === "photon-weave" && (
            <div className="mt-3 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
              <div className={sectionHeadingClass}>Photon Weave</div>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Brightness</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{photonWeaveSettings.brightness.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.14}
                  step={0.005}
                  value={photonWeaveSettings.brightness}
                  onChange={(e) => setPhotonWeaveSettings({ brightness: parseFloat(e.target.value) })}
                  className={rangeClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Trail length</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{photonWeaveSettings.trailLength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.01}
                  value={photonWeaveSettings.trailLength}
                  onChange={(e) => setPhotonWeaveSettings({ trailLength: parseFloat(e.target.value) })}
                  className={rangeClass}
                />
              </label>
	              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
	                <div className="flex items-center justify-between">
	                  <span>Filament density</span>
	                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">
	                    {photonWeaveSettings.filamentDensityValue.toFixed(2)}
	                  </span>
	                </div>
	                <input
	                  type="range"
	                  min={0}
	                  max={1}
	                  step={0.01}
	                  value={photonWeaveSettings.filamentDensityValue}
	                  onChange={(e) => setPhotonWeaveSettings({ filamentDensityValue: parseFloat(e.target.value) })}
	                  className={rangeClass}
	                />
	                <div className="grid grid-cols-3 text-[10px] text-[color:var(--ps-text-muted)]">
	                  <span>Sparse</span>
	                  <span className="text-center">Medium</span>
	                  <span className="text-right">Dense</span>
	                </div>
	              </label>
              <ToggleSwitch
                label="Shimmer"
                checked={photonWeaveSettings.shimmer}
                onToggle={() => setPhotonWeaveSettings({ shimmer: !photonWeaveSettings.shimmer })}
              />
            </div>
          )}

          {renderStyle === "caustics" && (
            <div className="mt-3 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
              <div className={sectionHeadingClass}>Caustics</div>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Blur radius</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{causticsSettings.blurRadius.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.2}
                  step={0.01}
                  value={causticsSettings.blurRadius}
                  onChange={(e) => setCausticsSettings({ blurRadius: parseFloat(e.target.value) })}
                  className={rangeClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Intensity</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{causticsSettings.intensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.01}
                  value={causticsSettings.intensity}
                  onChange={(e) => setCausticsSettings({ intensity: parseFloat(e.target.value) })}
                  className={rangeClass}
                />
              </label>
              <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className={sectionHeadingClass}>Color mode</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[{ id: "global", label: "Palette" }, { id: "warm", label: "Caustic Warm" }, { id: "cool", label: "Caustic Cool" }].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCausticsSettings({ colorMode: opt.id as typeof causticsSettings.colorMode })}
                      aria-pressed={causticsSettings.colorMode === opt.id}
                      className={clsx(segmentedButtonClass(causticsSettings.colorMode === opt.id, { size: "touch", fill: false, marker: false }), "w-full")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {cameraProgram && (
          <section className="mt-2 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <div className={sectionHeadingClass}>CAMERA</div>
            <div className="grid grid-cols-4 gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
              {cameraModes.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCameraProgram((c) => ({ ...c, mode: opt.id as typeof c.mode }))}
                  aria-pressed={cameraProgram.mode === opt.id}
                  className={clsx(segmentedButtonClass(cameraProgram.mode === opt.id, { size: "touch", fill: false }), "w-full")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
              <div className="flex items-center justify-between">
                <span>Speed</span>
                <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{cameraProgram.speed_scalar.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={cameraProgram.speed_scalar}
                onChange={(e) => setCameraProgram((c) => ({ ...c, speed_scalar: parseFloat(e.target.value) }))}
                className={rangeClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
              <div className="flex items-center justify-between">
                <span>Zoom bias</span>
                <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{cameraProgram.zoom_scalar.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={cameraProgram.zoom_scalar}
                onChange={(e) => setCameraProgram((c) => ({ ...c, zoom_scalar: parseFloat(e.target.value) }))}
                className={rangeClass}
              />
            </label>
          </section>
        )}

        <ModulationSection compact />

        <section className="mt-2">
          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <p className={sectionHeadingClass}>Palette</p>
            {paletteOptions.map((opt) => {
              const active = palette === opt.id;
              return (
                <label key={opt.id} className={radioRowClass(active)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-8 shrink-0 rounded-full border border-white/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ background: opt.swatch }} />
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <input
                    type="radio"
                    name="palette-mobile"
                    value={opt.id}
                    checked={active}
                    onChange={() => setPalette(opt.id)}
                    className={srInputClass}
                  />
                  <span className={radioIndicatorClass(active)} aria-hidden="true" />
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
          <LightingControlGroup />
        </section>

        <div className="mt-3">
          {palette === "custom" && <CustomPaletteEditor state={customPalette} onChange={setCustomPalette} />}
        </div>
      </div>
    </motion.div>
  );
}

export default ControlPanelBottomSheet;
