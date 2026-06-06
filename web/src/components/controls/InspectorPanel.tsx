import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Clipboard, Download, SlidersHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { useViewerState } from "../../state/viewerState";
import { useFrameStats, fpsHealthColor } from "../../hooks/useFrameStats";
import { commandButtonClass, disclosureSummaryClass } from "./controlStyles";

const GREEK: Record<string, string> = {
  sigma: "σ",
  rho: "ρ",
  beta: "β",
  alpha: "α",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  lambda: "λ",
  mu: "μ",
  omega: "ω",
};

function paramSymbol(key: string): string {
  return GREEK[key.toLowerCase()] ?? key;
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) >= 100) return v.toFixed(0);
  const s = v.toFixed(Math.abs(v) < 1 ? 3 : 2);
  return s.replace(/\.?0+$/, "");
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 116;
  const h = 36;
  const max = 60;
  if (data.length < 2) {
    return <div className="h-9 w-[116px]" aria-hidden="true" />;
  }
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - Math.max(0, Math.min(1, v / max)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-9 w-[116px] text-[color:var(--ps-text-muted)]"
      aria-hidden="true"
    >
      {/* 60fps reference */}
      <line
        x1="0"
        y1="0.75"
        x2={w}
        y2="0.75"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={color} opacity={0.12} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <dt className="lowercase tracking-tight text-[11px] text-[color:var(--ps-text-muted)]">
        {label}
      </dt>
      <dd className="truncate text-right text-[11px] tracking-tight tabular-nums text-[color:var(--ps-text)]">
        {value}
      </dd>
    </div>
  );
}

/**
 * Inspector: live telemetry + diagnostics for the current scene. Performance
 * (FPS with a rolling sparkline), the render/geometry/camera state, the actual
 * attractor parameters, and scene actions (copy JSON / params, save a PNG of
 * the current frame).
 */
export function InspectorPanel() {
  const {
    trajectoryMeta,
    system,
    sceneSpec,
    renderStyle,
    materialTransmission,
    palette,
    resolution,
    background,
    cameraProgram,
    sceneJson,
    requestRenderStill,
  } = useViewerState();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"json" | "params" | null>(null);
  const stats = useFrameStats();

  const params = (sceneSpec?.params ?? {}) as Record<string, unknown>;
  const paramEntries = Object.entries(params).filter(
    ([, v]) => typeof v === "number"
  ) as [string, number][];
  const integ = sceneSpec?.integrator ?? {};
  const seed = sceneSpec?.random_seed;
  const healthColor = fpsHealthColor(stats.fps);

  const flash = useCallback((kind: "json" | "params") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1200);
  }, []);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sceneJson);
      flash("json");
    } catch (err) {
      console.error("Clipboard unsupported", err);
    }
  }, [sceneJson, flash]);

  const copyParams = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      flash("params");
    } catch (err) {
      console.error("Clipboard unsupported", err);
    }
  }, [params, flash]);

  // The viewer renders a transparent-background frame and downloads it
  // (registered via setRenderStillHandler in the canvas).
  const saveFrame = useCallback(() => {
    requestRenderStill();
  }, [requestRenderStill]);

  return (
    <section className="mt-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          disclosureSummaryClass,
          "w-full rounded-none border-x-0 border-b-0 border-t border-[color:var(--ps-border-subtle)] px-0 pt-3"
        )}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-[12px] font-medium lowercase tracking-tight text-[color:var(--ps-text-soft)]">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
          inspector
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] lowercase tracking-tight text-[color:var(--ps-text-muted)]">
          <span className="tabular-nums">{Math.round(stats.fps) || "—"} fps</span>
          <motion.span animate={{ rotate: open ? 90 : 0 }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3">
              {/* Performance */}
              <div className="flex items-center gap-3 rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-3 py-2 [box-shadow:var(--ps-control-shadow)]">
                <div className="flex flex-col">
                  <span className="flex items-baseline gap-1">
                    <span
                      className="text-xl font-semibold leading-none tabular-nums"
                      style={{ color: healthColor }}
                    >
                      {Math.round(stats.fps) || "—"}
                    </span>
                    <span className="text-[11px] lowercase tracking-tight text-[color:var(--ps-text-muted)]">
                      fps
                    </span>
                  </span>
                  <span className="mt-1 text-[11px] lowercase tracking-tight tabular-nums text-[color:var(--ps-text-muted)]">
                    {stats.frameMs ? `${stats.frameMs.toFixed(1)} ms/frame` : "measuring…"}
                  </span>
                </div>
                <div className="ml-auto">
                  <Sparkline data={stats.history} color={healthColor} />
                </div>
              </div>

                {/* Telemetry */}
              <dl className="grid grid-cols-2 gap-x-4">
                <Row label="Render" value={renderStyle} />
                <Row label="Transmission" value={materialTransmission.toFixed(2)} />
                <Row label="Palette" value={palette} />
                <Row label="Theme" value={background} />
                <Row label="Resolution" value={resolution} />
                <Row
                  label="Integrator"
                  value={
                    integ.dt != null
                      ? `${integ.steps ?? "—"}× · dt ${integ.dt}`
                      : "—"
                  }
                />
                <Row label="Trajectories" value={trajectoryMeta.count} />
                <Row label="Points" value={`~${trajectoryMeta.points.toLocaleString()}`} />
                <Row label="Camera" value={cameraProgram?.mode ?? "—"} />
                <Row label="Seed" value={seed ?? "—"} />
              </dl>

              {/* Attractor parameters */}
              {paramEntries.length > 0 && (
                <div className="space-y-1.5">
                  <div className="lowercase tracking-tight text-[11px] text-[color:var(--ps-text-muted)]">
                    {system} parameters
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {paramEntries.map(([k, v]) => (
                      <span
                        key={k}
                        title={k}
                        className="inline-flex items-center gap-1 rounded-[7px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-2 py-0.5 text-[11px] tabular-nums text-[color:var(--ps-text)]"
                      >
                        <span className="text-[color:var(--ps-text-soft)]">{paramSymbol(k)}</span>
                        {fmtNum(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={copyJson}
                  className={commandButtonClass(copied === "json", { size: "sm" })}
                >
                  {copied === "json" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  <span className="lowercase tracking-tight">json</span>
                </button>
                <button
                  type="button"
                  onClick={copyParams}
                  disabled={paramEntries.length === 0}
                  className={commandButtonClass(copied === "params", { size: "sm" })}
                >
                  {copied === "params" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  <span className="lowercase tracking-tight">params</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    saveFrame();
                  }}
                  className={commandButtonClass(false, { size: "sm" })}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="lowercase tracking-tight">png</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default InspectorPanel;
