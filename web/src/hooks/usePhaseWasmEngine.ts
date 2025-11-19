import { useEffect, useMemo, useState } from "react";
import type { SceneSpec, SystemId, Trajectories } from "../types";

interface PhaseWasmApi {
  WasmEngine: new () => {
    default_lorenz_scene: () => string;
    default_rossler_scene: () => string;
    default_aizawa_scene: () => string;
    default_thomas_scene: () => string;
    integrate_scene: (sceneJson: string) => Trajectories;
  };
  default: () => Promise<void>;
}

type EngineInstance = {
  default_lorenz_scene: () => string;
  default_rossler_scene: () => string;
  default_aizawa_scene: () => string;
  default_thomas_scene: () => string;
  integrate_scene: (sceneJson: string) => Trajectories;
};

export function usePhaseWasmEngine() {
  const [engine, setEngine] = useState<EngineInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const wasmModule: PhaseWasmApi = await import("../wasm/phasewasm");
        await wasmModule.default();
        const wasmEngine = new wasmModule.WasmEngine();
        if (!mounted) return;
        setEngine({
          default_lorenz_scene: wasmEngine.default_lorenz_scene.bind(wasmEngine),
          default_rossler_scene: wasmEngine.default_rossler_scene.bind(wasmEngine),
          default_aizawa_scene: wasmEngine.default_aizawa_scene.bind(wasmEngine),
          default_thomas_scene: wasmEngine.default_thomas_scene.bind(wasmEngine),
          integrate_scene: wasmEngine.integrate_scene.bind(wasmEngine),
        });
        setReady(true);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(String(err));
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const api = useMemo(() => {
    if (!engine) return null;
    return {
      getDefaultScene: (system: SystemId): string => {
        switch (system) {
          case "lorenz":
            return engine.default_lorenz_scene();
          case "rossler":
            return engine.default_rossler_scene();
          case "aizawa":
            return engine.default_aizawa_scene();
          case "thomas":
          default:
            return engine.default_thomas_scene();
        }
      },
      integrateScene: (sceneJson: string): { trajectories: Trajectories; scene: SceneSpec } => {
        const trajectories = engine.integrate_scene(sceneJson) as Trajectories;
        const scene = JSON.parse(sceneJson) as SceneSpec;
        return { trajectories, scene };
      },
    };
  }, [engine]);

  return { ready, error, api } as const;
}
