let faviconCanvas: HTMLCanvasElement | null = null;

/**
 * Downsample the live viewer canvas into a square favicon and swap it in.
 * Center-crops to square (the viewer is landscape) and writes a data URL onto
 * the document's `rel="icon"` link.
 */
export function updateFaviconFromCanvas(src: HTMLCanvasElement, size = 64): void {
  if (!src.width || !src.height) return;

  if (!faviconCanvas) {
    faviconCanvas = document.createElement("canvas");
    faviconCanvas.width = size;
    faviconCanvas.height = size;
  }
  const ctx = faviconCanvas.getContext("2d");
  if (!ctx) return;

  const crop = Math.min(src.width, src.height);
  const sx = (src.width - crop) / 2;
  const sy = (src.height - crop) / 2;
  ctx.clearRect(0, 0, size, size);
  let url: string;
  try {
    ctx.drawImage(src, sx, sy, crop, crop, 0, 0, size, size);
    url = faviconCanvas.toDataURL("image/png");
  } catch {
    // Tainted canvas / readback failure — leave the favicon as-is.
    return;
  }

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = url;
}
