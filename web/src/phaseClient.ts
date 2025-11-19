// Simple wrapper for the WASM engine.

type WasmModule = typeof import("../public/phasewasm/phasewasm");

let wasmInitPromise: Promise<WasmModule> | null = null;

export async function loadWasmEngine() {
  if (!wasmInitPromise) {
    wasmInitPromise = import("../public/phasewasm/phasewasm");
  }
  const mod = await wasmInitPromise;
  const engine = new mod.WasmEngine();
  return { mod, engine };
}

