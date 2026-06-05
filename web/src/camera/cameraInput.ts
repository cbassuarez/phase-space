/**
 * Module-scope bridge between DOM pointer/wheel events (written by the canvas)
 * and the camera controller (which reads it once per frame). Holds the drag
 * state plus the deltas accumulated since the last frame; `consume()` drains
 * them so each delta is integrated exactly once.
 */
let dragging = false;
let pendingYaw = 0;
let pendingPitch = 0;
let pendingZoom = 0;

export interface CameraInputFrame {
  dragging: boolean;
  pendingYaw: number;
  pendingPitch: number;
  pendingZoom: number;
}

export const cameraInput = {
  beginDrag() {
    dragging = true;
  },
  endDrag() {
    dragging = false;
  },
  isDragging() {
    return dragging;
  },
  /** Pixel drag → orbit radians. A full-height vertical drag ≈ 180°. */
  dragBy(dxPixels: number, dyPixels: number, viewportHeight: number) {
    const k = Math.PI / Math.max(1, viewportHeight);
    pendingYaw += -dxPixels * k;
    pendingPitch += -dyPixels * k;
  },
  /** Wheel delta → radius change in log space (so zoom feels uniform). */
  zoomBy(deltaY: number) {
    pendingZoom += deltaY * 0.0012;
  },
  consume(): CameraInputFrame {
    const frame: CameraInputFrame = { dragging, pendingYaw, pendingPitch, pendingZoom };
    pendingYaw = 0;
    pendingPitch = 0;
    pendingZoom = 0;
    return frame;
  },
};
