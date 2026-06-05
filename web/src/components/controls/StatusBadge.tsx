import { useFrameStats, fpsHealthColor } from "../../hooks/useFrameStats";

/**
 * Live status chip for the sidebar header. Replaces the decorative system pill
 * with a genuine at-a-glance readout: a health dot whose color tracks render
 * performance, the current system, and a live FPS count.
 */
export function StatusBadge({ system }: { system: string }) {
  const { fps } = useFrameStats();
  const color = fpsHealthColor(fps);
  const rounded = Math.round(fps);

  return (
    <div
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-2.5 py-1 text-[11px] font-medium"
      title={`${rounded} fps`}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      <span className="capitalize text-[color:var(--ps-text-soft)]">{system}</span>
      <span className="tabular-nums text-[color:var(--ps-text-muted)]">{rounded} fps</span>
    </div>
  );
}

export default StatusBadge;
