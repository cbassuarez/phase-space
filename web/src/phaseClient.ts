// web/src/phaseClient.ts
import init, { WasmEngine } from "./wasm/phasewasm";

export async function loadWasmEngine() {
  await init();
  const engine = new WasmEngine();
  return { engine };
}

