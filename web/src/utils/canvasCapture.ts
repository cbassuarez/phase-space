// Snapshot a canvas to a PNG data URL for the cross-dissolve overlay. The frame
// is downscaled to a modest size: a transient fade doesn't need full res, and a
// full-res PNG data URL is multi-MB — enough memory pressure to trip the WASM
// allocator ("out of bounds") on a system change that also builds big buffers.
let tmp: HTMLCanvasElement | null = null;

export function captureCanvasDataURL(src: HTMLCanvasElement, maxDim = 900): string | null {
  if (!src.width || !src.height) return null;
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  if (!tmp) tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return tmp.toDataURL("image/png");
  } catch {
    // Tainted canvas / readback failure — skip the dissolve.
    return null;
  }
}
