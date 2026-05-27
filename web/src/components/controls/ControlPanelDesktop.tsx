import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Clipboard, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  disclosureSummaryClass,
  radioIndicatorClass,
  radioRowClass,
  rangeClass,
  sectionHeadingClass,
  segmentedButtonClass,
  segmentedGroupClass,
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
  { id: "survey", label: "Survey" },
  { id: "orbit", label: "Orbit" },
  { id: "chase", label: "Chase" },
  { id: "lobe", label: "Lobe" },
] as const;

const surveyDirPresets = [
  { id: "iso", label: "Iso" },
  { id: "front", label: "Front" },
  { id: "top", label: "Top" },
] as const;

const lobeCountOptions = [
  { id: "auto", label: "Auto" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4" },
] as const;

const renderStyles = [
  { id: "line", label: "Line" },
  { id: "volumetric-cloud", label: "Cloud" },
  { id: "cells", label: "Cells" },
  { id: "ribbon", label: "Ribbon" },
  { id: "photon-weave", label: "Weave" },
  { id: "caustics", label: "Caustics" },
] as const;

const lineThicknessOptions = [
  { id: "thin", label: "Thin" },
  { id: "default", label: "Default" },
  { id: "thick", label: "Thick" },
] as const;

const materialStyleOptions = [
  { id: "glass", label: "Glass" },
  { id: "metal", label: "Metal" },
  { id: "plasma", label: "Plasma" },
] as const;

const backgroundOptions = [
  { id: "light", label: "Light" },
  { id: "dim", label: "Dim" },
] as const;

function CameraSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={rangeClass}
      />
    </label>
  );
}

const sectionHeading = sectionHeadingClass;
const pillRow = segmentedGroupClass;

