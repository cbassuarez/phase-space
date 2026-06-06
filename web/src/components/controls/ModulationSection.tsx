import clsx from "clsx";
import { AudioWaveform } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Curve } from "../../modulation/types";
import type { ModBus, ModBusRuntimeState, ModTarget } from "../../modulation/types";
import type { TargetPath } from "../../modulation/modEngine";
import { useModulation } from "../../state/modulationState";
import { useViewerState } from "../../state/viewerState";
import { useAudioDevicesContext } from "../../state/audioDevicesState";
import type { ChannelMode } from "../../hooks/useAudioDevices";
import type { RenderStyle } from "../../types";
import {
  controlFocusRing,
  passiveChipClass,
  rangeClass,
  sectionHeadingClass,
  segmentedButtonClass,
  selectClass,
} from "./controlStyles";

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

const synthCenteredRange = (center: number, depth: number, minSpread = 0.12, maxSpread = 0.42): [number, number] => {
  const spread = minSpread + depth * (maxSpread - minSpread);
  return [clamp01(center - spread), clamp01(center + spread)];
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
    value: "view.camera.pulse",
    label: "Camera pulse",
    group: "Camera",
    curve: "log",
    makeTarget: (depth) => ({ path: "view.camera.pulse", range: [0, 0.08 + depth * 0.28], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.08) / 0.28),
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
    value: "render.active.energy",
    label: "Active energy",
    group: "Macro",
    curve: "log",
    makeTarget: (depth) => ({ path: "render.active.energy", range: [0, 0.2 + depth * 0.8], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.2) / 0.8),
  },
  {
    value: "render.active.pulse",
    label: "Hit pulse",
    group: "Macro",
    makeTarget: (depth) => ({ path: "render.active.pulse", range: [0, 0.25 + depth * 0.75] }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.25) / 0.75),
  },
  {
    value: "render.line.width",
    label: "Line width",
    group: "Line",
    makeTarget: (depth) => ({ path: "render.line.width", range: [0.75, 0.9 + depth * 2.0], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.9) / 2.0),
  },
  {
    value: "render.cells.size",
    label: "Cell size",
    group: "Cells",
    makeTarget: (depth) => ({ path: "render.cells.size", range: [0.7, 0.85 + depth * 2.1], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.85) / 2.1),
  },
  {
    value: "render.photonWeave.brightness",
    label: "Photon brightness",
    group: "Rendering",
    curve: "exp",
    makeTarget: (depth) => {
      const min = Math.max(0.2, 0.8 - depth * 0.5);
      const max = Math.min(3.5, 1.2 + depth * 1.8);
      return { path: "render.photonWeave.brightness", range: [min, max], curve: "exp", lag: 0.5 };
    },
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.4) / 2.4),
  },
  {
    value: "render.photonWeave.trail",
    label: "Weave trail",
    group: "Weave",
    makeTarget: (depth) => {
      const span = 0.35 + depth * 1.2;
      return { path: "render.photonWeave.trail", range: [Math.max(0.45, 1 - span / 2), 1 + span] };
    },
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.35) / 1.2),
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
    value: "render.ribbon.glow",
    label: "Ribbon glow",
    group: "Ribbon",
    curve: "exp",
    makeTarget: (depth) => ({ path: "render.ribbon.glow", range: [0, depth * 2.6], curve: "exp" }),
    depthFromRange: (target) => clamp01(target.range[1] / 2.6),
  },
  {
    value: "render.cloud.density",
    label: "Cloud density",
    group: "Rendering",
    makeTarget: (depth) => ({
      path: "render.cloud.density",
      range: [Math.max(0, 0.18 - depth * 0.12), Math.min(1.6, 0.7 + depth * 0.8)],
    }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.7) / 0.8),
  },
  {
    value: "render.caustics.intensity",
    label: "Caustic intensity",
    group: "Rendering",
    makeTarget: (depth) => ({
      path: "render.caustics.intensity",
      range: [0.2, Math.min(2.2, 0.8 + depth * 1.4)],
      curve: "linear",
    }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.8) / 1.4),
  },
  {
    value: "render.caustics.blur",
    label: "Caustic blur",
    group: "Caustics",
    makeTarget: (depth) => ({
      path: "render.caustics.blur",
      range: [0.12, Math.min(1.8, 0.25 + depth * 1.25)],
    }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.25) / 1.25),
  },
  {
    value: "audio.synth.drone",
    label: "Glass drone",
    group: "Synth",
    makeTarget: (depth) => ({ path: "audio.synth.drone", range: [0, 0.34 + depth * 0.62], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.34) / 0.62),
  },
  {
    value: "audio.synth.pluck",
    label: "Plucked sparks",
    group: "Synth",
    makeTarget: (depth) => ({ path: "audio.synth.pluck", range: [0, 0.28 + depth * 0.72], curve: "exp" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.28) / 0.72),
  },
  {
    value: "audio.synth.dust",
    label: "Dust texture",
    group: "Synth",
    makeTarget: (depth) => ({ path: "audio.synth.dust", range: [0, 0.22 + depth * 0.76], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.22) / 0.76),
  },
  {
    value: "audio.synth.bass",
    label: "Low pulse",
    group: "Synth",
    makeTarget: (depth) => ({ path: "audio.synth.bass", range: [0, 0.28 + depth * 0.72], curve: "linear" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.28) / 0.72),
  },
  {
    value: "audio.synth.shimmer",
    label: "Shimmer wash",
    group: "Synth",
    makeTarget: (depth) => ({ path: "audio.synth.shimmer", range: [0, 0.24 + depth * 0.7], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.24) / 0.7),
  },
  {
    value: "audio.synth.pitch",
    label: "Legacy pitch",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.pitch", range: synthCenteredRange(0.48, depth), curve: "linear" }),
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.24) / 0.6),
  },
  {
    value: "audio.synth.timbre",
    label: "Legacy timbre",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.timbre", range: [0.18, 0.32 + depth * 0.62], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.32) / 0.62),
  },
  {
    value: "audio.synth.motion",
    label: "Legacy motion",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.motion", range: [0.08, 0.24 + depth * 0.7], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.24) / 0.7),
  },
  {
    value: "audio.synth.texture",
    label: "Legacy texture",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.texture", range: [0.04, 0.18 + depth * 0.76], curve: "exp" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.18) / 0.76),
  },
  {
    value: "audio.synth.pulse",
    label: "Legacy pulse",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.pulse", range: [0, 0.2 + depth * 0.78], curve: "linear" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.2) / 0.78),
  },
  {
    value: "audio.synth.space",
    label: "Legacy space",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.space", range: synthCenteredRange(0.58, depth, 0.08, 0.36) }),
    depthFromRange: (target) => clamp01((target.range[1] - target.range[0] - 0.16) / 0.56),
  },
  {
    value: "audio.synth.gain",
    label: "Legacy gain",
    group: "Legacy synth",
    makeTarget: (depth) => ({ path: "audio.synth.gain", range: [0.2, 0.34 + depth * 0.42], curve: "log" }),
    depthFromRange: (target) => clamp01((target.range[1] - 0.34) / 0.42),
  },
  {
    value: "audio.voice_0.pitch",
    label: "Legacy voice pitch",
    group: "Legacy sound",
    makeTarget: (depth) => ({ path: "audio.voice_0.pitch", range: centeredRange(depth), curve: "linear" }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.voice_0.pan",
    label: "Legacy voice pan",
    group: "Legacy sound",
    makeTarget: (depth) => ({ path: "audio.voice_0.pan", range: centeredRange(depth) }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.voice_0.brightness",
    label: "Legacy voice brightness",
    group: "Legacy sound",
    makeTarget: (depth) => ({ path: "audio.voice_0.brightness", range: centeredRange(depth) }),
    depthFromRange: (target) => clamp01(target.range[1] - target.range[0]),
  },
  {
    value: "audio.master.gain",
    label: "Legacy master gain",
    group: "Legacy sound",
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
      { value: "visual:flow_x", label: "Flow X" },
      { value: "visual:flow_y", label: "Flow Y" },
      { value: "visual:flow_z", label: "Flow Z" },
      { value: "visual:spatial_spread", label: "Spatial spread" },
      { value: "visual:lobe_pulse", label: "Lobe pulse" },
    ],
  },
];

