import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useViewerState } from "../../state/viewerState";
import type { Palette, SystemId } from "../../types";
import ResolutionSlider from "./ResolutionSlider";
import ToggleSwitch from "./ToggleSwitch";

const systemLabels: { id: SystemId; label: string }[] = [
  { id: "lorenz", label: "Lorenz" },
  { id: "rossler", label: "Rössler" },
  { id: "aizawa", label: "Aizawa" },
  { id: "thomas", label: "Thomas" },
];

const paletteOptions: { id: Palette; label: string; swatch: string }[] = [
  { id: "system", label: "System default", swatch: "bg-gradient-to-r from-[#4f6fff] via-[#ff7a73] to-[#ffd66b]" },
  { id: "plasma", label: "Plasma", swatch: "bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-300" },
  { id: "viridis", label: "Viridis", swatch: "bg-gradient-to-r from-[#440154] via-[#21908C] to-[#fde725]" },
  { id: "rainbow", label: "Rainbow", swatch: "bg-gradient-to-r from-[#ff7a73] via-[#4f6fff] to-[#7cffc4]" },
];

const cameraModes = [
  { id: "orbit", label: "Orbit" },
  { id: "path-rider", label: "Path" },
  { id: "grid-surface", label: "Grid" },
  { id: "drone-ghost", label: "Ghost" },
  { id: "lobe-focus", label: "Lobe" },
  { id: "macro-micro", label: "Macro" },
];

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
        className="accent-[color:var(--ps-accent)]"
      />
    </label>
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
    palette,
    background,
    setSystem,
    setResolution,
    toggleAutoSpin,
    toggleAnimateHeadTail,
    toggleShowFullTrajectory,
    setLineThickness,
    setRenderStyle,
    setPalette,
    setBackground,
    cameraProgram,
    setCameraProgram,
    trajectoryMeta,
    sceneJson,
    requestRenderStill,
  } = useViewerState();

  const [inspectorOpen, setInspectorOpen] = useState(false);

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
    <aside className="flex w-full max-w-xs flex-col gap-4 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)]">
      <section className="flex flex-col gap-1 border-b border-[color:var(--ps-border-subtle)] pb-3">
        <div className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">phase-space</div>
        <p className="text-xs text-[color:var(--ps-text-soft)]">Interactive phase-space viewer</p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--ps-panel-alt-bg)] px-3 py-1 text-[11px] font-medium text-[color:var(--ps-text-soft)]">
          <span className="h-2 w-2 rounded-full bg-[color:var(--ps-traj-1)]" />
          <span className="capitalize">{system}</span>
        </div>
      </section>

      <section className="mt-3 flex flex-col gap-2">
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

      <ResolutionSlider value={resolution} onChange={setResolution} />

      <section className="mt-2 flex flex-col gap-2">
        <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">VIEW</div>
        <ToggleSwitch label="Auto-spin camera" checked={autoSpin} onToggle={toggleAutoSpin} />
        <ToggleSwitch label="Animate head/tail" checked={animateHeadTail} onToggle={toggleAnimateHeadTail} />
        <ToggleSwitch label="Show full trajectory" checked={showFullTrajectory} onToggle={toggleShowFullTrajectory} />
        <div className="space-y-2">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">Rendering</div>
          <div className="inline-flex w-full items-center rounded-full bg-[color:var(--ps-panel-alt-bg)] p-1 text-xs">
            {[
              { id: "neon-filaments", label: "Neon" },
              { id: "volumetric-cloud", label: "Cloud" },
              { id: "crt-scope", label: "CRT" },
              { id: "ribbon", label: "Ribbon" },
              { id: "path-trace", label: "Path" },
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
          {renderStyle === "path-trace" && (
            <button
              type="button"
              onClick={requestRenderStill}
              className="w-full rounded-full bg-[color:var(--ps-panel-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--ps-text)] shadow-[var(--ps-shadow-subtle)]"
            >
              Render still
            </button>
          )}
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
      </section>

      <section className="mt-2 space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
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

              {cameraProgram.mode === "macro-micro" && (
                <div className="mt-2 space-y-2">
                  <CameraSlider
                    label="Cycle length"
                    min={6}
                    max={36}
                    value={cameraProgram.macro_micro.cycle_duration}
                    onChange={(v) => updateCamera((c) => ({ ...c, macro_micro: { ...c.macro_micro, cycle_duration: v } }))}
                  />
                  <CameraSlider
                    label="Micro depth"
                    min={0.3}
                    max={1.2}
                    value={cameraProgram.macro_micro.micro_radius}
                    onChange={(v) => updateCamera((c) => ({ ...c, macro_micro: { ...c.macro_micro, micro_radius: v } }))}
                  />
                </div>
              )}
            </details>
          </div>
        )}
      </section>

      <section className="mt-2 flex flex-col gap-3">
        <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">COLOR</div>
        <div className="space-y-2 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">Palette</p>
          {paletteOptions.map((opt) => (
            <label key={opt.id} className="flex items-center justify-between py-1 text-xs text-[color:var(--ps-text-soft)]">
              <span>{opt.label}</span>
              <span className="inline-flex items-center gap-2">
                <span className={clsx("h-2 w-8 rounded-full", opt.swatch)} />
                <input
                  type="radio"
                  name="palette"
                  value={opt.id}
                  checked={palette === opt.id}
                  onChange={() => setPalette(opt.id)}
                  className="h-3 w-3 accent-[color:var(--ps-accent)]"
                />
              </span>
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
                name="background"
                value={opt.id}
                checked={background === opt.id}
                onChange={() => setBackground(opt.id as "light" | "dim")}
                className="h-3 w-3 accent-[color:var(--ps-accent)]"
              />
            </label>
          ))}
        </div>
      </section>

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
    </aside>
  );
}

export default ControlPanelDesktop;
