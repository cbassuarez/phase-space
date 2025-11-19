import { useEffect, useMemo, useState } from "react";
import type { SceneSpec, SystemId, Trajectories } from "../types";

type WasmEngineClass = new () => {
  default_lorenz_scene?: () => string;
  default_rossler_scene?: () => string;
  default_aizawa_scene?: () => string;
  default_thomas_scene?: () => string;
  integrate_scene: (sceneJson: string) => Trajectories;
};

interface PhaseWasmApi {
  WasmEngine: WasmEngineClass;
  default: () => Promise<void>;
}

type EngineInstance = {
  default_lorenz_scene: () => string;
  default_rossler_scene?: () => string;
  default_aizawa_scene?: () => string;
  default_thomas_scene?: () => string;
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
        const defaultLorenz = wasmEngine.default_lorenz_scene?.bind(wasmEngine);
        const defaultRossler = wasmEngine.default_rossler_scene?.bind(wasmEngine);
        const defaultAizawa = wasmEngine.default_aizawa_scene?.bind(wasmEngine);
        const defaultThomas = wasmEngine.default_thomas_scene?.bind(wasmEngine);

        if (!defaultLorenz) {
          throw new Error("phasewasm is missing default_lorenz_scene export");
        }

        setEngine({
          default_lorenz_scene: defaultLorenz,
          default_rossler_scene: defaultRossler,
          default_aizawa_scene: defaultAizawa,
          default_thomas_scene: defaultThomas,
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
            if (engine.default_rossler_scene) return engine.default_rossler_scene();
            console.warn("phasewasm missing default_rossler_scene; using Lorenz scene instead");
            return engine.default_lorenz_scene();
          case "aizawa":
            if (engine.default_aizawa_scene) return engine.default_aizawa_scene();
            console.warn("phasewasm missing default_aizawa_scene; using Lorenz scene instead");
            return engine.default_lorenz_scene();
          case "thomas":
          default:
            if (engine.default_thomas_scene) return engine.default_thomas_scene();
            console.warn("phasewasm missing default_thomas_scene; using Lorenz scene instead");
            return engine.default_lorenz_scene();
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
