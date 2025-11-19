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

function ControlPanelDesktop() {
  const {
    system,
    resolution,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    palette,
    background,
    setSystem,
    setResolution,
    toggleAutoSpin,
    toggleAnimateHeadTail,
    toggleShowFullTrajectory,
    setPalette,
    setBackground,
    trajectoryMeta,
    sceneJson,
  } = useViewerState();

  const [inspectorOpen, setInspectorOpen] = useState(false);

  const copySceneJson = async () => {
    try {
      await navigator.clipboard.writeText(sceneJson);
    } catch (err) {
      console.error("Clipboard unsupported", err);
    }
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
