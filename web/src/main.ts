import { loadWasmEngine } from "./phaseClient";

async function main() {
  const debugEl = document.getElementById("debug");
  if (!debugEl) return;

  try {
    const { engine } = await loadWasmEngine();

    const sceneJson = engine.default_lorenz_scene();
    const trajectories = engine.integrate_scene(sceneJson);

    debugEl.textContent = [
      "Default Lorenz scene:",
      sceneJson,
      "",
      "Trajectories shape:",
      Array.isArray(trajectories) ? `outer length = ${trajectories.length}` : "not an array"
    ].join("\n");
  } catch (err) {
    debugEl.textContent = `Error: ${String(err)}`;
  }
}

main();

