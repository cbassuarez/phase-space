import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { usePhaseWasmEngine } from "../hooks/usePhaseWasmEngine";
import type { CameraProgram } from "../camera/types";
import { getDefaultSceneSpec } from "../data/defaultScenes";
import type {
  Background,
  Palette,
  IntegratorSpec,
  PhotonWeaveSettings,
  Resolution,
  SceneSpec,
  SystemId,
  Trajectories,
  LineThickness,
  RenderStyle,
  CausticsSettings,
} from "../types";
import { mapLegacyPalette, mapLegacyRenderStyle, normalizeViewSpec } from "../types";
import { CustomPaletteState, loadCustomPalette, saveCustomPalette } from "../palettes";
import { CustomBackgrounds, DEFAULT_CUSTOM_BACKGROUNDS } from "../theme/backgroundModes";

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
  photonWeaveSettings: PhotonWeaveSettings;
  causticsSettings: CausticsSettings;
  palette: Palette;
  customPalette: CustomPaletteState;
  background: Background;
  customBackgrounds: CustomBackgrounds;
  sceneJson: string;
  sceneSpec: SceneSpec | null;
  cameraProgram: CameraProgram | null;
  trajectories: Trajectories;
  trajectoryMeta: TrajectoryMeta;
  fps: number;
  setSystem: (s: SystemId) => void;
  setResolution: (r: Resolution) => void;
  toggleAutoSpin: () => void;
  toggleAnimateHeadTail: () => void;
  toggleShowFullTrajectory: () => void;
  setLineThickness: (t: LineThickness) => void;
  setRenderStyle: (s: RenderStyle) => void;
  setPhotonWeaveSettings: (updates: Partial<PhotonWeaveSettings>) => void;
  setCausticsSettings: (updates: Partial<CausticsSettings>) => void;
  setPalette: (p: Palette) => void;
  setCustomPalette: (updates: Partial<CustomPaletteState>) => void;
  setBackground: (b: Background) => void;
  setCustomBackgrounds: (updates: Partial<CustomBackgrounds>) => void;
  setFps: (fps: number) => void;
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
  const [renderStyle, setRenderStyleState] = useState<RenderStyle>("photon-weave");
  const [photonWeaveSettings, setPhotonWeaveSettingsState] =
    useState<PhotonWeaveSettings>({
      brightness: 1,
      trailLength: 1.1,
      filamentDensity: "medium",
      shimmer: true,
    });
  const [causticsSettings, setCausticsSettingsState] = useState<CausticsSettings>({
    blurRadius: 0.35,
    intensity: 1.1,
    projectionAxis: "auto",
    colorMode: "global",
  });
  const [palette, setPaletteState] = useState<Palette>("plasma");
  const [paletteLocked, setPaletteLocked] = useState(false);
  const [customPalette, setCustomPaletteState] = useState<CustomPaletteState>(loadCustomPalette());
  const [background, setBackgroundState] = useState<Background>("light");
  const [customBackgrounds, setCustomBackgroundsState] = useState<CustomBackgrounds>(DEFAULT_CUSTOM_BACKGROUNDS);
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStillHandler, setRenderStillHandler] = useState<(() => void) | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMode = window.localStorage.getItem("ps:bg:mode") as Background | null;
    const savedCustom = window.localStorage.getItem("ps:bg:customs");

    if (savedMode) {
      setBackgroundState(savedMode);
    }

    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom) as Partial<CustomBackgrounds>;
        setCustomBackgroundsState((prev) => ({ ...prev, ...parsed }));
      } catch (err) {
        console.warn("Failed to parse custom background colors", err);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ps:bg:mode", background);
    window.localStorage.setItem("ps:bg:customs", JSON.stringify(customBackgrounds));
  }, [background, customBackgrounds]);

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
        if (
          normalizedView.palette === "custom" &&
          normalizedView.palette_spec?.stops &&
          normalizedView.palette_spec.stops.length > 0
        ) {
          const sortedStops = [...(normalizedView.palette_spec.stops ?? [])].sort(
            (a, b) => (a.t ?? 0) - (b.t ?? 0)
          );
          const low = sortedStops[0]?.color ?? customPalette.low ?? "#000000";
          const mid = sortedStops[Math.floor(sortedStops.length / 2)]?.color ?? customPalette.mid ?? low;
          const high = sortedStops[sortedStops.length - 1]?.color ?? customPalette.high ?? mid;
          setCustomPaletteState((prev) => {
            const next = { ...prev, low, mid, high } as CustomPaletteState;
            saveCustomPalette(next);
            return next;
          });
        }
        setSceneJson(JSON.stringify({ ...normalizedScene }, null, 2));
        setSceneSpec(normalizedScene);
        const normalizedStyle = normalizedView.render_style ?? "photon-weave";
        setRenderStyleState(normalizedStyle);
        if (!paletteLocked && scene.view?.palette) {
          setPaletteState(mapLegacyPalette(scene.view.palette));
        }
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
    [api, customPalette, paletteLocked]
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
        const nextScene = {
          ...prev,
          view: { ...updatedView, render_style: mapLegacyRenderStyle(style) },
        } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson]
  );

  const setPalette = useCallback(
    (next: Palette) => {
      setPaletteLocked(true);
      setPaletteState(next);
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = { ...prev, view: { ...updatedView, palette: next } } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson]
  );

  const setPhotonWeaveSettings = useCallback((updates: Partial<PhotonWeaveSettings>) => {
    setPhotonWeaveSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setCausticsSettings = useCallback((updates: Partial<CausticsSettings>) => {
    setCausticsSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setCustomPalette = useCallback((updates: Partial<CustomPaletteState>) => {
    setCustomPaletteState((prev) => {
      const next = { ...prev, ...updates } as CustomPaletteState;
      saveCustomPalette(next);
      return next;
    });
  }, []);

  const setCustomBackgrounds = useCallback((updates: Partial<CustomBackgrounds>) => {
    setCustomBackgroundsState((prev) => ({ ...prev, ...updates }));
  }, []);

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
    photonWeaveSettings,
    causticsSettings,
    palette,
    customPalette,
    background,
    customBackgrounds,
    sceneJson,
    sceneSpec,
    cameraProgram,
    trajectories,
    trajectoryMeta,
    fps,
    setSystem: setSystemState,
    setResolution: setResolutionState,
    toggleAutoSpin: () => setAutoSpin((v) => !v),
    toggleAnimateHeadTail: () => setAnimateHeadTail((v) => !v),
    toggleShowFullTrajectory: () => setShowFullTrajectory((v) => !v),
    setLineThickness,
    setRenderStyle,
    setPhotonWeaveSettings,
    setCausticsSettings,
    setPalette,
    setCustomPalette,
    setBackground: setBackgroundState,
    setCustomBackgrounds,
    setFps,
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
    photonWeaveSettings,
    causticsSettings,
    palette,
    customPalette,
    background,
    customBackgrounds,
    sceneJson,
    sceneSpec,
    cameraProgram,
    trajectories,
    trajectoryMeta,
    fps,
    setCameraProgram,
    setRenderStyle,
    setPhotonWeaveSettings,
    setCausticsSettings,
    setCustomPalette,
    setCustomBackgrounds,
    setPalette,
    setFps,
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
