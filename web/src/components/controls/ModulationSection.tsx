import clsx from "clsx";
import { useMemo } from "react";
import type { Curve } from "../../modulation/types";
import type { ModBus, ModBusRuntimeState, ModTarget } from "../../modulation/types";
import type { TargetPath } from "../../modulation/modEngine";
import { useModulation } from "../../state/modulationState";

interface TargetOption {
  value: TargetPath;
  label: string;
  group: string;
  curve?: Curve;
  makeTarget: (depth: number) => ModTarget;
  depthFromRange?: (target: ModTarget) => number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const centeredRange = (depth: number): [number, number] => {
  const spread = 0.2 + depth * 0.3;
  const min = clamp01(0.5 - spread);
  const max = clamp01(0.5 + spread);
  return [min, max];
};

const targetOptions: TargetOption[] = [
  {
    value: "view.camera.r",
    label: "Radius",
    group: "Camera",
    curve: "log",
    makeTarget: (depth) => {
      const span = 10 + depth * 30;
      const center = 26;
      return {
        path: "view.camera.r",
        range: [Math.max(6, center - span / 2), Math.min(80, center + span / 2)],
        curve: "log",
      };
    },
    depthFromRange: (target) => {
      const span = target.range[1] - target.range[0];
      return clamp01((span - 10) / 30);
    },
  },
  {
    value: "view.camera.theta",
    label: "Theta",
    group: "Camera",
    makeTarget: (depth) => {
      const span = Math.PI * (0.4 + depth * 1.6);
      return { path: "view.camera.theta", range: [0, Math.min(Math.PI * 2, span)] };
    },
    depthFromRange: (target) => clamp01(target.range[1] / (Math.PI * 2)),
  },
  {
    value: "view.camera.phi",
    label: "Phi",
    group: "Camera",
    makeTarget: (depth) => {
      const min = 0.25;
      const max = Math.min(Math.PI - 0.1, min + depth * 2.2);
      return { path: "view.camera.phi", range: [min, max] };
    },
    depthFromRange: (target) => clamp01((target.range[1] - 0.25) / 2.2),
  },
  {
    value: "view.palette_shift",
    label: "Palette phase",
    group: "Color",
    makeTarget: (depth) => ({ path: "view.palette_shift", range: [0, clamp01(depth)] }),
    depthFromRange: (target) => clamp01(target.range[1]),
  },
  {
    value: "view.background_brightness",
    label: "Background brightness",
    group: "Color",
    makeTarget: (depth) => ({ path: "view.background_brightness", range: [0, clamp01(depth)] }),
    depthFromRange: (target) => clamp01(target.range[1]),
  },
  {
    value: "render.neon.emissiveIntensity",
    label: "Neon brightness",
    group: "Rendering",
    curve: "exp",
    makeTarget: (depth) => {
      const min = Math.max(0.2, 0.8 - depth * 0.5);
      const max = Math.min(3.5, 1.2 + depth * 1.8);
      return { path: "render.neon.emissiveIntensity", range: [min, max], curve: "exp", lag: 0.5 };
    },
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.4) / 2.4),
  },
  {
    value: "render.ribbon.width",
    label: "Ribbon width",
    group: "Rendering",
    makeTarget: (depth) => {
      const span = 0.3 + depth * 0.9;
      return { path: "render.ribbon.width", range: [Math.max(0.4, 1 - span / 2), 1 + span / 2] };
    },
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.3) / 0.9),
  },
  {
    value: "render.cloud.density",
    label: "Cloud density",
    group: "Rendering",
    makeTarget: (depth) => ({
      path: "render.cloud.density",
      range: [Math.max(0, 0.2 - depth * 0.15), Math.min(1, 0.7 + depth * 0.3)],
    }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.7) / 0.3),
  },
  {
    value: "render.crt.scanlineDepth",
    label: "CRT scan depth",
    group: "Rendering",
    makeTarget: (depth) => ({
      path: "render.crt.scanlineDepth",
      range: [0.2, Math.min(1, 0.6 + depth * 0.4)],
      curve: "linear",
    }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.6) / 0.4),
  },
  {
    value: "audio.voice_0.pitch",
    label: "Voice pitch",
    group: "Sound output",
    makeTarget: (depth) => ({ path: "audio.voice_0.pitch", range: centeredRange(depth), curve: "linear" }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.voice_0.pan",
    label: "Voice pan",
    group: "Sound output",
    makeTarget: (depth) => ({ path: "audio.voice_0.pan", range: centeredRange(depth) }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.voice_0.brightness",
    label: "Voice brightness",
    group: "Sound output",
    makeTarget: (depth) => ({ path: "audio.voice_0.brightness", range: centeredRange(depth) }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.master.gain",
    label: "Master gain",
    group: "Sound output",
    makeTarget: (depth) => {
      const spread = 0.15 + depth * 0.35;
      return { path: "audio.master.gain", range: [clamp01(0.35 - spread), clamp01(0.35 + spread)] };
    },
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.3) / 0.35),
  },
];

const sourceOptions = [
  {
    label: "Audio",
    options: [
      { value: "audio:level", label: "Level" },
      { value: "audio:brightness", label: "Brightness" },
      { value: "audio:low_band", label: "Low band" },
      { value: "audio:mid_band", label: "Mid band" },
      { value: "audio:high_band", label: "High band" },
      { value: "audio:onset", label: "Onset" },
    ],
  },
  {
    label: "Visual",
    options: [
      { value: "visual:camera_orbit_phase", label: "Camera orbit" },
      { value: "visual:camera_radius_norm", label: "Camera radius" },
      { value: "visual:avg_speed", label: "Average speed" },
      { value: "visual:curvature", label: "Curvature" },
      { value: "visual:traj_density", label: "Trajectory density" },
    ],
  },
];

