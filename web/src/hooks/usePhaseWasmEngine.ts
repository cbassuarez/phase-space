import { useEffect, useMemo, useState } from "react";
import { getDefaultSceneJSON } from "../data/defaultScenes";
import type { SceneSpec, SystemId, Trajectories } from "../types";
import { sceneForRust } from "../utils/sceneBridge";

export interface AttractorExprError {
  message: string;
  pos: number;
}
export interface AttractorValidation {
  ok: boolean;
  errors: {
    dx: AttractorExprError | null;
    dy: AttractorExprError | null;
    dz: AttractorExprError | null;
  };
}

type WasmEngineClass = new () => {
  integrate_scene: (sceneJson: string) => Trajectories;
  integrate_scene_value: (scene: unknown) => Trajectories;
  validate_attractor: (input: string) => unknown;
};

interface PhaseWasmApi {
  WasmEngine: WasmEngineClass;
  default: () => Promise<unknown>;
}

type EngineInstance = {
  integrate_scene_value: (scene: unknown) => Trajectories;
  validate_attractor: (input: string) => unknown;
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
          integrate_scene_value: wasmEngine.integrate_scene_value.bind(wasmEngine),
          validate_attractor: wasmEngine.validate_attractor.bind(wasmEngine),
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
        return getDefaultSceneJSON(system);
      },
      integrateScene: (sceneJson: string): { trajectories: Trajectories; scene: SceneSpec } => {
        const scene = JSON.parse(sceneJson) as SceneSpec;
        const trajectories = engine.integrate_scene_value(sceneForRust(scene)) as Trajectories;
        return { trajectories, scene };
      },
      // Validate user-defined attractor equations. Input is
      // `{ equations: { dx, dy, dz }, params: { name: value } }`.
      validateAttractor: (input: string): AttractorValidation => {
        return engine.validate_attractor(input) as AttractorValidation;
      },
    };
  }, [engine]);

  return { ready, error, api } as const;
}
