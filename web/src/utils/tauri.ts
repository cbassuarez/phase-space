// Thin bridge to the Tauri desktop shell. All of this is a no-op in the browser
// build (GitHub Pages), so the same frontend runs in both places unchanged.

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Subscribe to native menu events emitted by the desktop shell (see
 * `src-tauri/src/lib.rs`). Resolves to an unsubscribe function. Outside Tauri it
 * resolves to a no-op, so callers can wire it up unconditionally.
 */
export async function onMenuEvent(
  handler: (id: string) => void
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<string>("menu", (event) => handler(event.payload));
  } catch {
    return () => {};
  }
}

/**
 * Open a URL in the user's real browser. Inside Tauri a plain
 * `<a target="_blank">` would try to load in the webview, so we route through
 * the opener plugin; in the browser we fall back to `window.open`.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
