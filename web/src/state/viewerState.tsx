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
import { DEFAULT_PALETTE, DEFAULT_RENDER_STYLE, mapLegacyPalette, mapLegacyRenderStyle, normalizeViewSpec } from "../types";
import { CustomPaletteState, loadCustomPalette, saveCustomPalette } from "../palettes";

const VIEWER_PREFS_STORAGE_KEY = "phase-viewer";
const VIEWER_PREFS_VERSION = 2;

interface ViewerPrefs {
  version: number;
  renderStyle: RenderStyle;
  palette: Palette;
}

const initialViewerPrefs: ViewerPrefs = {
  version: VIEWER_PREFS_VERSION,
  renderStyle: DEFAULT_RENDER_STYLE,
  palette: DEFAULT_PALETTE,
};

function migrateViewerPrefs(persisted: unknown): ViewerPrefs {
  if (!persisted || typeof persisted !== "object") {
    return initialViewerPrefs;
  }

  const raw = persisted as Partial<ViewerPrefs> & { version?: number };
  const prevVersion = typeof raw.version === "number" ? raw.version : 0;

  let next: ViewerPrefs = {
    ...initialViewerPrefs,
    ...raw,
  } as ViewerPrefs;

  if (prevVersion < VIEWER_PREFS_VERSION) {
    if (next.renderStyle === "photon-weave" || next.renderStyle == null) {
      next = { ...next, renderStyle: DEFAULT_RENDER_STYLE };
    }

    if (next.palette === "plasma" || next.palette == null) {
      next = { ...next, palette: DEFAULT_PALETTE };
    }

    next = { ...next, version: VIEWER_PREFS_VERSION };
  }

  return next;
}

function loadViewerPrefs(): ViewerPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VIEWER_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateViewerPrefs(parsed);
  } catch (err) {
    console.warn("Failed to load viewer prefs", err);
    return null;
  }
}

function persistViewerPrefs(prefs: ViewerPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEWER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("Failed to save viewer prefs", err);
  }
}

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
  setCustomPalette: (updates: Partial<CustomPaletteState>) => void;
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
  const initialPrefs = useMemo(() => (typeof window === "undefined" ? null : loadViewerPrefs()), []);
  const [system, setSystemState] = useState<SystemId>("lorenz");
  const [resolution, setResolutionState] = useState<Resolution>("default");
  const [autoSpin, setAutoSpin] = useState(true);
  const [animateHeadTail, setAnimateHeadTail] = useState(true);
  const [showFullTrajectory, setShowFullTrajectory] = useState(true);
  const [lineThickness, setLineThickness] = useState<LineThickness>("default");
  const [renderStyle, setRenderStyleState] = useState<RenderStyle>(
    initialPrefs?.renderStyle ?? DEFAULT_RENDER_STYLE
  );
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
  const [palette, setPaletteState] = useState<Palette>(initialPrefs?.palette ?? DEFAULT_PALETTE);
  const [paletteLocked, setPaletteLocked] = useState(
    initialPrefs ? initialPrefs.palette !== DEFAULT_PALETTE : false
  );
  const [customPalette, setCustomPaletteState] = useState<CustomPaletteState>(loadCustomPalette());
  const [background, setBackgroundState] = useState<Background>("light");
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStillHandler, setRenderStillHandler] = useState<(() => void) | null>(null);
  const [hasPersistedPrefs] = useState(() => Boolean(initialPrefs));

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

  useEffect(() => {
    persistViewerPrefs({
      version: VIEWER_PREFS_VERSION,
      renderStyle,
      palette,
    });
  }, [palette, renderStyle]);

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
        const normalizedStyle = normalizedView.render_style ?? DEFAULT_RENDER_STYLE;
        const effectiveRenderStyle =
          hasPersistedPrefs && normalizedStyle === DEFAULT_RENDER_STYLE
            ? renderStyle
            : normalizedStyle;
        const sceneWithEffectiveStyle = {
          ...normalizedScene,
          view: { ...normalizedScene.view, render_style: effectiveRenderStyle },
        } as SceneSpec;
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
        setSceneJson(JSON.stringify({ ...sceneWithEffectiveStyle }, null, 2));
        setSceneSpec(sceneWithEffectiveStyle);
        if (!hasPersistedPrefs || normalizedStyle !== DEFAULT_RENDER_STYLE) {
          setRenderStyleState(normalizedStyle);
        }
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
    [api, customPalette, hasPersistedPrefs, paletteLocked, renderStyle]
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
    setCustomPalette,
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
    photonWeaveSettings,
    causticsSettings,
    palette,
    customPalette,
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
    setCustomPalette,
    setPalette,
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
