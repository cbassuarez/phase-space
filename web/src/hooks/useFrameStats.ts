import { useEffect, useRef, useState } from "react";

export interface FrameStats {
  /** Smoothed frames per second. */
  fps: number;
  /** Smoothed frame time in milliseconds. */
  frameMs: number;
  /** Rolling FPS history (oldest → newest) for a sparkline. */
  history: number[];
}

const HISTORY_LEN = 56;
const EMIT_INTERVAL_MS = 200; // throttle React updates to ~5 Hz

/**
 * Measures real render cadence with a single requestAnimationFrame loop and an
 * EMA so the number is steady, not jumpy. State updates are throttled to ~5 Hz
 * so consumers don't re-render every frame; the sparkline history is sampled at
 * the same rate (~11 s window). Mount this only in small leaf components.
 */
export function useFrameStats(active = true): FrameStats {
  const [stats, setStats] = useState<FrameStats>({ fps: 0, frameMs: 0, history: [] });

  const last = useRef(0);
  const ema = useRef(60);
  const hist = useRef<number[]>([]);
  const lastEmit = useRef(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    last.current = performance.now();
    lastEmit.current = last.current;

    const loop = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      if (dt > 0 && dt < 1000) {
        const inst = 1000 / dt;
        ema.current = ema.current * 0.88 + inst * 0.12;
      }
      if (now - lastEmit.current >= EMIT_INTERVAL_MS) {
        lastEmit.current = now;
        const next = [...hist.current, ema.current].slice(-HISTORY_LEN);
        hist.current = next;
        setStats({ fps: ema.current, frameMs: 1000 / Math.max(1, ema.current), history: next });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return stats;
}

/** Maps an FPS reading to a health CSS color (emerald / amber / red). */
export function fpsHealthColor(fps: number): string {
  if (fps >= 50) return "#10b981";
  if (fps >= 30) return "#f59e0b";
  return "#ef4444";
}
