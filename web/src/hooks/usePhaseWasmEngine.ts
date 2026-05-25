import { useEffect, useMemo, useState } from "react";
import { getDefaultSceneJSON } from "../data/defaultScenes";
import type { SceneSpec, SystemId, Trajectories } from "../types";

type WasmEngineClass = new () => {
  integrate_scene: (sceneJson: string) => Trajectories;
  integrate_scene_value: (scene: unknown) => Trajectories;
};

interface PhaseWasmApi {
  WasmEngine: WasmEngineClass;
  default: () => Promise<unknown>;
}

const wasmRenderStyleMap: Record<string, string> = {
  line: "path-trace",
  cells: "volumetric-cloud",
  "photon-weave": "neon-filaments",
  caustics: "crt-scope",
  ribbon: "ribbon",
  "volumetric-cloud": "volumetric-cloud",
};

function sceneForWasm(scene: SceneSpec): Record<string, unknown> {
  const wasmScene = JSON.parse(JSON.stringify(scene)) as Record<string, unknown>;
  delete wasmScene.camera;
  const view = wasmScene.view as Record<string, unknown> | undefined;
  if (view) {
    const renderStyle = view.render_style;
    if (renderStyle) {
      view.render_style = wasmRenderStyleMap[String(renderStyle)];
    }
    if (view.background === "dim") {
      view.background = "dark";
    }
  }
  return wasmScene;
}

type EngineInstance = {
  integrate_scene_value: (scene: unknown) => Trajectories;
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
        const trajectories = engine.integrate_scene_value(sceneForWasm(scene)) as Trajectories;
        return { trajectories, scene };
      },
    };
  }, [engine]);

  return { ready, error, api } as const;
}
