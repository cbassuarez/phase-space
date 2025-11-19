import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { usePhaseWasmEngine } from "../hooks/usePhaseWasmEngine";
import type {
  Background,
  IntegratorSpec,
  Palette,
  Resolution,
  SceneSpec,
  SystemId,
  Trajectories,
  LineThickness,
} from "../types";

interface TrajectoryMeta {
  count: number;
  points: number;
}

interface ViewerContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  system: SystemId;
  resolution: Resolution;
  autoSpin: boolean;
  animateHeadTail: boolean;
  showFullTrajectory: boolean;
  lineThickness: LineThickness;
  palette: Palette;
  background: Background;
  sceneJson: string;
  sceneSpec: SceneSpec | null;
  trajectories: Trajectories;
  trajectoryMeta: TrajectoryMeta;
  setSystem: (s: SystemId) => void;
  setResolution: (r: Resolution) => void;
  toggleAutoSpin: () => void;
  toggleAnimateHeadTail: () => void;
  toggleShowFullTrajectory: () => void;
  setLineThickness: (t: LineThickness) => void;
  setPalette: (p: Palette) => void;
  setBackground: (b: Background) => void;
  refreshScene: () => void;
}

const ViewerContext = createContext<ViewerContextValue | undefined>(undefined);

const resolutionPresets: Record<Resolution, IntegratorSpec> = {
  fast: { dt: 0.012, steps: 1400, discard_initial: 180 },
  default: { dt: 0.009, steps: 2200, discard_initial: 260 },
  high: { dt: 0.007, steps: 3200, discard_initial: 360 },
  ultra: { dt: 0.0055, steps: 4200, discard_initial: 420 },
};

function applyResolution(sceneJson: string, resolution: Resolution): string {
  try {
    const spec = JSON.parse(sceneJson) as SceneSpec;
    spec.integrator = { ...(spec.integrator ?? {}), ...resolutionPresets[resolution] };
    return JSON.stringify(spec, null, 2);
  } catch (err) {
    console.error("Failed to parse scene json", err);
    return sceneJson;
  }
}

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const { ready: engineReady, error: engineError, api } = usePhaseWasmEngine();
  const [system, setSystemState] = useState<SystemId>("lorenz");
  const [resolution, setResolutionState] = useState<Resolution>("default");
  const [autoSpin, setAutoSpin] = useState(true);
  const [animateHeadTail, setAnimateHeadTail] = useState(true);
  const [showFullTrajectory, setShowFullTrajectory] = useState(true);
  const [lineThickness, setLineThickness] = useState<LineThickness>("default");
  const [palette, setPaletteState] = useState<Palette>("system");
  const [background, setBackgroundState] = useState<Background>("light");
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReduced.matches) {
      setAnimateHeadTail(false);
      setAutoSpin(false);
    }
  }, []);

  useEffect(() => {
    if (!engineError) return;
    setError(engineError);
  }, [engineError]);

  const loadScene = useCallback(
    (nextSystem: SystemId, res: Resolution) => {
      if (!api) return;
    setLoading(true);
    try {
      const baseScene = api.getDefaultScene(nextSystem);
      const tunedScene = applyResolution(baseScene, res);
      const { trajectories: traj, scene } = api.integrateScene(tunedScene);
      setSceneJson(tunedScene);
      setSceneSpec(scene);
      setTrajectories(traj);
      const meta = traj.reduce(
        (acc, t) => {
          acc.count += 1;
          acc.points += Array.isArray(t) ? t.length : 0;
          return acc;
        },
        { count: 0, points: 0 }
      );
      setTrajectoryMeta(meta);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
    },
    [api]
  );

  useEffect(() => {
    if (!engineReady || !api) return;
    loadScene(system, resolution);
  }, [engineReady, api, system, resolution, loadScene]);

  const refreshScene = useCallback(() => loadScene(system, resolution), [loadScene, system, resolution]);

  const value = useMemo<ViewerContextValue>(() => ({
    ready: engineReady,
    loading,
    error,
    system,
    resolution,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    palette,
    background,
    sceneJson,
    sceneSpec,
    trajectories,
    trajectoryMeta,
    setSystem: setSystemState,
    setResolution: setResolutionState,
    toggleAutoSpin: () => setAutoSpin((v) => !v),
    toggleAnimateHeadTail: () => setAnimateHeadTail((v) => !v),
    toggleShowFullTrajectory: () => setShowFullTrajectory((v) => !v),
    setLineThickness,
    setPalette: setPaletteState,
    setBackground: setBackgroundState,
    refreshScene,
  }), [
    engineReady,
    loading,
    error,
    system,
    resolution,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    palette,
    background,
    sceneJson,
    sceneSpec,
    trajectories,
    trajectoryMeta,
    refreshScene,
  ]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerState() {
  const ctx = useContext(ViewerContext);
  if (!ctx) {
    throw new Error("useViewerState must be used within ViewerProvider");
  }
  return ctx;
}
