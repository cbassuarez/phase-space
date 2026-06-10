import clsx from "clsx";
import {
  Cpu,
  Download,
  FileInput,
  Film,
  FolderOpen,
  Image,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Square,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrameStats } from "../../hooks/useFrameStats";
import { useViewerState } from "../../state/viewerState";
import {
  encodeDesktopSequence,
  getDesktopOutputCapabilities,
  revealOutputPath,
  sendArtnetDmx,
  writeDesktopFrame,
  type DesktopOutputCapabilities,
  type OutputCapability,
} from "../../utils/desktopOutput";
import { isTauri } from "../../utils/tauri";
import { getLatestVisualFrame } from "../../visual/liveOutputFrame";
import type { VisualFeatureFrame } from "../../visual/visualFeatures";
import {
  commandButtonClass,
  rangeClass,
  sectionHeadingClass,
} from "./controlStyles";
import ToggleSwitch from "./ToggleSwitch";

const sectionShellClass =
  "space-y-3 rounded-[14px] border border-[color:var(--ps-border-subtle)] bg-[linear-gradient(180deg,var(--ps-panel-alt-bg),var(--ps-panel-bg))] p-3 shadow-[var(--ps-control-shadow)]";
const sectionHeaderClass =
  "flex items-center justify-between gap-3 border-b border-[color:var(--ps-border-subtle)] pb-2";
const sectionKickerClass =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] px-1.5 text-[10px] font-semibold tabular-nums text-[color:var(--ps-text-soft)] shadow-[var(--ps-control-shadow)]";
const fieldClass =
  "space-y-2 rounded-[10px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] p-2 shadow-[var(--ps-control-shadow)]";
