import { useEffect } from "react";

function syncRangeFill(el: HTMLInputElement) {
  const min = parseFloat(el.min);
  const max = parseFloat(el.max);
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : 1;
  const range = hi - lo;
  const pos = range > 0 ? (parseFloat(el.value) - lo) / range : 1;
  el.style.setProperty("--ps-range-pos", String(Math.max(0, Math.min(1, pos))));
}

/**
 * Drives every `.phase-range` slider's `--ps-range-pos` (0–1) from its value so
 * the coloured track fill slides with the thumb. One global input listener plus
 * a MutationObserver to seed newly-mounted sliders — no per-slider wiring. The
 * resolution slider uses a different class and is intentionally left alone.
 */
export function useRangeFill() {
  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.classList.contains("phase-range")) {
        syncRangeFill(t);
      }
    };
    document.addEventListener("input", onInput, true);

    const syncAll = (root: ParentNode) =>
      root.querySelectorAll<HTMLInputElement>("input.phase-range").forEach(syncRangeFill);
    syncAll(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("input.phase-range")) syncRangeFill(node as HTMLInputElement);
          syncAll(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("input", onInput, true);
      observer.disconnect();
    };
  }, []);
}
