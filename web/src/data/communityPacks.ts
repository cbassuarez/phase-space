import type { AttractorDef } from "./customAttractors";

// Community attractors are fetched at runtime from a separate, review-gated
// repo (so new packs appear without redeploying the app). The repo only ever
// contains manifests merged through PR review, so this is *reviewed* content
// delivered over jsDelivr (CORS-friendly, CDN-cached) — not arbitrary input.

const REPO = "cbassuarez/phase-space-attractors";
const INDEX_URL = `https://cdn.jsdelivr.net/gh/${REPO}@main/index.json`;
const CACHE_KEY = "phase-space.community";
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

interface CacheEntry {
  at: number;
  list: AttractorDef[];
}

function readCache(): AttractorDef[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > TTL_MS) return null;
    return entry.list;
  } catch {
    return null;
  }
}

function writeCache(list: AttractorDef[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list } satisfies CacheEntry));
  } catch {
    /* ignore */
  }
}

/** Fetch the community index (cached). Returns [] on any failure — the feature
 *  degrades to Core + Mine when offline or before the repo exists. */
export async function fetchCommunityAttractors(force = false): Promise<AttractorDef[]> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  try {
    const res = await fetch(INDEX_URL, { cache: "no-cache" });
    if (!res.ok) return readCache() ?? [];
    const raw = (await res.json()) as AttractorDef[];
    const list = (Array.isArray(raw) ? raw : [])
      .filter((d) => d && d.equations && d.equations.dx)
      .map((d) => ({ ...d, schema: 1 as const, source: "community" as const }));
    writeCache(list);
    return list;
  } catch {
    return readCache() ?? [];
  }
}
