import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, Pause, Pencil, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useViewerState } from "../../state/viewerState";
import type { Palette, SystemId } from "../../types";
import ResolutionSlider from "./ResolutionSlider";
import ToggleSwitch from "./ToggleSwitch";
import ModulationSection from "./ModulationSection";
import { SidebarTabs, SIDEBAR_TAB_ORDER, type SidebarTabId } from "./SidebarTabs";
import StatusBadge from "./StatusBadge";
import InspectorPanel from "./InspectorPanel";
import StyleDetail from "./StyleDetail";
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
  { id: "free", label: "Free" },
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

function CameraSlider({
  label,
  value,
  min,
  max,
  step,
  decimals = 2,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{value.toFixed(decimals)}</span>
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

// Tab panels slide in the direction of travel and cross-fade. `custom` is the
// signed travel direction (+1 moving right through the tab order, -1 left).
const tabPanelVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 18 : -18 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -18 : 18 }),
};
const tabPanelTransition = { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] as const };

function ControlPanelDesktop({ onCollapse }: { onCollapse?: () => void }) {
  const {
    system,
    activeCustom,
    customAttractors,
    communityAttractors,
    setCustomAttractor,
    openAttractorEditor,
    resolution,
    autoSpin,
    returnToHome,
    drawTrace,
    traceSpeed,
    traceDecay,
    materialTransmission,
    renderStyle,
    palette,
    customPalette,
    attractorOpacity,
    setAttractorOpacity,
    setSystem,
    setResolution,
    toggleAutoSpin,
    toggleReturnToHome,
    toggleDrawTrace,
    setTraceSpeed,
    setTraceDecay,
    setMaterialTransmission,
    setRenderStyle,
    setPalette,
    setCustomPalette,
    cameraProgram,
    setCameraProgram,
  } = useViewerState();

  const [activeTab, setActiveTab] = useState<SidebarTabId>("scene");
  const [tabDirection, setTabDirection] = useState(0);

  const selectTab = (next: SidebarTabId) => {
    setTabDirection(
      SIDEBAR_TAB_ORDER.indexOf(next) >= SIDEBAR_TAB_ORDER.indexOf(activeTab) ? 1 : -1
    );
    setActiveTab(next);
  };

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

  const updateCamera = (mutate: (c: NonNullable<typeof cameraProgram>) => NonNullable<typeof cameraProgram>) => {
    if (!cameraProgram) return;
    setCameraProgram((prev) => mutate(prev ?? cameraProgram));
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)]">
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide controls"
          title="Hide controls"
          className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text-soft)] transition hover:text-[color:var(--ps-text)]"
        >
          <PanelLeftClose size={15} />
        </button>
      )}
      {/* Header — constant across tabs, with a live indicator of the current system */}
      <div className="flex items-center justify-between gap-2 pr-9">
        <div className="flex flex-col gap-0.5">
          <div className="text-lg font-semibold leading-tight tracking-tight text-[color:var(--ps-text)]">phase-space</div>
          <p className="text-[11px] text-[color:var(--ps-text-soft)]">Interactive phase-space viewer</p>
        </div>
        <StatusBadge system={system} />
      </div>

      {/* Folder: tab strip + body. The active tab merges into the body below. */}
      <div className="flex flex-1 min-h-0 flex-col">
        <SidebarTabs active={activeTab} onSelect={selectTab} />

        {/* Folder body — animated tab panels, each scrolls independently */}
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-b-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)]">
          <AnimatePresence initial={false} custom={tabDirection}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              variants={tabPanelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={tabPanelTransition}
              className="phase-control-scroll absolute inset-0 space-y-5 overflow-y-auto p-3 pr-2"
            >
            {activeTab === "scene" && (
              <>
        {/* SYSTEM — what to view; resolution belongs here because both re-integrate. */}
        <section className="flex flex-col gap-3">
          <div className={sectionHeading}>SYSTEM</div>
          <div className={pillRow}>
            {systemLabels.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSystem(opt.id)}
                aria-pressed={system === opt.id && !activeCustom}
                className={segmentedButtonClass(system === opt.id && !activeCustom)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* User-defined attractors. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]">
                my attractors
              </span>
              <button
                type="button"
                onClick={() => openAttractorEditor()}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[color:var(--ps-text-soft)] hover:text-[color:var(--ps-text)]"
              >
                <Plus className="h-3 w-3" /> new
              </button>
            </div>
            {customAttractors.length === 0 ? (
              <p className="text-[10px] leading-relaxed text-[color:var(--ps-text-muted)]">
                Define your own attractor from equations.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {customAttractors.map((d) => (
                  <div key={d.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCustomAttractor(d)}
                      aria-pressed={activeCustom?.id === d.id}
                      className={clsx(
                        segmentedButtonClass(activeCustom?.id === d.id, { fill: false }),
                        "flex-1 justify-start truncate"
                      )}
                    >
                      {d.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAttractorEditor(d)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ps-text-muted)] hover:text-[color:var(--ps-text)]"
                      aria-label={`Edit ${d.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {communityAttractors.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]">
                community
              </span>
              <div className="flex flex-col gap-1">
                {communityAttractors.map((d) => (
                  <div key={d.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCustomAttractor(d)}
                      aria-pressed={activeCustom?.id === d.id}
                      className={clsx(
                        segmentedButtonClass(activeCustom?.id === d.id, { fill: false }),
                        "flex-1 justify-start truncate"
                      )}
                      title={d.description}
                    >
                      {d.name}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openAttractorEditor({
                          ...d,
                          id: `local/${d.id.split("/").pop() ?? "fork"}-${Date.now().toString(36)}`,
                          source: "local",
                        })
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ps-text-muted)] hover:text-[color:var(--ps-text)]"
                      aria-label={`Fork ${d.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ResolutionSlider value={resolution} onChange={setResolution} />
        </section>
              </>
            )}

            {activeTab === "camera" && (
              <>
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

              <div className="rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] p-2 text-xs text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)]">
                <div className={clsx(sectionHeading, "px-1 pb-1")}>Mode tuning</div>
                {cameraProgram.mode === "free" && (
                  <p className="mt-1 px-2 pb-2 text-[11px] leading-relaxed text-[color:var(--ps-text-soft)]">
                    Drag to orbit, scroll to zoom — release to coast. Stability sets the
                    inertia (lower glides longer), Speed the drag gain. Drag in any other mode
                    to nudge the camera; it eases back on its own.
                  </p>
                )}
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
              </div>
            </div>
          )}
        </section>

        {/* MOTION — playback & trail behaviour; lives with the camera. */}
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
          <ToggleSwitch label="Return to home" checked={returnToHome} onToggle={toggleReturnToHome} />
          <ToggleSwitch label="Draw (racing light)" checked={drawTrace} onToggle={toggleDrawTrace} />
          {drawTrace && (
            <div className="flex flex-col gap-2 pl-1">
              <CameraSlider
                label="Trace speed"
                min={0.002}
                max={0.2}
                step={0.002}
                decimals={3}
                value={traceSpeed}
                onChange={setTraceSpeed}
              />
              <CameraSlider
                label="Decay"
                min={0}
                max={1}
                step={0.01}
                value={traceDecay}
                onChange={setTraceDecay}
              />
            </div>
          )}
        </section>
              </>
            )}

            {activeTab === "scene" && (
              <>
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

          <StyleDetail />

          <div className="flex flex-col gap-1.5">
            <CameraSlider
              label="Transmission"
              value={materialTransmission}
              min={0}
              max={1}
              step={0.01}
              onChange={setMaterialTransmission}
            />
            <div className="grid grid-cols-3 text-[10px] text-[color:var(--ps-text-muted)]">
              <span>Metal</span>
              <span className="text-center">Glass</span>
              <span className="text-right">Plasma</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <CameraSlider
              label="Opacity"
              value={attractorOpacity}
              min={0.1}
              max={1}
              step={0.01}
              onChange={setAttractorOpacity}
            />
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

          <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
            <LightingControlGroup />
          </div>
        </section>
              </>
            )}

            {activeTab === "audio" && (
              <section className="flex flex-col gap-3">
                <div className={sectionHeading}>AUDIO REACTIVITY</div>
                <p className="text-[11px] leading-relaxed text-[color:var(--ps-text-soft)]">
                  Route live audio and visual features onto scene parameters. Enable a bus, choose a
                  source and target, then set how deep it drives the motion.
                </p>
                <ModulationSection />
              </section>
            )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Inspector — live telemetry & diagnostics, pinned at the bottom. */}
      <InspectorPanel />
    </div>
  );
}

export default ControlPanelDesktop;
