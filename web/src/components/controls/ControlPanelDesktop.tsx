import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
];

const cameraModes = [
  { id: "orbit", label: "Orbit" },
  { id: "path-rider", label: "Path" },
  { id: "grid-surface", label: "Grid" },
  { id: "drone-ghost", label: "Ghost" },
  { id: "lobe-focus", label: "Lobe" },
];

type SidebarSectionId =
  | "header"
  | "system"
  | "resolution"
  | "view"
  | "camera"
  | "modulation"
  | "color";

interface SidebarSectionMeasurement {
  id: SidebarSectionId;
  label: string;
  offsetTop: number;
  height: number;
}

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
        className="accent-[color:var(--ps-accent-subtle)]"
      />
    </label>
  );
}

function SidebarScrollRail({
  sections,
  activeId,
}: {
  sections: SidebarSectionMeasurement[];
  activeId: SidebarSectionId | null;
}) {
  if (!sections.length) return null;

  const totalHeight = sections.reduce((sum, s) => sum + s.height, 0) || 1;
  let runningOffset = 0;

  return (
    <div className="pointer-events-none absolute inset-y-3 right-1.5 flex w-[7px] items-stretch">
      <div className="relative flex w-full flex-col rounded-full bg-[color:var(--ps-panel-alt-bg)]/10">
        {sections.map((section) => {
          const start = runningOffset / totalHeight;
          const size = section.height / totalHeight;
          runningOffset += section.height;

          const topPct = start * 100;
          const heightPct = Math.max(size * 100, 6); // enforce a minimum visual size

          const isActive = section.id === activeId;

          return (
            <div
              key={section.id}
              className={clsx(
                "absolute left-0 right-0 rounded-full bg-white/40 shadow-[0_0_0_1px_rgba(15,23,42,0.16)] backdrop-blur-[2px] transition-all duration-200",
                isActive &&
                  "bg-gradient-to-b from-[color:var(--ps-primary-blue)] via-white/85 to-[color:var(--ps-primary-yellow)] shadow-[0_0_0_1px_rgba(15,23,42,0.28),0_0_8px_rgba(59,130,246,0.75)] opacity-100",
                !isActive && "opacity-60"
              )}
              style={{
                top: `${topPct}%`,
                height: `${heightPct}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ControlPanelDesktop() {
  const {
    system,
    resolution,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const systemRef = useRef<HTMLElement | null>(null);
  const resolutionRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<HTMLElement | null>(null);
  const modulationRef = useRef<HTMLElement | null>(null);
  const colorRef = useRef<HTMLElement | null>(null);

  const [sectionMeasurements, setSectionMeasurements] = useState<SidebarSectionMeasurement[]>([]);
  const [scrollMidpoint, setScrollMidpoint] = useState(0);

  useLayoutEffect(() => {
    const collect = (
      id: SidebarSectionId,
      label: string,
      el: HTMLElement | null
    ): SidebarSectionMeasurement | null => {
      if (!el) return null;
      const height = el.offsetHeight;
      if (!height || height <= 0) return null;

      const offsetTop = el.offsetTop;
      return { id, label, offsetTop, height };
    };

    const next: SidebarSectionMeasurement[] = [];
    const maybePush = (m: SidebarSectionMeasurement | null) => {
      if (m) next.push(m);
    };

    maybePush(collect("header", "Header", headerRef.current));
    maybePush(collect("system", "System", systemRef.current as HTMLElement | null));
    maybePush(collect("resolution", "Resolution", resolutionRef.current as HTMLElement | null));
    maybePush(collect("view", "View", viewRef.current as HTMLElement | null));
    maybePush(collect("camera", "Camera", cameraRef.current as HTMLElement | null));
    maybePush(collect("modulation", "Modulation", modulationRef.current as HTMLElement | null));
    maybePush(collect("color", "Color", colorRef.current as HTMLElement | null));

    if (next.length) {
      setSectionMeasurements(next);
    }
  }, [
    system,
    resolution,
    renderStyle,
    lineThickness,
    background,
    cameraProgram,
    palette,
    customPalette,
    inspectorOpen,
  ]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const mid = scrollEl.scrollTop + scrollEl.clientHeight / 2;
      setScrollMidpoint(mid);
    };

    // Initialize once
    handleScroll();

    scrollEl.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const activeSectionId: SidebarSectionId | null = useMemo(() => {
    if (!sectionMeasurements.length) return null;

    const mid = scrollMidpoint;
    let best: SidebarSectionMeasurement | null = null;
    let bestDist = Infinity;

    for (const section of sectionMeasurements) {
      const center = section.offsetTop + section.height / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = section;
      }
    }

    return best ? best.id : null;
  }, [sectionMeasurements, scrollMidpoint]);

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

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)]">
      {/* Scrollable content + overlay rail */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="phase-sidebar-scroll flex h-full min-h-0 flex-col space-y-4 overflow-y-auto pr-2"
        >
          {/* HEADER */}
          <div
            ref={headerRef}
            className="flex flex-col gap-1 border-b border-[color:var(--ps-border-subtle)] pb-3"
          >
            <div className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">phase-space</div>
            <p className="text-xs text-[color:var(--ps-text-soft)]">Interactive phase-space viewer</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--ps-panel-alt-bg)] px-3 py-1 text-[11px] font-medium text-[color:var(--ps-text-soft)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--ps-traj-1)]" />
              <span className="capitalize">{system}</span>
            </div>
          </div>

          {/* SYSTEM */}
          <section ref={systemRef} className="flex flex-col gap-2">
            <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">SYSTEM</div>
            <div className="inline-flex items-center rounded-full bg-[color:var(--ps-panel-alt-bg)] p-1">
              {systemLabels.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSystem(opt.id)}
                  className={clsx(
                    "flex-1 rounded-full px-3 py-1 text-xs transition-all",
                    system === opt.id
                      ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] border border-[color:var(--ps-accent)] shadow-[var(--ps-shadow-subtle)]"
                      : "text-[color:var(--ps-text-soft)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* RESOLUTION */}
          <section ref={resolutionRef} aria-label="Resolution section">
            <ResolutionSlider value={resolution} onChange={setResolution} />
          </section>

          {/* VIEW + RENDERING */}
          <section ref={viewRef} className="flex flex-col gap-2">
            <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">VIEW</div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-[color:var(--ps-text-soft)]">Auto-spin camera</span>
              <button
                type="button"
                onClick={toggleAutoSpin}
                aria-pressed={autoSpin}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition",
                  "border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]",
                  autoSpin &&
                    "border-[color:var(--ps-accent)] bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
                )}
              >
                {autoSpin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{autoSpin ? "Pause spin" : "Auto spin"}</span>
                <span className="sm:hidden">{autoSpin ? "Pause" : "Play"}</span>
              </button>
            </div>
            <ToggleSwitch label="Animate head/tail" checked={animateHeadTail} onToggle={toggleAnimateHeadTail} />
            <ToggleSwitch label="Show full trajectory" checked={showFullTrajectory} onToggle={toggleShowFullTrajectory} />
            <div className="space-y-2">
              <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Rendering</div>
              <div className="inline-flex w-full items-center rounded-full bg-[color:var(--ps-panel-alt-bg)] p-1 text-xs">
                {[
                  { id: "volumetric-cloud", label: "Cloud" },
                  { id: "ribbon", label: "Ribbon" },
                  { id: "cells", label: "Cells" },
                  { id: "photon-weave", label: "Photon Weave" },
                  { id: "caustics", label: "Caustics" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRenderStyle(opt.id as typeof renderStyle)}
                    className={clsx(
                      "flex-1 rounded-full px-3 py-1 transition-all",
                      renderStyle === opt.id
                        ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] border border-[color:var(--ps-accent)] shadow-[var(--ps-shadow-subtle)]"
                        : "text-[color:var(--ps-text-soft)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1 flex flex-col gap-2">
              <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">THICKNESS</div>
              <div className="inline-flex items-center rounded-full bg-[color:var(--ps-panel-alt-bg)] p-1 text-xs">
                {[
                  { id: "thin", label: "Thin" },
                  { id: "default", label: "Default" },
                  { id: "thick", label: "Thick" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLineThickness(opt.id as typeof lineThickness)}
                    className={clsx(
                      "flex-1 rounded-full px-3 py-1 transition-all",
                      lineThickness === opt.id
                        ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] border border-[color:var(--ps-accent)] shadow-[var(--ps-shadow-subtle)]"
                        : "text-[color:var(--ps-text-soft)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {renderStyle === "photon-weave" && (
              <div className="mt-2 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
                <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">PHOTON WEAVE</div>
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
                <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                  <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">FILAMENT DENSITY</div>
                  <div className="inline-flex items-center rounded-full bg-[color:var(--ps-panel-bg)] p-1 text-xs shadow-[var(--ps-shadow-inner)]">
                    {[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setPhotonWeaveSettings({ filamentDensity: opt.id as typeof photonWeaveSettings.filamentDensity })
                        }
                        className={clsx(
                          "flex-1 rounded-full px-3 py-1 transition-all",
                          photonWeaveSettings.filamentDensity === opt.id
                            ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
                            : "text-[color:var(--ps-text-soft)]"
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
              <div className="mt-2 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
                <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">CAUSTICS</div>
                <CameraSlider
                  label="Blur radius"
                  value={causticsSettings.blurRadius}
                  min={0.1}
                  max={1.2}
                  step={0.01}
                  onChange={(v) => setCausticsSettings({ blurRadius: v })}
                />
                <CameraSlider
                  label="Intensity"
                  value={causticsSettings.intensity}
                  min={0}
                  max={2.5}
                  step={0.01}
                  onChange={(v) => setCausticsSettings({ intensity: v })}
                />
                <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                  <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">PROJECTION</div>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {[{ id: "auto", label: "Auto" }, { id: "xy", label: "XY" }, { id: "xz", label: "XZ" }, { id: "yz", label: "YZ" }].map(
                      (opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCausticsSettings({ projectionAxis: opt.id as typeof causticsSettings.projectionAxis })}
                          className={clsx(
                            "rounded-full px-2 py-1 transition-all",
                            causticsSettings.projectionAxis === opt.id
                              ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
                              : "text-[color:var(--ps-text-soft)]"
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
                  <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">COLOR MODE</div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {[{ id: "global", label: "Palette" }, { id: "warm", label: "Caustic Warm" }, { id: "cool", label: "Caustic Cool" }].map(
                      (opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCausticsSettings({ colorMode: opt.id as typeof causticsSettings.colorMode })}
                          className={clsx(
                            "rounded-full px-2 py-1 transition-all",
                            causticsSettings.colorMode === opt.id
                              ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
                              : "text-[color:var(--ps-text-soft)]"
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* CAMERA */}
          <section ref={cameraRef} className="mt-2 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">CAMERA</div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] text-[color:var(--ps-text-soft)]">experimental</span>
            </div>

            <div className="inline-flex w-full items-center rounded-full bg-white p-1 text-xs shadow-subtle">
              {cameraModes.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!cameraProgram}
                  onClick={() =>
                    updateCamera((c) => ({
                      ...c,
                      mode: opt.id as typeof c.mode,
                    }))
                  }
                  className={clsx(
                    "flex-1 rounded-full px-3 py-1 transition-all",
                    cameraProgram?.mode === opt.id
                      ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
                      : "text-[color:var(--ps-text-soft)]"
                  )}
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

                <details className="rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-white px-3 py-2 text-xs text-[color:var(--ps-text-soft)]">
                  <summary className="cursor-pointer text-[11px] font-semibold text-[color:var(--ps-text)]">Mode tuning</summary>
                  {cameraProgram.mode === "orbit" && (
                    <div className="mt-2 space-y-2">
                      <CameraSlider
                        label="Orbit rate"
                        min={0.05}
                        max={0.8}
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

                  {cameraProgram.mode === "path-rider" && (
                    <div className="mt-2 space-y-2">
                      <CameraSlider
                        label="Trajectory"
                        min={0}
                        max={5}
                        step={1}
                        value={cameraProgram.path_rider.trajectory_index}
                        onChange={(v) => updateCamera((c) => ({ ...c, path_rider: { ...c.path_rider, trajectory_index: Math.floor(v) } }))}
                      />
                      <CameraSlider
                        label="Ahead distance"
                        min={10}
                        max={400}
                        value={cameraProgram.path_rider.ahead_offset}
                        onChange={(v) => updateCamera((c) => ({ ...c, path_rider: { ...c.path_rider, ahead_offset: Math.floor(v) } }))}
                      />
                      <CameraSlider
                        label="Side offset"
                        min={0}
                        max={1.0}
                        value={cameraProgram.path_rider.lateral_offset}
                        onChange={(v) => updateCamera((c) => ({ ...c, path_rider: { ...c.path_rider, lateral_offset: v } }))}
                      />
                    </div>
                  )}

                  {cameraProgram.mode === "grid-surface" && (
                    <div className="mt-2 space-y-2">
                      <CameraSlider
                        label="Plane height"
                        min={-2}
                        max={2}
                        value={cameraProgram.grid_surface.plane_height}
                        onChange={(v) => updateCamera((c) => ({ ...c, grid_surface: { ...c.grid_surface, plane_height: v } }))}
                      />
                      <CameraSlider
                        label="Tilt"
                        min={0}
                        max={1}
                        value={cameraProgram.grid_surface.tilt_angle}
                        onChange={(v) => updateCamera((c) => ({ ...c, grid_surface: { ...c.grid_surface, tilt_angle: v } }))}
                      />
                    </div>
                  )}

                  {cameraProgram.mode === "drone-ghost" && (
                    <div className="mt-2 space-y-2">
                      <CameraSlider
                        label="Radius scale"
                        min={0.5}
                        max={2.0}
                        value={cameraProgram.drone_ghost.radius_scale}
                        onChange={(v) => updateCamera((c) => ({ ...c, drone_ghost: { ...c.drone_ghost, radius_scale: v } }))}
                      />
                      <CameraSlider
                        label="Center bias"
                        min={0}
                        max={1}
                        value={cameraProgram.drone_ghost.center_bias}
                        onChange={(v) => updateCamera((c) => ({ ...c, drone_ghost: { ...c.drone_ghost, center_bias: v } }))}
                      />
                    </div>
                  )}

                  {cameraProgram.mode === "lobe-focus" && (
                    <div className="mt-2 space-y-2">
                      <CameraSlider
                        label="Dwell time"
                        min={1}
                        max={10}
                        value={cameraProgram.lobe_focus.dwell_time}
                        onChange={(v) => updateCamera((c) => ({ ...c, lobe_focus: { ...c.lobe_focus, dwell_time: v } }))}
                      />
                      <CameraSlider
                        label="Zoom depth"
                        min={0.6}
                        max={2.0}
                        value={cameraProgram.lobe_focus.zoom_outer}
                        onChange={(v) => updateCamera((c) => ({ ...c, lobe_focus: { ...c.lobe_focus, zoom_outer: v } }))}
                      />
                    </div>
                  )}
                </details>
              </div>
            )}
          </section>

          {/* MODULATION */}
          <section ref={modulationRef} aria-label="Modulation section">
            <ModulationSection />
          </section>

          {/* COLOR */}
          <section ref={colorRef} className="mt-2 flex flex-col gap-3">
            <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">COLOR</div>
            <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">Palette</p>
              {paletteOptions.map((opt) => (
                <label key={opt.id} className="flex items-center justify-between py-1 text-xs text-[color:var(--ps-text-soft)]">
                  <span>{opt.label}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-8 rounded-full" style={{ background: opt.swatch }} />
                    <input
                      type="radio"
                      name="palette"
                      value={opt.id}
                      checked={palette === opt.id}
                      onChange={() => setPalette(opt.id)}
                      className="h-3 w-3 accent-[color:var(--ps-accent-subtle)]"
                    />
                  </span>
                </label>
              ))}
              {palette === "custom" && <CustomPaletteEditor state={customPalette} onChange={setCustomPalette} />}
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
                    name="background"
                    value={opt.id}
                    checked={background === opt.id}
                    onChange={() => setBackground(opt.id as "light" | "dim")}
                    className="h-3 w-3 accent-[color:var(--ps-accent-subtle)]"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Overlay segmented rail */}
        <SidebarScrollRail sections={sectionMeasurements} activeId={activeSectionId} />
      </div>

      {/* INSPECTOR (unchanged) */}
      <section className="mt-auto">
        <button
          type="button"
          onClick={() => setInspectorOpen((v) => !v)}
          className="flex w-full items-center justify-between border-t border-[color:var(--ps-border-subtle)] pt-3 text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]"
        >
          <span>INSPECTOR</span>
          <motion.span animate={{ rotate: inspectorOpen ? 0 : -90 }} className="text-[10px]">
            ▸
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
                className="inline-flex items-center rounded-full border border-[color:var(--ps-border-subtle)] px-3 py-1 text-[11px] transition hover:bg-[color:var(--ps-panel-alt-bg)]"
              >
                Copy scene JSON
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

export default ControlPanelDesktop;