const groupedTargets = [
  { label: "Camera", values: ["view.camera.r", "view.camera.theta", "view.camera.phi"] },
  { label: "Rendering", values: ["render.neon.emissiveIntensity", "render.ribbon.width", "render.cloud.density", "render.crt.scanlineDepth"] },
  { label: "Color", values: ["view.palette_shift", "view.background_brightness"] },
  { label: "Sound output", values: ["audio.voice_0.pitch", "audio.voice_0.pan", "audio.voice_0.brightness", "audio.master.gain"] },
];

const targetOptionMap = targetOptions.reduce<Record<string, TargetOption>>((acc, opt) => {
  acc[opt.value] = opt;
  return acc;
}, {});

function busDepth(bus: ModBus): number {
  const target = bus.targets[0];
  if (!target) return 0.5;
  const opt = targetOptionMap[target.path];
  if (opt?.depthFromRange) return opt.depthFromRange(target);
  return 0.5;
}

function ModulationRow({ bus }: { bus: ModBusRuntimeState }) {
  const { updateBuses, modEngine } = useModulation();
  const disabled = !modEngine;
  const selectedTarget = bus.bus.targets[0]?.path as TargetPath | undefined;
  const depth = busDepth(bus.bus);

  const handleToggle = () => {
    updateBuses((buses) =>
      buses.map((b) => (b.id === bus.bus.id ? { ...b, enabled: !b.enabled } : b))
    );
  };

  const handleSourceChange = (value: string) => {
    const [domain, feature] = value.split(":");
    updateBuses((buses) =>
      buses.map((b) =>
        b.id === bus.bus.id
          ? { ...b, source: { ...b.source, domain: domain as any, feature: feature as any } }
          : b
      )
    );
  };

  const handleTargetChange = (value: string) => {
    const opt = targetOptionMap[value];
    if (!opt) return;
    updateBuses((buses) =>
      buses.map((b) => (b.id === bus.bus.id ? { ...b, targets: [opt.makeTarget(depth)] } : b))
    );
  };

  const handleDepthChange = (nextDepth: number) => {
    const opt = selectedTarget ? targetOptionMap[selectedTarget] : undefined;
    if (!opt) return;
    updateBuses((buses) =>
      buses.map((b) => (b.id === bus.bus.id ? { ...b, targets: [opt.makeTarget(nextDepth)] } : b))
    );
  };

  const sourceValue = `${bus.bus.source.domain}:${bus.bus.source.feature}`;

  return (
    <div className="rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-white/60 p-3 shadow-[var(--ps-shadow-subtle)]">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[color:var(--ps-text)]">
        <span>{bus.bus.id}</span>
        <label className="inline-flex items-center gap-2 text-[color:var(--ps-text-soft)]">
          <span className="text-[11px]">{bus.bus.enabled ? "On" : "Off"}</span>
          <input
            type="checkbox"
            checked={bus.bus.enabled}
            disabled={disabled}
            onChange={handleToggle}
            className="h-4 w-4 accent-[color:var(--ps-accent)]"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-[color:var(--ps-text-soft)] md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Source</span>
          <select
            value={sourceValue}
            onChange={(e) => handleSourceChange(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-2 py-1 text-[11px]"
          >
            {sourceOptions.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Target</span>
          <select
            value={selectedTarget ?? ""}
            onChange={(e) => handleTargetChange(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-2 py-1 text-[11px]"
          >
            <option value="" disabled>
              Select a target
            </option>
            {groupedTargets.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.values.map((value) => (
                  <option key={value} value={value}>
                    {targetOptionMap[value]?.label ?? value}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Depth</span>
          <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{depth.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={depth}
          disabled={disabled || !selectedTarget}
          onChange={(e) => handleDepthChange(parseFloat(e.target.value))}
          className="accent-[color:var(--ps-accent)]"
        />
      </div>
    </div>
  );
}

function ModulationSection({ compact = false }: { compact?: boolean }) {
  const { buses, modEngine, micEnabled, toggleMic } = useModulation();

  const sortedBuses = useMemo(() => buses.slice().sort((a, b) => a.bus.id.localeCompare(b.bus.id)), [buses]);

  return (
    <section className="mt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">MODULATION</div>
        <button
          type="button"
          onClick={toggleMic}
          className={clsx(
            "rounded-full px-3 py-1 text-[11px] transition",
            micEnabled
              ? "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)]"
              : "border border-[color:var(--ps-border-subtle)] text-[color:var(--ps-text-soft)]"
          )}
        >
          Mic: {micEnabled ? "On" : "Off"}
        </button>
      </div>
      {!modEngine && (
        <div className="rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-white px-3 py-2 text-[11px] text-[color:var(--ps-text-soft)]">
          Loading modulation routing…
        </div>
      )}
      <div className={clsx("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2")}> {/* keep layout adaptable without shrinking canvas */}
        {sortedBuses.map((bus) => (
          <ModulationRow key={bus.bus.id} bus={bus} />
        ))}
      </div>
    </section>
  );
}

export default ModulationSection;