interface TargetGroup {
  label: string;
  values: TargetPath[];
}

const macroTargets: TargetGroup = {
  label: "Macro",
  values: ["render.active.energy", "render.active.pulse"],
};

const cameraTargets: TargetGroup = {
  label: "Camera",
  values: ["view.camera.r", "view.camera.theta", "view.camera.phi", "view.camera.pulse"],
};

const colorTargets: TargetGroup = {
  label: "Color",
  values: ["view.palette_shift", "view.background_brightness"],
};

const soundTargets: TargetGroup = {
  label: "Synth",
  values: [
    "audio.synth.drone",
    "audio.synth.pluck",
    "audio.synth.dust",
    "audio.synth.bass",
    "audio.synth.shimmer",
  ],
};

const renderTargetGroups: Record<RenderStyle, TargetGroup> = {
  line: { label: "Line", values: ["render.line.width"] },
  cells: { label: "Cells", values: ["render.cells.size"] },
  "volumetric-cloud": { label: "Cloud", values: ["render.cloud.density"] },
  ribbon: { label: "Ribbon", values: ["render.ribbon.width", "render.ribbon.glow"] },
  "photon-weave": { label: "Weave", values: ["render.photonWeave.brightness", "render.photonWeave.trail"] },
  caustics: { label: "Caustics", values: ["render.caustics.intensity", "render.caustics.blur"] },
};

