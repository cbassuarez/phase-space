import clsx from "clsx";
import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useViewerState } from "../../state/viewerState";
import type { Palette, SystemId } from "../../types";
import ResolutionSlider from "./ResolutionSlider";
import ToggleSwitch from "./ToggleSwitch";
import ModulationSection from "./ModulationSection";
import { builtinPalettes } from "../../palettes";
import CustomPaletteEditor from "./CustomPaletteEditor";

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
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    renderStyle,
    photonWeaveSettings,
    causticsSettings,
    setPhotonWeaveSettings,
    setCausticsSettings,
    palette,
    customPalette,
    background,
    setSystem,
    setResolution,
    toggleAutoSpin,
    toggleAnimateHeadTail,
    toggleShowFullTrajectory,
    setLineThickness,
    setRenderStyle,
    setPalette,
    setCustomPalette,
    setBackground,
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
      <button className="flex w-full flex-col items-center pt-2 pb-1" onClick={() => setOpen((v) => !v)}>
        <div className="h-1 w-10 rounded-full bg-[color:var(--ps-border-subtle)]" />
        <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">Controls</span>
      </button>
      <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
        <section className="flex flex-col gap-2 py-2">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">SYSTEM</div>
          <div className="grid grid-cols-2 gap-2">
            {systemLabels.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSystem(opt.id)}
                className={clsx(
                  "rounded-full px-3 py-2 text-xs",
                  system === opt.id
                    ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                    : "bg-white text-[color:var(--ps-text-soft)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <ResolutionSlider value={resolution} onChange={setResolution} />

        <section className="mt-2 flex flex-col gap-2">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">VIEW</div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-[color:var(--ps-text-soft)]">Auto-spin camera</span>
              <button
                  type="button"
                  onClick={toggleAutoSpin}
                  aria-pressed={autoSpin}
                  className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition",
                      "border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle",
                      autoSpin &&
                      "border-[color:var(--ps-accent)] bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] shadow-md"
                  )}
              >
                  
              {autoSpin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{autoSpin ? "Pause spin" : "Auto spin"}</span>
              <span className="sm:hidden">{autoSpin ? "Pause" : "Play"}</span>
            </button>
          </div>
          <ToggleSwitch label="Animate head/tail" checked={animateHeadTail} onToggle={toggleAnimateHeadTail} />
          <ToggleSwitch label="Show full trajectory" checked={showFullTrajectory} onToggle={toggleShowFullTrajectory} />
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[{ id: "line", label: "Line" }, { id: "volumetric-cloud", label: "Cloud" }, { id: "cells", label: "Cells" }].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                className={clsx(
                  "rounded-full px-2 py-1",
                  renderStyle === opt.id
                    ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                    : "bg-white text-[color:var(--ps-text-soft)]"
                )}
              >
                {opt.label}
              </button>
            ))}
            {[{ id: "ribbon", label: "Ribbon" }, { id: "photon-weave", label: "Weave" }, { id: "caustics", label: "Caustics" }].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                className={clsx(
                  "rounded-full px-2 py-1",
                  renderStyle === opt.id
                    ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                    : "bg-white text-[color:var(--ps-text-soft)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            {[{ id: "thin", label: "Thin" }, { id: "default", label: "Default" }, { id: "thick", label: "Thick" }].map(
              (opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLineThickness(opt.id as typeof lineThickness)}
                  className={clsx(
                    "rounded-full px-2 py-1",
                    lineThickness === opt.id
                      ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                      : "bg-white text-[color:var(--ps-text-soft)]"
                  )}
                >
                  {opt.label}
                </button>
              )
            )}
          </div>
          {renderStyle === "photon-weave" && (
            <div className="mt-3 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
              <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Photon Weave</div>
              <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="flex items-center justify-between">
                  <span>Brightness</span>
                  <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{photonWeaveSettings.brightness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={photonWeaveSettings.brightness}
                  onChange={(e) => setPhotonWeaveSettings({ brightness: parseFloat(e.target.value) })}
                  className="accent-[color:var(--ps-accent-subtle)]"
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
                  className="accent-[color:var(--ps-accent-subtle)]"
                />
              </label>
              <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Filament density</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setPhotonWeaveSettings({ filamentDensity: opt.id as typeof photonWeaveSettings.filamentDensity })}
                      className={clsx(
                        "rounded-full px-2 py-1",
                        photonWeaveSettings.filamentDensity === opt.id
                          ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                          : "bg-white text-[color:var(--ps-text-soft)]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <ToggleSwitch
                label="Shimmer"
                checked={photonWeaveSettings.shimmer}
                onToggle={() => setPhotonWeaveSettings({ shimmer: !photonWeaveSettings.shimmer })}
              />
            </div>
          )}

          {renderStyle === "caustics" && (
            <div className="mt-3 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
              <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Caustics</div>
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
                  className="accent-[color:var(--ps-accent-subtle)]"
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
                  className="accent-[color:var(--ps-accent-subtle)]"
                />
              </label>
              <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Projection axis</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[{ id: "auto", label: "Auto" }, { id: "xy", label: "XY" }, { id: "xz", label: "XZ" }, { id: "yz", label: "YZ" }].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCausticsSettings({ projectionAxis: opt.id as typeof causticsSettings.projectionAxis })}
                      className={clsx(
                        "rounded-full px-2 py-1",
                        causticsSettings.projectionAxis === opt.id
                          ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                          : "bg-white text-[color:var(--ps-text-soft)]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Color mode</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[{ id: "global", label: "Palette" }, { id: "warm", label: "Caustic Warm" }, { id: "cool", label: "Caustic Cool" }].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCausticsSettings({ colorMode: opt.id as typeof causticsSettings.colorMode })}
                      className={clsx(
                        "rounded-full px-2 py-1",
                        causticsSettings.colorMode === opt.id
                          ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-subtle"
                          : "bg-white text-[color:var(--ps-text-soft)]"
                      )}
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
            <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">CAMERA</div>
            <div className="grid grid-cols-4 gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
              {cameraModes.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setCameraProgram((c) => ({ ...c, mode: opt.id as typeof c.mode }))}
                  className={clsx(
                    "rounded-full px-2 py-1",
                    cameraProgram.mode === opt.id
                      ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] shadow-subtle"
                      : "bg-white text-[color:var(--ps-text-soft)]"
                  )}
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
                className="accent-[color:var(--ps-accent-subtle)]"
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
                className="accent-[color:var(--ps-accent-subtle)]"
              />
            </label>
          </section>
        )}

        <ModulationSection compact />

        <section className="mt-2 grid grid-cols-2 gap-3">
          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">Palette</p>
            {paletteOptions.map((opt) => (
              <label key={opt.id} className="flex items-center justify-between py-1 text-xs text-[color:var(--ps-text-soft)]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-full" style={{ background: opt.swatch }} />
                  <span>{opt.label}</span>
                </span>
                <input
                  type="radio"
                  name="palette-mobile"
                  value={opt.id}
                  checked={palette === opt.id}
                  onChange={() => setPalette(opt.id)}
                  className="h-3 w-3 accent-[color:var(--ps-accent-subtle)]"
                />
              </label>
            ))}
          </div>

          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">Background</p>
            {[
              { id: "light", label: "Light" },
              { id: "dim", label: "Dim" },
            ].map((opt) => (
              <label key={opt.id} className="flex items-center justify-between py-1 text-xs text-[color:var(--ps-text-soft)]">
                <span>{opt.label}</span>
                <input
                  type="radio"
                  name="background-mobile"
                  value={opt.id}
                  checked={background === opt.id}
                  onChange={() => setBackground(opt.id as "light" | "dim")}
                  className="h-3 w-3 accent-[color:var(--ps-accent-subtle)]"
                />
              </label>
            ))}
          </div>
        </section>

        <div className="mt-3">
          {palette === "custom" && <CustomPaletteEditor state={customPalette} onChange={setCustomPalette} />}
        </div>
      </div>
    </motion.div>
  );
}

export default ControlPanelBottomSheet;