function ControlPanelDesktop() {
  const {
    system,
    resolution,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    materialStyle,
    renderStyle,
    photonWeaveSettings,
    setPhotonWeaveSettings,
    causticsSettings,
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
    setMaterialStyle,
    setRenderStyle,
    setPalette,
    setCustomPalette,
    setBackground,
    cameraProgram,
    setCameraProgram,
    trajectoryMeta,
    sceneJson,
  } = useViewerState();

  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Custom scroll indicator: track scroll progress of the main content column.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let idleTimer: number | undefined;

    const updateProgress = () => {
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max > 0 ? el.scrollTop / max : 0;
      setScrollProgress(ratio);
    };

    const handleScroll = () => {
      updateProgress();
      setIsScrolling(true);
      if (idleTimer !== undefined) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        setIsScrolling(false);
      }, 450);
    };

    updateProgress();

    el.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateProgress);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateProgress);
      if (idleTimer !== undefined) {
        window.clearTimeout(idleTimer);
      }
    };
  }, []);

  const clampedProgress = Math.min(1, Math.max(0, scrollProgress));
  const ladderStepCount = 8;
  const snappedProgress = Math.round(clampedProgress * ladderStepCount) / ladderStepCount;
  const orbOffsetPercent = 6 + (clampedProgress * 0.7 + snappedProgress * 0.3) * 88;

  const paletteOptions: { id: Palette; label: string; swatch: string }[] = useMemo(() => {
    const base = builtinPalettes.map((p) => {
      const stops = p.stops;
      const a = stops[0]?.color ?? "#ffffff";
      const b = stops[Math.floor(stops.length / 2)]?.color ?? a;
      const c = stops[stops.length - 1]?.color ?? b;
      return {
        id: p.id,
        label: p.label,
        swatch: `linear-gradient(90deg, ${a}, ${b}, ${c})`,
      };
    });
    const customOption = {
      id: "custom" as Palette,
      label: "Custom",
      swatch: `linear-gradient(90deg, ${customPalette.low}, ${customPalette.mid}, ${customPalette.high})`,
    };
    return [...base, customOption];
  }, [customPalette]);

  const copySceneJson = async () => {
    try {
      await navigator.clipboard.writeText(sceneJson);
    } catch (err) {
      console.error("Clipboard unsupported", err);
    }
  };

  const updateCamera = (mutate: (c: NonNullable<typeof cameraProgram>) => NonNullable<typeof cameraProgram>) => {
    if (!cameraProgram) return;
    setCameraProgram((prev) => mutate(prev ?? cameraProgram));
  };

  const hasStyleOptions = renderStyle === "photon-weave" || renderStyle === "caustics";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)]">
      <div
        ref={scrollRef}
        className="phase-control-scroll flex-1 min-h-0 space-y-5 overflow-y-auto pr-3"
      >
        <div className="flex flex-col gap-1 border-b border-[color:var(--ps-border-subtle)] pb-3">
          <div className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">phase-space</div>
          <p className="text-xs text-[color:var(--ps-text-soft)]">Interactive phase-space viewer</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--ps-panel-alt-bg)] px-3 py-1 text-[11px] font-medium text-[color:var(--ps-text-soft)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--ps-traj-1)]" />
            <span className="capitalize">{system}</span>
          </div>
        </div>

        {/* SYSTEM — what to view; resolution belongs here because both re-integrate. */}
        <section className="flex flex-col gap-3">
          <div className={sectionHeading}>SYSTEM</div>
          <div className={pillRow}>
            {systemLabels.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSystem(opt.id)}
                aria-pressed={system === opt.id}
                className={segmentedButtonClass(system === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <ResolutionSlider value={resolution} onChange={setResolution} />
        </section>

        {/* CAMERA — how you see it. */}
        <section className="flex flex-col gap-3 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
          <div className={sectionHeading}>CAMERA</div>

          <div className={pillRow}>
            {cameraModes.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!cameraProgram}
                onClick={() => updateCamera((c) => ({ ...c, mode: opt.id as typeof c.mode }))}
                aria-pressed={cameraProgram?.mode === opt.id}
                className={segmentedButtonClass(cameraProgram?.mode === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {cameraProgram && (
            <div className="space-y-2">
              <CameraSlider
                label="Speed"
                min={0.25}
                max={2.0}
                value={cameraProgram.speed_scalar}
                onChange={(v) => updateCamera((c) => ({ ...c, speed_scalar: v }))}
              />
              <CameraSlider
                label="Zoom bias"
                min={0.5}
                max={2.0}
                value={cameraProgram.zoom_scalar}
                onChange={(v) => updateCamera((c) => ({ ...c, zoom_scalar: v }))}
              />
              <CameraSlider
                label="Stability"
                min={0}
                max={1}
                value={cameraProgram.stability}
                onChange={(v) => updateCamera((c) => ({ ...c, stability: v }))}
              />

              <details className="group rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-1 py-1 text-xs text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)]">
                <summary className={disclosureSummaryClass}>
                  <span>Mode tuning</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                </summary>
                {cameraProgram.mode === "survey" && (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    <ToggleSwitch
                      label="Rotate"
                      checked={cameraProgram.survey.rotate}
                      onToggle={() =>
                        updateCamera((c) => ({ ...c, survey: { ...c.survey, rotate: !c.survey.rotate } }))
                      }
                    />
                    <CameraSlider
                      label="Rotate speed"
                      min={0.0}
                      max={0.2}
                      step={0.005}
                      value={cameraProgram.survey.rotate_speed}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, survey: { ...c.survey, rotate_speed: v } }))
                      }
                    />
                    <CameraSlider
                      label="Margin"
                      min={1.0}
                      max={1.5}
                      value={cameraProgram.survey.margin}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, survey: { ...c.survey, margin: v } }))
                      }
                    />
                    <CameraSlider
                      label="Pitch"
                      min={0.1}
                      max={1.4}
                      value={cameraProgram.survey.pitch}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, survey: { ...c.survey, pitch: v } }))
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <span>Direction</span>
                      <div className={pillRow}>
                        {surveyDirPresets.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              updateCamera((c) => ({ ...c, survey: { ...c.survey, dir_preset: opt.id } }))
                            }
                            aria-pressed={cameraProgram.survey.dir_preset === opt.id}
                            className={segmentedButtonClass(cameraProgram.survey.dir_preset === opt.id, { size: "sm" })}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {cameraProgram.mode === "orbit" && (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    <CameraSlider
                      label="Base radius"
                      min={0.5}
                      max={3.0}
                      value={cameraProgram.orbit.base_radius}
                      onChange={(v) => updateCamera((c) => ({ ...c, orbit: { ...c.orbit, base_radius: v } }))}
                    />
                    <CameraSlider
                      label="Orbit rate"
                      min={0.0}
                      max={0.4}
                      value={cameraProgram.orbit.azimuth_speed}
                      onChange={(v) => updateCamera((c) => ({ ...c, orbit: { ...c.orbit, azimuth_speed: v } }))}
                    />
                    <CameraSlider
                      label="Elevation swing"
                      min={0}
                      max={0.8}
                      value={cameraProgram.orbit.polar_amplitude}
                      onChange={(v) => updateCamera((c) => ({ ...c, orbit: { ...c.orbit, polar_amplitude: v } }))}
                    />
                  </div>
                )}

                {cameraProgram.mode === "chase" && (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    <CameraSlider
                      label="Trajectory"
                      min={0}
                      max={5}
                      step={1}
                      value={cameraProgram.chase.trajectory_index}
                      onChange={(v) =>
                        updateCamera((c) => ({
                          ...c,
                          chase: { ...c.chase, trajectory_index: Math.floor(v) },
                        }))
                      }
                    />
                    <CameraSlider
                      label="Chase distance"
                      min={0.05}
                      max={0.5}
                      value={cameraProgram.chase.chase_distance}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, chase: { ...c.chase, chase_distance: v } }))
                      }
                    />
                    <CameraSlider
                      label="Ride height"
                      min={0}
                      max={0.2}
                      value={cameraProgram.chase.ride_height}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, chase: { ...c.chase, ride_height: v } }))
                      }
                    />
                    <CameraSlider
                      label="Look ahead"
                      min={0.1}
                      max={1.0}
                      value={cameraProgram.chase.look_ahead}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, chase: { ...c.chase, look_ahead: v } }))
                      }
                    />
                    <CameraSlider
                      label="Bank strength"
                      min={0}
                      max={1}
                      value={cameraProgram.chase.bank_strength}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, chase: { ...c.chase, bank_strength: v } }))
                      }
                    />
                    <CameraSlider
                      label="Cruise speed"
                      min={0.2}
                      max={2.0}
                      value={cameraProgram.chase.time_scale}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, chase: { ...c.chase, time_scale: v } }))
                      }
                    />
                  </div>
                )}

                {cameraProgram.mode === "lobe" && (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    <div className="flex flex-col gap-1">
                      <span>Lobe count</span>
                      <div className={pillRow}>
                        {lobeCountOptions.map((opt) => (
                          <button
                            key={String(opt.id)}
                            type="button"
                            onClick={() =>
                              updateCamera((c) => ({ ...c, lobe: { ...c.lobe, lobe_count: opt.id } }))
                            }
                            aria-pressed={cameraProgram.lobe.lobe_count === opt.id}
                            className={segmentedButtonClass(cameraProgram.lobe.lobe_count === opt.id, { size: "sm" })}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <CameraSlider
                      label="Dwell time"
                      min={1}
                      max={12}
                      value={cameraProgram.lobe.dwell_time}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, lobe: { ...c.lobe, dwell_time: v } }))
                      }
                    />
                    <CameraSlider
                      label="Transition"
                      min={0.5}
                      max={5}
                      value={cameraProgram.lobe.transition_time}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, lobe: { ...c.lobe, transition_time: v } }))
                      }
                    />
                    <CameraSlider
                      label="Zoom"
                      min={0.4}
                      max={2.5}
                      value={cameraProgram.lobe.zoom}
                      onChange={(v) =>
                        updateCamera((c) => ({ ...c, lobe: { ...c.lobe, zoom: v } }))
                      }
                    />
                  </div>
                )}
              </details>
            </div>
          )}
        </section>

        {/* LOOK — how it renders. Style-specific knobs are tucked behind a disclosure. */}
        <section className="flex flex-col gap-3">
          <div className={sectionHeading}>LOOK</div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-[color:var(--ps-text-soft)]">Style</span>
            <div className={pillRow}>
              {renderStyles.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                  aria-pressed={renderStyle === opt.id}
                  className={segmentedButtonClass(renderStyle === opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-[color:var(--ps-text-soft)]">Thickness</span>
            <div className={pillRow}>
              {lineThicknessOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLineThickness(opt.id as typeof lineThickness)}
                  aria-pressed={lineThickness === opt.id}
                  className={segmentedButtonClass(lineThickness === opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-[color:var(--ps-text-soft)]">Material</span>
            <div className={pillRow}>
              {materialStyleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMaterialStyle(opt.id)}
                  aria-pressed={materialStyle === opt.id}
                  className={segmentedButtonClass(materialStyle === opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <p className={sectionHeading}>Palette</p>
            {paletteOptions.map((opt) => {
              const active = palette === opt.id;
              return (
                <label key={opt.id} className={radioRowClass(active)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-10 shrink-0 rounded-full border border-white/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ background: opt.swatch }} />
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <input
                    type="radio"
                    name="palette"
                    value={opt.id}
                    checked={active}
                    onChange={() => setPalette(opt.id)}
                    className={srInputClass}
                  />
                  <span className={radioIndicatorClass(active)} aria-hidden="true" />
                </label>
              );
            })}
            {palette === "custom" && <CustomPaletteEditor state={customPalette} onChange={setCustomPalette} />}
          </div>

          <div className="space-y-1 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <p className={sectionHeading}>Background</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {backgroundOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBackground(opt.id)}
                  aria-pressed={background === opt.id}
                  className={commandButtonClass(background === opt.id, { size: "touch", full: true })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <LightingControlGroup />
          </div>

          {hasStyleOptions && (
            <details className="group rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-1 py-1 text-xs text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)]">
              <summary className={disclosureSummaryClass}>
                <span>Style options</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              </summary>
              {renderStyle === "photon-weave" && (
                <div className="mt-2 space-y-2 px-2 pb-2">
                  <CameraSlider
                    label="Brightness"
                    value={photonWeaveSettings.brightness}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(v) => setPhotonWeaveSettings({ brightness: v })}
                  />
                  <CameraSlider
                    label="Trail length"
                    value={photonWeaveSettings.trailLength}
                    min={0.5}
                    max={2}
                    step={0.01}
                    onChange={(v) => setPhotonWeaveSettings({ trailLength: v })}
                  />
                  <div className="flex flex-col gap-1">
                    <span>Filament density</span>
                    <div className={pillRow}>
                      {[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPhotonWeaveSettings({ filamentDensity: opt.id as typeof photonWeaveSettings.filamentDensity })}
                          aria-pressed={photonWeaveSettings.filamentDensity === opt.id}
                          className={segmentedButtonClass(photonWeaveSettings.filamentDensity === opt.id, { size: "sm" })}
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
                <div className="mt-2 space-y-2 px-2 pb-2">
                  <CameraSlider
                    label="Intensity"
                    value={causticsSettings.intensity}
                    min={0}
                    max={2.5}
                    step={0.01}
                    onChange={(v) => setCausticsSettings({ intensity: v })}
                  />
                  <CameraSlider
                    label="Blur radius"
                    value={causticsSettings.blurRadius}
                    min={0.1}
                    max={1.2}
                    step={0.01}
                    onChange={(v) => setCausticsSettings({ blurRadius: v })}
                  />
                  <div className="flex flex-col gap-1">
                    <span>Projection</span>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {[{ id: "auto", label: "Auto" }, { id: "xy", label: "XY" }, { id: "xz", label: "XZ" }, { id: "yz", label: "YZ" }].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCausticsSettings({ projectionAxis: opt.id as typeof causticsSettings.projectionAxis })}
                          aria-pressed={causticsSettings.projectionAxis === opt.id}
                          className={segmentedButtonClass(causticsSettings.projectionAxis === opt.id, { size: "sm", marker: false })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span>Color mode</span>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      {[{ id: "global", label: "Palette" }, { id: "warm", label: "Warm" }, { id: "cool", label: "Cool" }].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCausticsSettings({ colorMode: opt.id as typeof causticsSettings.colorMode })}
                          aria-pressed={causticsSettings.colorMode === opt.id}
                          className={segmentedButtonClass(causticsSettings.colorMode === opt.id, { size: "sm", marker: false })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </details>
          )}
        </section>

        {/* MOTION — playback & trail behaviour. */}
        <section className="flex flex-col gap-2">
          <div className={sectionHeading}>MOTION</div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-[color:var(--ps-text-soft)]">Auto-spin camera</span>
            <button
              type="button"
              onClick={toggleAutoSpin}
              aria-pressed={autoSpin}
              className={commandButtonClass(autoSpin, { size: "sm" })}
            >
              {autoSpin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{autoSpin ? "Pause" : "Play"}</span>
              <span className="sm:hidden">{autoSpin ? "Pause" : "Play"}</span>
            </button>
          </div>
          <ToggleSwitch label="Animate head/tail" checked={animateHeadTail} onToggle={toggleAnimateHeadTail} />
          <ToggleSwitch label="Show full trajectory" checked={showFullTrajectory} onToggle={toggleShowFullTrajectory} />
        </section>

        {/* AUDIO — collapsed by default; advanced. */}
        <details className="group rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-1 py-1">
          <summary className={disclosureSummaryClass}>
            <span>AUDIO REACTIVITY</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          </summary>
          <div className="pt-2">
            <ModulationSection />
          </div>
        </details>
      </div>

      {/* INSPECTOR — debug info, pinned at the bottom and collapsed by default. */}
      <section className="mt-auto">
        <button
          type="button"
          onClick={() => setInspectorOpen((v) => !v)}
          className={clsx(
            disclosureSummaryClass,
            "w-full rounded-none border-x-0 border-b-0 border-t border-[color:var(--ps-border-subtle)] px-0 pt-3"
          )}
          aria-expanded={inspectorOpen}
        >
          <span>INSPECTOR</span>
          <motion.span animate={{ rotate: inspectorOpen ? 90 : 0 }} className="text-[10px]">
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {inspectorOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-2 text-[11px] text-[color:var(--ps-text-soft)]"
            >
              <div>
                Trajectories: {trajectoryMeta.count} · Points: ~{trajectoryMeta.points}
              </div>
              <button
                type="button"
                onClick={copySceneJson}
                className={commandButtonClass(false, { size: "sm" })}
              >
                <Clipboard className="h-3.5 w-3.5" />
                Copy scene JSON
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Overlay dot ladder + orb scroll indicator */}
      <div className="pointer-events-none absolute inset-y-3 right-2 flex items-stretch">
        <div
          className={clsx(
            "phase-scroll-rail h-full",
            (scrollProgress > 0 || isScrolling) && "phase-scroll-rail--visible"
          )}
        >
          <div
            className={clsx(
              "phase-scroll-orb",
              isScrolling ? "phase-scroll-orb--active" : "phase-scroll-orb--idle"
            )}
            style={{ transform: `translate(-50%, ${orbOffsetPercent}%)` }}
          />
        </div>
      </div>
    </div>
  );
}

export default ControlPanelDesktop;