const targetOptionMap = targetOptions.reduce<Record<string, TargetOption>>((acc, opt) => {
  acc[opt.value] = opt;
  return acc;
}, {});

function targetGroupsFor(renderStyle: RenderStyle, selectedTarget?: TargetPath): TargetGroup[] {
  const groups = [macroTargets, cameraTargets, renderTargetGroups[renderStyle], colorTargets, soundTargets];
  const visible = new Set(groups.flatMap((group) => group.values));
  if (selectedTarget && targetOptionMap[selectedTarget] && !visible.has(selectedTarget)) {
    return [{ label: "Current routing", values: [selectedTarget] }, ...groups];
  }
  return groups;
}

function busDepth(bus: ModBus): number {
  const target = bus.targets[0];
  if (!target) return 0.5;
  const opt = targetOptionMap[target.path];
  if (opt?.depthFromRange) return opt.depthFromRange(target);
  return 0.5;
}

function ModulationRow({ bus, renderStyle }: { bus: ModBusRuntimeState; renderStyle: RenderStyle }) {
  const { updateBuses, modEngine } = useModulation();
  const disabled = !modEngine;
  const selectedTarget = bus.bus.targets[0]?.path as TargetPath | undefined;
  const depth = busDepth(bus.bus);
  const trim = clamp01(bus.bus.trim ?? 1);
  const visibleTargetGroups = useMemo(
    () => targetGroupsFor(renderStyle, selectedTarget),
    [renderStyle, selectedTarget]
  );

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

  const handleTrimChange = (nextTrim: number) => {
    updateBuses((buses) =>
      buses.map((b) => (b.id === bus.bus.id ? { ...b, trim: clamp01(nextTrim) } : b))
    );
  };

  const sourceValue = `${bus.bus.source.domain}:${bus.bus.source.feature}`;
  const enabled = bus.bus.enabled;
  // Display "M1" as "CH1" — these are channels.
  const channelLabel = bus.bus.id.replace(/^M(?=\d)/i, "CH");

  return (
    <div
      className={clsx(
        "rounded-[12px] border p-3 transition-[border-color,opacity,box-shadow] duration-150",
        enabled
          ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-bg)] [box-shadow:var(--ps-control-shadow)]"
          : "border-[color:var(--ps-border-subtle)] bg-transparent opacity-60"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tracking-tight text-[color:var(--ps-text)]">
          {channelLabel}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          aria-pressed={enabled}
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? `Turn ${channelLabel} off` : `Turn ${channelLabel} on`}
          title={enabled ? "On" : "Off"}
          className={clsx(
            "relative inline-flex h-[18px] w-9 items-center rounded-full border outline-none transition disabled:opacity-40",
            controlFocusRing,
            enabled
              ? "border-[color:var(--ps-control-selected-border)] bg-[color:var(--ps-control-selected-bg)]"
              : "border-[color:var(--ps-border-strong)] bg-[color:var(--ps-control-fill)] hover:border-[color:var(--ps-text-muted)]"
          )}
        >
          <span
            className={clsx(
              "absolute h-3.5 w-3.5 rounded-full transition-transform",
              enabled
                ? "translate-x-[18px] bg-[color:var(--ps-control-selected-marker)]"
                : "translate-x-0.5 bg-[color:var(--ps-text-muted)]"
            )}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold lowercase tracking-tight">Input</span>
          <select
            value={sourceValue}
            onChange={(e) => handleSourceChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
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
          <span className="text-[10px] font-semibold lowercase tracking-tight">Output</span>
          <select
            value={selectedTarget ?? ""}
            onChange={(e) => handleTargetChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            <option value="" disabled>
              Select a target
            </option>
            {visibleTargetGroups.map((group) => (
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
          <span className="text-[10px] font-semibold lowercase tracking-tight">Depth</span>
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
          className={rangeClass}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold lowercase tracking-tight">Trim</span>
          <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">
            {Math.round(trim * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trim}
          disabled={disabled}
          onChange={(e) => handleTrimChange(parseFloat(e.target.value))}
          className={rangeClass}
        />
      </div>
    </div>
  );
}

function ModulationSection({ compact = false }: { compact?: boolean }) {
  const {
    buses,
    modEngine,
    audioEnabled,
    audioNeedsInput,
    audioNeedsSynth,
    audioTrim,
    setAudioTrim,
    synthStarting,
    synthError,
    toggleAudio,
    clearSynthError,
    micLevel,
    channelCount,
    outputChannelCount,
    channelMode,
    setChannelMode,
  } = useModulation();
  const audioDevices = useAudioDevicesContext();
  const { renderStyle } = useViewerState();
  const [notice, setNotice] = useState<string | null>(null);

  const sortedBuses = useMemo(() => buses.slice().sort((a, b) => a.bus.id.localeCompare(b.bus.id)), [buses]);

  const inputChannelModes = useMemo(() => {
    const pairs: { label: string; mode: ChannelMode }[] = [];
    const monos: { label: string; mode: ChannelMode }[] = [];
    const max = Math.max(1, channelCount);
    for (let i = 1; i <= max; i++) {
      monos.push({ label: `Ch ${i}`, mode: { type: "mono", channel: i } });
    }
    for (let i = 1; i < max; i += 2) {
      const right = Math.min(max, i + 1);
      if (right > i) {
        pairs.push({ label: `${i}/${right}`, mode: { type: "stereo", channels: [i, right] } });
      }
    }
    return { pairs, monos };
  }, [channelCount]);

  const outputChannels = useMemo(() => {
    const channels: string[] = [];
    const max = Math.max(1, outputChannelCount);
    for (let i = 1; i < max; i += 2) {
      const right = Math.min(max, i + 1);
      channels.push(`${i}/${right}`);
    }
    if (channels.length === 0) channels.push("1/2");
    return channels;
  }, [outputChannelCount]);

  useEffect(() => {
    const next =
      synthError ||
      audioDevices.inputFallbackMessage ||
      audioDevices.outputFallbackMessage ||
      audioDevices.errorMessage;
    if (!next) return;
    setNotice(next);
    const timer = window.setTimeout(() => {
      setNotice(null);
      clearSynthError();
      audioDevices.clearInputFallbackMessage();
      audioDevices.clearOutputFallbackMessage();
      audioDevices.clearErrorMessage();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [
    clearSynthError,
    audioDevices.clearErrorMessage,
    audioDevices.clearInputFallbackMessage,
    audioDevices.clearOutputFallbackMessage,
    audioDevices.errorMessage,
    audioDevices.inputFallbackMessage,
    audioDevices.outputFallbackMessage,
    synthError,
  ]);

  const isModeActive = useCallback(
    (mode: ChannelMode) => {
      if (channelMode.type === "mono" && mode.type === "mono") return channelMode.channel === mode.channel;
      if (channelMode.type === "stereo" && mode.type === "stereo") {
        return (
          channelMode.channels[0] === mode.channels[0] && channelMode.channels[1] === mode.channels[1]
        );
      }
      return false;
    },
    [channelMode]
  );

  const audioRouteLabel = audioNeedsInput && audioNeedsSynth ? "input+synth" : audioNeedsInput ? "input" : audioNeedsSynth ? "synth" : "idle";
  const levelWidth = Math.round(Math.min(1, Math.max(0, micLevel)) * 100);
  const meterColor = levelWidth > 90 ? "bg-red-500" : levelWidth > 70 ? "bg-amber-400" : "bg-emerald-500";
  const levelDb = Math.max(-60, Math.round(micLevel * 60 - 60));

  return (
    <section className="mt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={sectionHeadingClass}>
          I/O & ROUTING
        </div>
      </div>

      <div className="rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-3 py-3 [box-shadow:var(--ps-control-shadow)]">
        {notice && (
          <div className="mb-2 rounded-md bg-amber-100/80 px-2 py-1 text-xs text-amber-800/90 dark:bg-amber-900/40 dark:text-amber-100">
            {notice}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold lowercase tracking-tight">Audio</div>
          <button
            type="button"
            onClick={toggleAudio}
            disabled={synthStarting}
            aria-pressed={audioEnabled}
            aria-label={audioEnabled ? "Turn audio off" : "Turn audio on"}
            title={audioEnabled ? "Audio on" : synthStarting ? "Starting audio" : "Audio off"}
            className={clsx(
              "inline-flex h-8 min-w-[118px] items-center justify-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold lowercase tracking-tight outline-none transition disabled:opacity-45",
              controlFocusRing,
              audioEnabled
                ? "bg-[color:var(--ps-control-selected-bg)] text-[color:var(--ps-control-selected-marker)] [box-shadow:0_0_0_1px_var(--ps-control-selected-border),0_0_12px_rgba(59,130,246,0.22)]"
                : "bg-[color:var(--ps-control-fill)] text-[color:var(--ps-text-muted)] hover:text-[color:var(--ps-text-soft)]"
            )}
          >
            <AudioWaveform className="h-4 w-4" strokeWidth={2.4} />
            <span>Audio</span>
            <span className="text-[9px] text-current opacity-65">
              {synthStarting ? "start" : audioEnabled ? audioRouteLabel : "off"}
            </span>
          </button>
        </div>
        {audioNeedsInput && !audioDevices.hasPermission && (
          <p className="mt-1 text-[11px] text-[color:var(--ps-text-muted)]">Allow audio input to choose device.</p>
        )}

        <div className="mt-3 flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold lowercase tracking-tight">Global Trim</span>
            <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">
              {Math.round(audioTrim * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audioTrim}
            onChange={(e) => setAudioTrim(parseFloat(e.target.value))}
            className={rangeClass}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold lowercase tracking-tight">Input Device</span>
            <select
              value={audioDevices.selectedInputId}
              onChange={(e) => audioDevices.setInputDevice(e.target.value)}
              disabled={!audioDevices.hasPermission}
              className={selectClass}
            >
              <option value="default">Default (System)</option>
              {audioDevices.inputs.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label || "Audio input"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold lowercase tracking-tight">Monitor Output</span>
            {audioDevices.supportsSetSinkId ? (
              <select
                value={audioDevices.selectedOutputId}
                onChange={(e) => audioDevices.setOutputDevice(e.target.value)}
                className={selectClass}
              >
                <option value="default">Default (System)</option>
                {audioDevices.outputs.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label || "Audio output"}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-[8px] border border-dashed border-[color:var(--ps-border-subtle)] px-2 py-2 text-[color:var(--ps-text-muted)]">
                Output: System default
              </div>
            )}
          </label>
        </div>

        {/* Channels: input selector → output, consolidated into one row. */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-[10px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]">
            Channels
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[10px] lowercase tracking-tight text-[color:var(--ps-text-muted)]">in</span>
            {inputChannelModes.pairs.length > 0 && (
              <span className="text-[10px] lowercase tracking-tight text-[color:var(--ps-text-soft)]">stereo</span>
            )}
            {inputChannelModes.pairs.map(({ label, mode }) => (
              <button
                key={`s-${label}`}
                type="button"
                onClick={() => setChannelMode(mode)}
                aria-pressed={isModeActive(mode)}
                className={segmentedButtonClass(isModeActive(mode), { size: "sm", fill: false, marker: false })}
              >
                {label}
              </button>
            ))}
            {inputChannelModes.pairs.length > 0 && inputChannelModes.monos.length > 0 && (
              <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-[color:var(--ps-border-strong)]" />
            )}
            {inputChannelModes.monos.length > 0 && (
              <span className="text-[10px] lowercase tracking-tight text-[color:var(--ps-text-soft)]">mono</span>
            )}
            {inputChannelModes.monos.map(({ label, mode }) => (
              <button
                key={`m-${label}`}
                type="button"
                onClick={() => setChannelMode(mode)}
                aria-pressed={isModeActive(mode)}
                className={segmentedButtonClass(isModeActive(mode), { size: "sm", fill: false, marker: false })}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-[10px] lowercase tracking-tight text-[color:var(--ps-text-muted)]">out</span>
            {outputChannels.map((label) => (
              <div key={label} className={passiveChipClass}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]">
            <span>Input Level</span>
            <span className="tabular-nums text-[10px] text-[color:var(--ps-text-soft)]">
              {`${levelDb} dB`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 shadow-inner dark:bg-slate-800/80">
            <div
              className={clsx("h-full", meterColor)}
              style={{ width: `${levelWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[color:var(--ps-text-muted)]">
            <span>-60dB</span>
            <span>-24dB</span>
            <span>-12dB</span>
            <span>0dB</span>
          </div>
        </div>
      </div>

      {!modEngine && (
        <div className="rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-3 py-2 text-[11px] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)]">
          Loading modulation routing…
        </div>
      )}
      <div className={clsx("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2")}> {/* keep layout adaptable without shrinking canvas */}
        {sortedBuses.map((bus) => (
          <ModulationRow key={bus.bus.id} bus={bus} renderStyle={renderStyle} />
        ))}
      </div>
    </section>
  );
}

export default ModulationSection;
