import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { usePhaseWasmEngine } from "../hooks/usePhaseWasmEngine";
import type { CameraProgram } from "../camera/types";
import { getDefaultSceneSpec } from "../data/defaultScenes";
import type {
  Background,
  IntegratorSpec,
  Palette,
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
import {
  type CustomPaletteBank,
  type CustomPaletteId,
  type CustomPaletteState,
  defaultCustomPaletteBank,
  loadCustomPaletteBank,
  persistCustomPaletteBank,
  type PaletteSpec,
} from "../palettes";

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
  customPalettes: CustomPaletteBank;
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
  setPhotonWeaveSettings: (updates: Partial<PhotonWeaveSettings>) => void;
  setCausticsSettings: (updates: Partial<CausticsSettings>) => void;
  setPalette: (p: Palette) => void;
  updateCustomPalette: (id: CustomPaletteId, updates: Partial<CustomPaletteBank[CustomPaletteId]>) => void;
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

const renderStylePaletteDefaults: Record<RenderStyle, Palette> = {
  "photon-weave": "abyss",
  "volumetric-cloud": "viridis",
  caustics: "solar",
  ribbon: "prism",
  cells: "plasma",
};

type PaletteOrigin = "scene" | "style-default" | "user";

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

function paletteSpecToCustomState(paletteId: CustomPaletteId, spec: PaletteSpec | null | undefined) {
  if (!spec || !spec.stops || spec.stops.length === 0) return null;
  const ordered = [...spec.stops].sort((a, b) => a.t - b.t);
  const low = ordered[0]?.color;
  const high = ordered[ordered.length - 1]?.color;
  const mid = ordered.reduce((closest, stop) => {
    const currentDelta = Math.abs((closest?.t ?? 0.5) - 0.5);
    const nextDelta = Math.abs(stop.t - 0.5);
    return nextDelta < currentDelta ? stop : closest;
  }, ordered[0]).color;

  if (!low || !mid || !high) return null;

  return {
    id: paletteId,
    low,
    mid,
    high,
  };
}

function paletteSpecFromCustomState(state: CustomPaletteState): PaletteSpec {
  return {
    stops: [
      { t: 0, color: state.low },
      { t: 0.5, color: state.mid },
      { t: 1, color: state.high },
    ],
  };
}

function applyPaletteSpec(view: ViewSpec, palette: Palette, bank: CustomPaletteBank): ViewSpec {
  if (palette.startsWith("custom")) {
    const custom = bank[palette as CustomPaletteId];
    if (custom) {
      return { ...view, palette, palette_spec: paletteSpecFromCustomState(custom) };
    }
  }
  return { ...view, palette, palette_spec: null };
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
  const [paletteState, setPaletteState] = useState<{ id: Palette; origin: PaletteOrigin }>(
    () => ({ id: renderStylePaletteDefaults["photon-weave"], origin: "style-default" })
  );
  const [customPalettes, setCustomPalettes] = useState<CustomPaletteBank>(() => loadCustomPaletteBank());
  const [background, setBackgroundState] = useState<Background>("dark");
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStillHandler, setRenderStillHandler] = useState<(() => void) | null>(null);
  const palette = paletteState.id;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReduced.matches) {
      setAnimateHeadTail(false);
      setAutoSpin(false);
    }
  }, []);

  useEffect(() => {
    persistCustomPaletteBank(customPalettes);
  }, [customPalettes]);

  useEffect(() => {
    if (!engineError) return;
    setError(engineError);
  }, [engineError]);

  const seedCustomPaletteFromSpec = useCallback(
    (paletteId: Palette, spec?: PaletteSpec | null) => {
      if (!paletteId.startsWith("custom")) return;
      const customId = paletteId as CustomPaletteId;
      const mapped = paletteSpecToCustomState(customId, spec);
      if (!mapped) return;
      setCustomPalettes((prev) => ({
        ...prev,
        [customId]: {
          ...(prev[customId] ?? defaultCustomPaletteBank[customId]),
          ...mapped,
        },
      }));
    },
    []
  );

  const updateCustomPalette = useCallback(
    (id: CustomPaletteId, updates: Partial<CustomPaletteBank[CustomPaletteId]>) => {
      setCustomPalettes((prev) => {
        const nextState = {
          ...prev,
          [id]: { ...(prev[id] ?? defaultCustomPaletteBank[id]), ...updates, id },
        } as CustomPaletteBank;
        if (paletteState.id === id) {
          setSceneSpec((prevScene) => {
            if (!prevScene) return prevScene;
            const updatedView = normalizeViewSpec(prevScene.view);
            const nextScene = {
              ...prevScene,
              view: applyPaletteSpec(updatedView, paletteState.id, nextState),
            } as SceneSpec;
            setSceneJson(JSON.stringify(nextScene, null, 2));
            return nextScene;
          });
        }
        return nextState;
      });
    },
    [paletteState.id, setSceneJson]
  );

  const loadScene = useCallback(
    (nextSystem: SystemId, res: Resolution) => {
      if (!api) return;
      setLoading(true);
      try {
        const baseScene = api.getDefaultScene(nextSystem);
        const tunedScene = applyResolution(baseScene, res);
        const { trajectories: traj, scene } = api.integrateScene(tunedScene);
        const normalizedView = normalizeViewSpec(scene.view);
        const renderStyle = normalizedView.render_style ?? "photon-weave";
        const paletteFromView = normalizedView.palette ? mapLegacyPalette(normalizedView.palette) : undefined;
        const resolvedPalette = paletteFromView ?? renderStylePaletteDefaults[renderStyle];
        const viewWithPalette = { ...normalizedView, palette: resolvedPalette };
        const normalizedScene = { ...scene, view: viewWithPalette } as SceneSpec;
        setSceneJson(JSON.stringify({ ...normalizedScene }, null, 2));
        setSceneSpec(normalizedScene);
        setRenderStyleState(renderStyle);
        setPaletteState({ id: resolvedPalette, origin: normalizedView.palette ? "scene" : "style-default" });
        setBackgroundState(viewWithPalette.background ?? "dark");
        seedCustomPaletteFromSpec(resolvedPalette, normalizedView.palette_spec ?? null);
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
    [api, seedCustomPaletteFromSpec]
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
      const paletteForStyle =
        paletteState.origin === "user" ? paletteState.id : renderStylePaletteDefaults[style];
      if (paletteState.origin !== "user") {
        setPaletteState({ id: paletteForStyle, origin: "style-default" });
      }
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = {
          ...prev,
          view: applyPaletteSpec(
            { ...updatedView, render_style: mapLegacyRenderStyle(style) },
            paletteForStyle,
            customPalettes
          ),
        } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson, paletteState, customPalettes]
  );

  const setPhotonWeaveSettings = useCallback((updates: Partial<PhotonWeaveSettings>) => {
    setPhotonWeaveSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setCausticsSettings = useCallback((updates: Partial<CausticsSettings>) => {
    setCausticsSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setPalette = useCallback(
    (p: Palette) => {
      setPaletteState({ id: p, origin: "user" });
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = { ...prev, view: applyPaletteSpec(updatedView, p, customPalettes) } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson, customPalettes]
  );

  const setBackground = useCallback(
    (b: Background) => {
      setBackgroundState(b);
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = { ...prev, view: { ...updatedView, background: b } } as SceneSpec;
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
    photonWeaveSettings,
    causticsSettings,
    palette,
    customPalettes,
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
    setPhotonWeaveSettings,
    setCausticsSettings,
    setPalette,
    updateCustomPalette,
    setBackground,
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
    customPalettes,
    background,
    sceneJson,
    sceneSpec,
    cameraProgram,
    trajectories,
    trajectoryMeta,
    setCameraProgram,
    setRenderStyle,
    setPhotonWeaveSettings,
    setCausticsSettings,
    setPalette,
    updateCustomPalette,
    setBackground,
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
