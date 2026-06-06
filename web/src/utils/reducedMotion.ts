// Cached, SSR-safe access to the user's reduced-motion preference. Reads are
// O(1); the media query is created lazily and kept in sync via its change event.
const QUERY = "(prefers-reduced-motion: reduce)";

let mql: MediaQueryList | null = null;
let value = false;
const listeners = new Set<(v: boolean) => void>();

function ensure(): void {
  if (mql || typeof window === "undefined" || typeof window.matchMedia === "undefined") return;
  mql = window.matchMedia(QUERY);
  value = mql.matches;
  mql.addEventListener("change", (e) => {
    value = e.matches;
    listeners.forEach((fn) => fn(value));
  });
}

export function prefersReducedMotion(): boolean {
  ensure();
  return value;
}

export function subscribeReducedMotion(fn: (v: boolean) => void): () => void {
  ensure();
  listeners.add(fn);
  return () => listeners.delete(fn);
}
