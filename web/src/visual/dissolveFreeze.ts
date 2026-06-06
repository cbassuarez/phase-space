// Pauses scene motion (auto-spin + head/tail draw window) for the duration of a
// structural cross-dissolve, so the revealed new scene is static and aligned
// with the frozen-frame overlay — otherwise the live scene keeps spinning under
// the snapshot and the attractor appears to drift during the fade.
let freezeUntil = 0;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function beginDissolveFreeze(ms: number): void {
  freezeUntil = nowMs() + ms;
}

export function isDissolveFrozen(): boolean {
  return nowMs() < freezeUntil;
}
