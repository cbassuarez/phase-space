// web/src/phaseClient.ts
<<<<<<< HEAD
import init, { WasmEngine } from "./wasm/phasewasm";

export async function loadWasmEngine() {
  // Initialize the WASM module
=======

import init, { WasmEngine } from "./wasm/phasewasm";

export async function loadWasmEngine() {
>>>>>>> b624fef (add web docs)
  await init();
  const engine = new WasmEngine();
  return { engine };
}

