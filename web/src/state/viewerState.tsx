import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePhaseWasmEngine } from "../hooks/usePhaseWasmEngine";
import type { CameraProgram } from "../camera/types";
import { createDefaultCameraProgram, migrateCameraProgram } from "../camera/migrate";
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
  MaterialStyle,
  RenderStyle,
  CausticsSettings,
} from "../types";
import { mapLegacyPalette, mapLegacyRenderStyle, normalizeViewSpec } from "../types";
import { CustomPaletteState, loadCustomPalette, saveCustomPalette } from "../palettes";

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
  materialStyle: MaterialStyle;
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
  setMaterialStyle: (s: MaterialStyle) => void;
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
    const preset = resolutionPresets[resolution];
    const sceneIntegrator = spec.integrator ?? {};
    // Resolution controls integration *precision* (dt). Each scene
    // owns its intended `steps` / `discard_initial` because total
    // simulation time is system-dependent — Thomas at low `b` needs
    // many timescales to walk the lattice, Lorenz settles into the
    // butterfly almost immediately. Fall back to preset values only
    // when the scene didn't supply them.
    spec.integrator = {
      ...sceneIntegrator,
      dt: preset.dt,
      steps: sceneIntegrator.steps ?? preset.steps,
      discard_initial: sceneIntegrator.discard_initial ?? preset.discard_initial,
    };
    return JSON.stringify(spec, null, 2);
  } catch (err) {
    console.error("Failed to parse scene json", err);
    return sceneJson;
  }
}

function cloneCameraProgram(program: CameraProgram): CameraProgram {
  return JSON.parse(JSON.stringify(program)) as CameraProgram;
}

function resetCameraParameterGroups(program: CameraProgram | null): CameraProgram {
  const defaults = createDefaultCameraProgram();
  const base = cloneCameraProgram(program ?? defaults);
  return {
    ...base,
    survey: { ...defaults.survey },
    orbit: { ...defaults.orbit },
    chase: { ...defaults.chase },
    lobe: { ...defaults.lobe },
  };
}

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const { ready: engineReady, error: engineError, api } = usePhaseWasmEngine();
  const [system, setSystemState] = useState<SystemId>("lorenz");
  const systemRef = useRef<SystemId>("lorenz");
  const [resolution, setResolutionState] = useState<Resolution>("default");
  const [autoSpin, setAutoSpin] = useState(true);
  const [animateHeadTail, setAnimateHeadTail] = useState(true);
  const [showFullTrajectory, setShowFullTrajectory] = useState(true);
  const [lineThickness, setLineThickness] = useState<LineThickness>("default");
  const [materialStyle, setMaterialStyleState] = useState<MaterialStyle>("glass");
  const [renderStyle, setRenderStyleState] = useState<RenderStyle>("line");
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
  const [palette, setPaletteState] = useState<Palette>("prism");
  const [paletteLocked, setPaletteLocked] = useState(false);
  const paletteLockedRef = useRef(false);
  useEffect(() => { paletteLockedRef.current = paletteLocked; }, [paletteLocked]);
  const [customPalette, setCustomPaletteState] = useState<CustomPaletteState>(loadCustomPalette());
  const [background, setBackgroundState] = useState<Background>("light");
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const cameraProgramRef = useRef<CameraProgram | null>(null);
  const lastLoadedSystemRef = useRef<SystemId | null>(null);
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

  useEffect(() => {
    cameraProgramRef.current = cameraProgram;
  }, [cameraProgram]);

  useEffect(() => {
    systemRef.current = system;
  }, [system]);

  const loadScene = useCallback(
    (nextSystem: SystemId, res: Resolution) => {
      if (!api) return;
      setLoading(true);
      try {
        const baseScene = api.getDefaultScene(nextSystem);
        const tunedScene = applyResolution(baseScene, res);
        const { trajectories: traj, scene } = api.integrateScene(tunedScene);
        const normalizedView = normalizeViewSpec(scene.view);
        const systemChanged = lastLoadedSystemRef.current !== nextSystem;
        const nextCameraProgram = systemChanged
          ? resetCameraParameterGroups(cameraProgramRef.current)
          : cloneCameraProgram(cameraProgramRef.current ?? createDefaultCameraProgram());
        const normalizedScene = { ...scene, view: normalizedView, camera: nextCameraProgram } as SceneSpec;
        if (
          normalizedView.palette === "custom" &&
          normalizedView.palette_spec?.stops &&
          normalizedView.palette_spec.stops.length > 0
        ) {
          const sortedStops = [...(normalizedView.palette_spec.stops ?? [])].sort(
            (a, b) => (a.t ?? 0) - (b.t ?? 0)
          );
          setCustomPaletteState((prev) => {
            const low = sortedStops[0]?.color ?? prev.low ?? "#000000";
            const mid = sortedStops[Math.floor(sortedStops.length / 2)]?.color ?? prev.mid ?? low;
            const high = sortedStops[sortedStops.length - 1]?.color ?? prev.high ?? mid;
            const next = { ...prev, low, mid, high } as CustomPaletteState;
            saveCustomPalette(next);
            return next;
          });
        }
        setSceneJson(JSON.stringify({ ...normalizedScene }, null, 2));
        setSceneSpec(normalizedScene);
        const normalizedStyle = normalizedView.render_style ?? "line";
        setRenderStyleState(normalizedStyle);
        setMaterialStyleState(normalizedView.material_style ?? "glass");
        if (!paletteLockedRef.current && scene.view?.palette) {
          setPaletteState(mapLegacyPalette(scene.view.palette));
        }
        setCameraProgramState(nextCameraProgram);
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
        lastLoadedSystemRef.current = nextSystem;
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
        const base: CameraProgram =
          prev ??
          migrateCameraProgram(
            sceneSpec?.camera ??
              (sceneSpec?.system
                ? getDefaultSceneSpec(sceneSpec.system as SystemId).camera
                : undefined) ??
              getDefaultSceneSpec(system).camera
          ) ??
          createDefaultCameraProgram();

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

  const setSystem = useCallback((nextSystem: SystemId) => {
    if (systemRef.current !== nextSystem) {
      setCameraProgramState((prev) => resetCameraParameterGroups(prev));
    }
    setSystemState(nextSystem);
  }, []);

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

  const setMaterialStyle = useCallback(
    (style: MaterialStyle) => {
      setMaterialStyleState(style);
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = {
          ...prev,
          view: { ...updatedView, material_style: style },
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
    materialStyle,
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
    setSystem,
    setResolution: setResolutionState,
    toggleAutoSpin: () => setAutoSpin((v) => !v),
    toggleAnimateHeadTail: () => setAnimateHeadTail((v) => !v),
    toggleShowFullTrajectory: () => setShowFullTrajectory((v) => !v),
    setLineThickness,
    setMaterialStyle,
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
    materialStyle,
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
    setSystem,
    setCameraProgram,
    setRenderStyle,
    setMaterialStyle,
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
