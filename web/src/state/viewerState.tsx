import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { usePhaseWasmEngine } from "../hooks/usePhaseWasmEngine";
import type { CameraProgram } from "../camera/types";
import { getDefaultSceneSpec } from "../data/defaultScenes";
import type {
  Background,
  IntegratorSpec,
  Palette,
  Resolution,
  SceneSpec,
  SystemId,
  Trajectories,
  LineThickness,
  RenderStyle,
} from "../types";
import { normalizeViewSpec } from "../types";

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
  renderStyle: RenderStyle;
  palette: Palette;
  background: Background;
  sceneJson: string;
  sceneSpec: SceneSpec | null;
  cameraProgram: CameraProgram | null;
  trajectories: Trajectories;
  trajectoryMeta: TrajectoryMeta;
  setSystem: (s: SystemId) => void;
  setResolution: (r: Resolution) => void;
  toggleAutoSpin: () => void;
  toggleAnimateHeadTail: () => void;
  toggleShowFullTrajectory: () => void;
  setLineThickness: (t: LineThickness) => void;
  setRenderStyle: (s: RenderStyle) => void;
  setPalette: (p: Palette) => void;
  setBackground: (b: Background) => void;
  setCameraProgram: (updater: (c: CameraProgram) => CameraProgram) => void;
  requestRenderStill: () => void;
  setRenderStillHandler: (handler: (() => void) | null) => void;
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
  const [renderStyle, setRenderStyleState] = useState<RenderStyle>("neon-filaments");
  const [palette, setPaletteState] = useState<Palette>("system");
  const [background, setBackgroundState] = useState<Background>("light");
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStillHandler, setRenderStillHandler] = useState<(() => void) | null>(null);

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
        const normalizedView = normalizeViewSpec(scene.view);
        const normalizedScene = { ...scene, view: normalizedView } as SceneSpec;
        setSceneJson(JSON.stringify({ ...normalizedScene }, null, 2));
        setSceneSpec(normalizedScene);
        setRenderStyleState(normalizedView.render_style ?? "neon-filaments");
        const fallbackCamera =
          (scene.camera as CameraProgram | undefined) ??
          (getDefaultSceneSpec(nextSystem).camera as CameraProgram | undefined) ??
          null;
        setCameraProgramState(fallbackCamera ? JSON.parse(JSON.stringify(fallbackCamera)) : null);
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

  const setCameraProgram = useCallback(
    (updater: (c: CameraProgram) => CameraProgram) => {
      setCameraProgramState((prev) => {
        const base =
          prev ??
          (sceneSpec?.camera as CameraProgram | undefined) ??
          (sceneSpec?.system
            ? (getDefaultSceneSpec(sceneSpec.system as SystemId).camera as CameraProgram | undefined)
            : undefined) ??
          (getDefaultSceneSpec(system).camera as CameraProgram | undefined) ??
          null;

        if (!base) return prev;
        const next = updater(JSON.parse(JSON.stringify(base)) as CameraProgram);
        setSceneSpec((prevSpec) => {
          if (!prevSpec) return prevSpec;
          const updated = { ...prevSpec, camera: next } as SceneSpec;
          setSceneJson(JSON.stringify(updated, null, 2));
          return updated;
        });
        return next;
      });
    },
    [sceneSpec, system]
  );

  const refreshScene = useCallback(() => loadScene(system, resolution), [loadScene, system, resolution]);

  const setRenderStyle = useCallback(
    (style: RenderStyle) => {
      setRenderStyleState(style);
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = { ...prev, view: { ...updatedView, render_style: style } } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson]
  );

  const requestRenderStill = useCallback(() => {
    if (renderStillHandler) {
      renderStillHandler();
    }
  }, [renderStillHandler]);

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
    renderStyle,
    palette,
    background,
    sceneJson,
    sceneSpec,
    cameraProgram,
    trajectories,
    trajectoryMeta,
    setSystem: setSystemState,
    setResolution: setResolutionState,
    toggleAutoSpin: () => setAutoSpin((v) => !v),
    toggleAnimateHeadTail: () => setAnimateHeadTail((v) => !v),
    toggleShowFullTrajectory: () => setShowFullTrajectory((v) => !v),
    setLineThickness,
    setRenderStyle,
    setPalette: setPaletteState,
    setBackground: setBackgroundState,
    setCameraProgram,
    requestRenderStill,
    setRenderStillHandler,
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
    renderStyle,
    palette,
    background,
    sceneJson,
    sceneSpec,
    cameraProgram,
    trajectories,
    trajectoryMeta,
    setCameraProgram,
    setRenderStyle,
    requestRenderStill,
    setRenderStillHandler,
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
