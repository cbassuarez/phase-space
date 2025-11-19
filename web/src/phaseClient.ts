// web/src/phaseClient.ts
import init, { WasmEngine } from "./wasm/phasewasm";

export async function loadWasmEngine() {
  // Initialize the WASM module
  await init();
  const engine = new WasmEngine();
  return { engine };
}