const inputClass =
  "h-8 w-full rounded-[8px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-panel-bg)] px-2 text-xs tabular-nums text-[color:var(--ps-text)] outline-none transition focus:border-[color:var(--ps-focus-ring)]";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function byte(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function joinOutputPath(dir: string, filename: string): string {
  const separator = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${filename}`;
}

function safePrefix(value: string): string {
  const next = value.trim().replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
  return next || "phase-space";
}

function dmxValues(frame: VisualFeatureFrame | null): number[] {
  const f = frame ?? {
    camera_orbit_phase: 0,
    camera_radius_norm: 0,
    avg_speed: 0,
    curvature: 0,
    traj_density: 0,
    flow_x: 0.5,
    flow_y: 0.5,
    flow_z: 0.5,
    spatial_spread: 0,
    lobe_pulse: 0,
  };
  return [
    byte(f.camera_orbit_phase),
    byte(f.camera_radius_norm),
    byte(f.avg_speed),
    byte(f.curvature),
    byte(f.traj_density),
    byte(f.flow_x),
    byte(f.flow_y),
    byte(f.flow_z),
    byte(f.spatial_spread),
    byte(f.lobe_pulse),
  ];
}

function CapabilityRow({ capability }: { capability: OutputCapability }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[9px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-[color:var(--ps-text)]">{capability.label}</div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[color:var(--ps-text-muted)]">
          {capability.detail}
        </div>
      </div>
      <span
        className={clsx(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium lowercase tabular-nums",
          capability.available
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            : "border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text-muted)]"
        )}
      >
        {capability.available ? "ready" : "blocked"}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
        }}
        className={inputClass}
      />
    </label>
  );
}

export default function OutputPanel() {
  const {
    captureFrameDataURL,
    requestRenderStill,
    projectPath,
    projectStatus,
    computeBackend,
    runtimeCapabilities,
    saveProject,
    openProject,
    recoverAutosave,
  } = useViewerState();
  const stats = useFrameStats();
  const [capabilities, setCapabilities] = useState<DesktopOutputCapabilities | null>(null);
  const [outputDir, setOutputDir] = useState("");
  const [prefix, setPrefix] = useState("phase-space");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [duration, setDuration] = useState(2);
  const [fps, setFps] = useState(24);
  const [codec, setCodec] = useState<"h264" | "prores">("h264");
  const [status, setStatus] = useState("idle");
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [sequenceProgress, setSequenceProgress] = useState<{ done: number; total: number } | null>(null);
  const [artnetEnabled, setArtnetEnabled] = useState(false);
  const [artnetHost, setArtnetHost] = useState("127.0.0.1");
  const [artnetUniverse, setArtnetUniverse] = useState(0);
  const [artnetRate, setArtnetRate] = useState(25);
  const [artnetStatus, setArtnetStatus] = useState("idle");
  const [projectPathInput, setProjectPathInput] = useState("");
  const sequenceCancelRef = useRef(false);
  const artnetSequenceRef = useRef(1);

  const desktop = isTauri();
  const normalizedPrefix = useMemo(() => safePrefix(prefix), [prefix]);
  const canUseDesktopOutput = desktop && outputDir.trim().length > 0;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const ffmpegReady = !!capabilities?.ffmpeg.available;

  useEffect(() => {
    if (projectPath) {
      setProjectPathInput(projectPath);
    } else if (runtimeCapabilities?.default_project_dir && !projectPathInput) {
      setProjectPathInput(`${runtimeCapabilities.default_project_dir.replace(/[\\/]+$/, "")}/scene.phsp`);
    }
  }, [projectPath, runtimeCapabilities, projectPathInput]);

  const refreshCapabilities = useCallback(async () => {
    if (!desktop) return;
    try {
      const next = await getDesktopOutputCapabilities();
      setCapabilities(next);
      if (next?.default_output_dir && !outputDir) {
        setOutputDir(next.default_output_dir);
      }
    } catch (err) {
      setStatus(String(err));
    }
  }, [desktop, outputDir]);

  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  useEffect(() => {
    if (!artnetEnabled || !desktop) return;
    let cancelled = false;
    let inFlight = false;
    const intervalMs = Math.max(16, Math.round(1000 / artnetRate));
    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await sendArtnetDmx({
          host: artnetHost,
          universe: artnetUniverse,
          sequence: artnetSequenceRef.current++ % 256,
          values: dmxValues(getLatestVisualFrame()),
        });
        if (!cancelled) {
          setArtnetStatus(`${result.channels} ch → ${result.target}`);
        }
      } catch (err) {
        if (!cancelled) {
          setArtnetStatus(String(err));
          setArtnetEnabled(false);
        }
      } finally {
        inFlight = false;
      }
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [artnetEnabled, desktop, artnetHost, artnetUniverse, artnetRate]);

  const saveStill = useCallback(async () => {
    if (!desktop) {
      requestRenderStill();
      return;
    }
    if (!canUseDesktopOutput) {
      setStatus("output directory required");
      return;
    }
    const dataUrl = captureFrameDataURL({ width, height });
    if (!dataUrl) {
      setStatus("frame capture failed");
      return;
    }
    try {
      setStatus("writing still…");
      const result = await writeDesktopFrame({
        dataUrl,
        outputDir,
        prefix: normalizedPrefix,
      });
      setLastPath(result.path);
      setStatus(`wrote ${result.path}`);
    } catch (err) {
      setStatus(String(err));
    }
  }, [
    desktop,
    requestRenderStill,
    canUseDesktopOutput,
    captureFrameDataURL,
    width,
    height,
    outputDir,
    normalizedPrefix,
  ]);

  const captureSequence = useCallback(async () => {
    if (!canUseDesktopOutput) {
      setStatus("output directory required");
      return;
    }
    sequenceCancelRef.current = false;
    setSequenceProgress({ done: 0, total: totalFrames });
    setStatus("capturing sequence…");
    try {
      for (let i = 0; i < totalFrames; i += 1) {
        if (sequenceCancelRef.current) {
          setStatus("sequence stopped");
          break;
        }
        const dataUrl = captureFrameDataURL({ width, height });
        if (!dataUrl) throw new Error("frame capture failed");
        const result = await writeDesktopFrame({
          dataUrl,
          outputDir,
          prefix: normalizedPrefix,
          frameIndex: i,
        });
        setLastPath(result.path);
        setSequenceProgress({ done: i + 1, total: totalFrames });
        await wait(1000 / fps);
      }
      if (!sequenceCancelRef.current) {
        setStatus(`captured ${totalFrames} frames`);
      }
    } catch (err) {
      setStatus(String(err));
    }
  }, [
    canUseDesktopOutput,
    totalFrames,
    captureFrameDataURL,
    width,
    height,
    outputDir,
    normalizedPrefix,
    fps,
  ]);

  const stopSequence = useCallback(() => {
    sequenceCancelRef.current = true;
  }, []);

  const encodeSequence = useCallback(async () => {
    if (!canUseDesktopOutput) {
      setStatus("output directory required");
      return;
    }
    const ext = codec === "prores" ? "mov" : "mp4";
    const outputPath = joinOutputPath(outputDir, `${normalizedPrefix}.${ext}`);
    try {
      setStatus("encoding sequence…");
      const result = await encodeDesktopSequence({
        outputDir,
        prefix: normalizedPrefix,
        fps,
        codec,
        outputPath,
        startNumber: 0,
      });
      setLastPath(result.output_path);
      setStatus(result.success ? `encoded ${result.output_path}` : result.stderr || "ffmpeg failed");
    } catch (err) {
      setStatus(String(err));
    }
  }, [canUseDesktopOutput, codec, outputDir, normalizedPrefix, fps]);

  const sendDmxOnce = useCallback(async () => {
    if (!desktop) return;
    try {
      const result = await sendArtnetDmx({
        host: artnetHost,
        universe: artnetUniverse,
        sequence: artnetSequenceRef.current++ % 256,
        values: dmxValues(getLatestVisualFrame()),
      });
      setArtnetStatus(`${result.channels} ch → ${result.target}`);
    } catch (err) {
      setArtnetStatus(String(err));
    }
  }, [desktop, artnetHost, artnetUniverse]);

  const sendBlackout = useCallback(async () => {
    if (!desktop) return;
    try {
      const result = await sendArtnetDmx({
        host: artnetHost,
        universe: artnetUniverse,
        sequence: artnetSequenceRef.current++ % 256,
        values: new Array(10).fill(0),
      });
      setArtnetStatus(`blackout → ${result.target}`);
    } catch (err) {
      setArtnetStatus(String(err));
    }
  }, [desktop, artnetHost, artnetUniverse]);

  const revealLastPath = useCallback(async () => {
    const target = lastPath ?? outputDir;
    if (!target) return;
    try {
      await revealOutputPath(target);
    } catch (err) {
      setStatus(String(err));
    }
  }, [lastPath, outputDir]);

  return (
    <div className="space-y-3">
      <section className={sectionShellClass}>
        <div className={sectionHeaderClass}>
          <div className="flex items-center gap-2">
            <span className={sectionKickerClass}>00</span>
            <div className={sectionHeadingClass}>project</div>
          </div>
          <span className="max-w-[190px] truncate text-[10px] lowercase text-[color:var(--ps-text-muted)]">
            {computeBackend}
          </span>
        </div>

        <div className="grid gap-2">
          <CapabilityRow
            capability={
              runtimeCapabilities?.native_compute ?? {
                label: "Native Rust compute",
                available: false,
                detail: desktop ? "probing desktop runtime…" : "desktop only",
              }
            }
          />
          <CapabilityRow
            capability={
              runtimeCapabilities?.wgpu ?? {
                label: "wgpu native renderer",
                available: false,
                detail: "desktop renderer backend not loaded",
              }
            }
          />
        </div>

        <div className={fieldClass}>
          <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <span>Project path</span>
            <input
              value={projectPathInput}
              onChange={(event) => setProjectPathInput(event.target.value)}
              className={inputClass}
              spellCheck={false}
              placeholder="~/Documents/phase-space/scene.phsp"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => saveProject(projectPathInput || undefined)}
              disabled={!desktop}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => projectPathInput && openProject(projectPathInput)}
              disabled={!desktop || !projectPathInput}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <FileInput className="h-3.5 w-3.5" />
              <span>Open</span>
            </button>
            <button
              type="button"
              onClick={recoverAutosave}
              disabled={!desktop}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Recover</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 truncate text-[10px] lowercase tabular-nums text-[color:var(--ps-text-muted)]">
            <Cpu className="h-3 w-3 shrink-0" />
            <span className="truncate">{projectStatus ?? "idle"}</span>
          </div>
        </div>
      </section>

      <section className={sectionShellClass}>
        <div className={sectionHeaderClass}>
          <div className="flex items-center gap-2">
            <span className={sectionKickerClass}>01</span>
            <div className={sectionHeadingClass}>live</div>
          </div>
          <button
            type="button"
            onClick={refreshCapabilities}
            className={commandButtonClass(false, { size: "sm" })}
            title="Refresh output capabilities"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{capabilities?.platform ?? "browser"}</span>
          </button>
        </div>

        <div className="grid gap-2">
          {capabilities ? (
            <>
              <CapabilityRow capability={capabilities.syphon} />
              <CapabilityRow capability={capabilities.spout} />
              <CapabilityRow capability={capabilities.ndi} />
              <CapabilityRow capability={capabilities.artnet} />
            </>
          ) : (
            <div className="rounded-[9px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-2.5 py-2 text-xs text-[color:var(--ps-text-soft)]">
              desktop shell unavailable
            </div>
          )}
        </div>

        <div className={fieldClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ps-text-soft)]">
              <Radio className="h-3.5 w-3.5" />
              Art-Net DMX
            </span>
            <div className="w-28">
              <ToggleSwitch
                label="Live"
                checked={artnetEnabled}
                onToggle={() => setArtnetEnabled((value) => !value)}
                disabled={!desktop}
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_76px] gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
              <span>Host</span>
              <input
                value={artnetHost}
                onChange={(event) => setArtnetHost(event.target.value)}
                className={inputClass}
                spellCheck={false}
              />
            </label>
            <NumberField
              label="Universe"
              value={artnetUniverse}
              min={0}
              max={32767}
              onChange={setArtnetUniverse}
            />
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <div className="flex items-center justify-between">
              <span>Rate</span>
              <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{artnetRate} Hz</span>
            </div>
            <input
              type="range"
              min={1}
              max={44}
              step={1}
              value={artnetRate}
              onChange={(event) => setArtnetRate(Number(event.target.value))}
              className={rangeClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={sendDmxOnce}
              disabled={!desktop}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </button>
            <button
              type="button"
              onClick={sendBlackout}
              disabled={!desktop}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Blackout</span>
            </button>
          </div>
          <div className="truncate text-[10px] lowercase tabular-nums text-[color:var(--ps-text-muted)]">
            {artnetStatus}
          </div>
        </div>
      </section>

      <section className={sectionShellClass}>
        <div className={sectionHeaderClass}>
          <div className="flex items-center gap-2">
            <span className={sectionKickerClass}>02</span>
            <div className={sectionHeadingClass}>capture</div>
          </div>
          <button
            type="button"
            onClick={revealLastPath}
            disabled={!desktop || !outputDir}
            className={commandButtonClass(false, { size: "sm" })}
            title="Open output folder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Open</span>
          </button>
        </div>

        <div className={fieldClass}>
          <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <span>Output path</span>
            <input
              value={outputDir}
              onChange={(event) => setOutputDir(event.target.value)}
              className={inputClass}
              spellCheck={false}
              placeholder="~/Movies/phase-space"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <span>Prefix</span>
            <input
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              className={inputClass}
              spellCheck={false}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" value={width} min={320} max={8192} step={16} onChange={setWidth} />
          <NumberField label="Height" value={height} min={240} max={8192} step={16} onChange={setHeight} />
          <NumberField label="Seconds" value={duration} min={0.25} max={60} step={0.25} onChange={setDuration} />
          <NumberField label="FPS" value={fps} min={1} max={60} onChange={setFps} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={saveStill} className={commandButtonClass(false, { size: "sm" })}>
            <Image className="h-3.5 w-3.5" />
            <span>Still</span>
          </button>
          {sequenceProgress && sequenceProgress.done < sequenceProgress.total ? (
            <button type="button" onClick={stopSequence} className={commandButtonClass(true, { size: "sm" })}>
              <Square className="h-3.5 w-3.5" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={captureSequence}
              disabled={!desktop}
              className={commandButtonClass(false, { size: "sm" })}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Sequence</span>
            </button>
          )}
        </div>

        <div className={fieldClass}>
          <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-group-bg)] p-1 text-xs shadow-[var(--ps-control-group-shadow)]">
            {(["h264", "prores"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCodec(option)}
                aria-pressed={codec === option}
                className={clsx(
                  "min-h-8 rounded-[8px] px-2 text-xs font-medium transition",
                  codec === option
                    ? "bg-[color:var(--ps-control-selected-bg)] text-[color:var(--ps-text)] shadow-[var(--ps-control-shadow)]"
                    : "text-[color:var(--ps-text-soft)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)]"
                )}
              >
                {option === "h264" ? "MP4" : "ProRes"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={encodeSequence}
            disabled={!desktop || !ffmpegReady}
            className={commandButtonClass(false, { size: "sm" })}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Encode</span>
          </button>
          <div className="truncate text-[10px] lowercase tabular-nums text-[color:var(--ps-text-muted)]">
            {capabilities?.ffmpeg.version ?? capabilities?.ffmpeg.detail ?? "ffmpeg unavailable"}
          </div>
        </div>

        <div className="space-y-1 rounded-[9px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] lowercase text-[color:var(--ps-text-muted)]">
            <span className="truncate">{status}</span>
            <span className="shrink-0 tabular-nums">{Math.round(stats.fps) || "—"} fps</span>
          </div>
          {sequenceProgress && (
            <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--ps-control-group-bg)]">
              <div
                className="h-full rounded-full bg-[color:var(--ps-control-selected-marker)] transition-[width]"
                style={{
                  width: `${Math.min(100, (sequenceProgress.done / sequenceProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
