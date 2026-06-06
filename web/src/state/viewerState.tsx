import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePhaseWasmEngine, type AttractorValidation } from "../hooks/usePhaseWasmEngine";
import { useTheme } from "./themeState";
import type { CameraProgram } from "../camera/types";
import { createDefaultCameraProgram, migrateCameraProgram } from "../camera/migrate";
import { getDefaultSceneSpec } from "../data/defaultScenes";
import {
  blankAttractor,
  buildCustomScene,
  validationInput,
  loadUserAttractors,
  upsertUserAttractor,
  deleteUserAttractor,
  decodeFromHash,
  type AttractorDef,
} from "../data/customAttractors";
import { fetchCommunityAttractors } from "../data/communityPacks";
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
  LineWeight,
  CellShape,
  CellSize,
  MaterialStyle,
  MaterialTransmission,
  RenderStyle,
  CausticsSettings,
} from "../types";
import {
  mapLegacyPalette,
  mapLegacyRenderStyle,
  materialStyleToTransmission,
  materialTransmissionToStyle,
  filamentDensityToValue,
  filamentDensityValueToPreset,
  normalizeFilamentDensityValue,
  normalizeViewSpec,
} from "../types";
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
  /** Active user-defined attractor (overrides `system` when non-null). */
  activeCustom: AttractorDef | null;
  /** Saved custom-attractor library (localStorage). */
  customAttractors: AttractorDef[];
  /** Community attractor packs fetched at runtime as install candidates. */
  communityAttractors: AttractorDef[];
  /** Select / live-preview a custom attractor (pass the in-progress def). */
  setCustomAttractor: (def: AttractorDef) => void;
  /** Return to the built-in `system`. */
  clearCustomAttractor: () => void;
  /** Persist a custom attractor to the library (and make it active). */
  saveCustomAttractor: (def: AttractorDef) => void;
  /** Install a reviewed community attractor into the local library. */
  installCommunityAttractor: (def: AttractorDef) => void;
  /** Remove a saved custom attractor. */
  deleteCustomAttractor: (id: string) => void;
  /** Validate equations against the live engine (same parser the integrator uses). */
  validateAttractor: (def: AttractorDef, paramValues?: Record<string, number>) => AttractorValidation | null;
  /** The attractor currently open in the editor modal (null = closed). */
  editingAttractor: AttractorDef | null;
  /** Open the editor (with a def to edit, or blank for a new one). */
  openAttractorEditor: (def?: AttractorDef) => void;
  closeAttractorEditor: () => void;
  resolution: Resolution;
  autoSpin: boolean;
  clampFps60: boolean;
  returnToHome: boolean;
  drawTrace: boolean;
  traceSpeed: number;
  traceDecay: number;
  lineThickness: LineThickness;
  lineWeight: LineWeight;
  cellShape: CellShape;
  cellSize: CellSize;
  cloudDensity: number;
  ribbonWidth: number;
  attractorOpacity: number;
  materialStyle: MaterialStyle;
  materialTransmission: MaterialTransmission;
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
  toggleClampFps60: () => void;
  toggleReturnToHome: () => void;
  toggleDrawTrace: () => void;
  setTraceSpeed: (v: number) => void;
  setTraceDecay: (v: number) => void;
  setLineWeight: (v: LineWeight) => void;
  setLineThickness: (t: LineThickness) => void;
  setCellShape: (s: CellShape) => void;
  setCellSize: (v: CellSize) => void;
  setCloudDensity: (v: number) => void;
  setRibbonWidth: (v: number) => void;
  setAttractorOpacity: (v: number) => void;
  setMaterialTransmission: (v: MaterialTransmission) => void;
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

const builtinSystemIds: SystemId[] = ["lorenz", "rossler", "aizawa", "thomas", "chua"];

function normalizeSystemId(value: string | null): SystemId | null {
  return builtinSystemIds.includes(value as SystemId) ? (value as SystemId) : null;
}

function initialSystemFromLocation(): SystemId {
  if (typeof window === "undefined") return "lorenz";
  const params = new URLSearchParams(window.location.search);
  return normalizeSystemId(params.get("system")) ?? "lorenz";
}

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

function lineThicknessToWeight(thickness: LineThickness): LineWeight {
  if (thickness === "thin") return 0;
  if (thickness === "thick") return 2;
  return 1;
}

function lineWeightToThickness(value: LineWeight): LineThickness {
  if (value < 0.5) return "thin";
  if (value > 1.5) return "thick";
  return "default";
}

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const { ready: engineReady, error: engineError, api } = usePhaseWasmEngine();
  const initialSystemRef = useRef<SystemId>(initialSystemFromLocation());
  const [system, setSystemState] = useState<SystemId>(initialSystemRef.current);
  const systemRef = useRef<SystemId>(initialSystemRef.current);
  const [resolution, setResolutionState] = useState<Resolution>("default");
  const [autoSpin, setAutoSpin] = useState(true);
  const [clampFps60, setClampFps60] = useState(true);
  const [returnToHome, setReturnToHome] = useState(true);
  const [drawTrace, setDrawTrace] = useState(false);
  const [traceSpeed, setTraceSpeed] = useState(0.04);
  const [traceDecay, setTraceDecay] = useState(0.5);
  const [lineThickness, setLineThicknessState] = useState<LineThickness>("default");
  const [lineWeight, setLineWeightState] = useState<LineWeight>(1);
  const [cellShape, setCellShape] = useState<CellShape>("square");
  const [cellSize, setCellSizeState] = useState<CellSize>(1);
  const [cloudDensity, setCloudDensity] = useState(1);
  const [ribbonWidth, setRibbonWidth] = useState(1);
  const [attractorOpacity, setAttractorOpacity] = useState(1);
  const [materialStyle, setMaterialStyleState] = useState<MaterialStyle>("glass");
  const [materialTransmission, setMaterialTransmissionState] = useState<MaterialTransmission>(0.5);
  const [renderStyle, setRenderStyleState] = useState<RenderStyle>("line");
  // Once the user picks a render style or material transmission it is theirs to keep: a later
  // system (or any other) selection must not silently reset it back to the
  // scene's default. Mirror the palette-lock pattern. Track the current value
  // alongside the lock so a locked scene reload reflects the user's choice in
  // the exported scene spec, not the per-system default.
  const renderStyleLockedRef = useRef(false);
  const renderStyleRef = useRef<RenderStyle>("line");
  useEffect(() => { renderStyleRef.current = renderStyle; }, [renderStyle]);
  const materialTransmissionLockedRef = useRef(false);
  const materialTransmissionRef = useRef<MaterialTransmission>(0.5);
  useEffect(() => { materialTransmissionRef.current = materialTransmission; }, [materialTransmission]);
  const [photonWeaveSettings, setPhotonWeaveSettingsState] =
    useState<PhotonWeaveSettings>({
      brightness: 0.1,
      trailLength: 1.1,
      filamentDensity: "medium",
      filamentDensityValue: filamentDensityToValue("medium"),
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
  // The viewer background is the global site theme — one light/dim switch in
  // the top bar drives both the UI chrome and the canvas.
  const { theme: background, setTheme } = useTheme();
  const [sceneJson, setSceneJson] = useState("{}");
  const [sceneSpec, setSceneSpec] = useState<SceneSpec | null>(null);
  const [cameraProgram, setCameraProgramState] = useState<CameraProgram | null>(null);
  const cameraProgramRef = useRef<CameraProgram | null>(null);
  const lastLoadedSystemRef = useRef<string | null>(null);
  // User-defined attractors: the active one (overrides `system` when set) and
  // the saved localStorage library.
  const [activeCustom, setActiveCustomState] = useState<AttractorDef | null>(null);
  const activeCustomRef = useRef<AttractorDef | null>(null);
  const [customAttractors, setCustomAttractors] = useState<AttractorDef[]>([]);
  const [communityAttractors, setCommunityAttractors] = useState<AttractorDef[]>([]);
  const [editingAttractor, setEditingAttractor] = useState<AttractorDef | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectories>([]);
  const [trajectoryMeta, setTrajectoryMeta] = useState<TrajectoryMeta>({ count: 0, points: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderStillHandler, setRenderStillHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReduced.matches) {
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
    activeCustomRef.current = activeCustom;
  }, [activeCustom]);

  // Load the saved custom-attractor library; honour a ?#attractor=… share link;
  // fetch the reviewed community pack index as install candidates.
  useEffect(() => {
    setCustomAttractors(loadUserAttractors());
    const shared = decodeFromHash(typeof window !== "undefined" ? window.location.hash : "");
    if (shared) setActiveCustomState(shared);
    fetchCommunityAttractors().then(setCommunityAttractors).catch(() => undefined);
  }, []);

  useEffect(() => {
    systemRef.current = system;
  }, [system]);

  const loadScene = useCallback(
    (nextSystem: SystemId, res: Resolution) => {
      if (!api) return;
      setLoading(true);
      try {
        // A user-defined attractor (when active) overrides the built-in system.
        // It carries its own integrator settings, so it skips the resolution
        // remap; editing the same custom keeps the camera (key includes its id).
        const activeC = activeCustomRef.current;
        const loadKey = activeC ? `custom:${activeC.id}` : nextSystem;
        const baseScene = activeC
          ? JSON.stringify(buildCustomScene(activeC))
          : api.getDefaultScene(nextSystem);
        const tunedScene = activeC ? baseScene : applyResolution(baseScene, res);
        const { trajectories: traj, scene } = api.integrateScene(tunedScene);
        const normalizedView = normalizeViewSpec(scene.view);
        const systemChanged = lastLoadedSystemRef.current !== loadKey;
        const nextCameraProgram = systemChanged
          ? resetCameraParameterGroups(cameraProgramRef.current)
          : cloneCameraProgram(cameraProgramRef.current ?? createDefaultCameraProgram());
        // Honor user-locked render/material controls over the scene default so
        // the rendered view *and* the exported scene stay on the chosen values.
        const effectiveRenderStyle = renderStyleLockedRef.current
          ? renderStyleRef.current
          : mapLegacyRenderStyle(normalizedView.render_style ?? "line");
        const effectiveMaterialTransmission = materialTransmissionLockedRef.current
          ? materialTransmissionRef.current
          : normalizedView.material_transmission ?? 0.5;
        const effectiveMaterialStyle = materialTransmissionToStyle(effectiveMaterialTransmission);
        normalizedView.render_style = mapLegacyRenderStyle(effectiveRenderStyle);
        normalizedView.material_style = effectiveMaterialStyle;
        normalizedView.material_transmission = effectiveMaterialTransmission;
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
        setRenderStyleState(effectiveRenderStyle);
        setMaterialStyleState(effectiveMaterialStyle);
        setMaterialTransmissionState(effectiveMaterialTransmission);
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
        lastLoadedSystemRef.current = loadKey;
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
  }, [engineReady, api, system, resolution, activeCustom, loadScene]);

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
    // Choosing a built-in system leaves any active custom attractor.
    setActiveCustomState(null);
    if (systemRef.current !== nextSystem || activeCustomRef.current) {
      setCameraProgramState((prev) => resetCameraParameterGroups(prev));
    }
    setSystemState(nextSystem);
  }, []);

  const setRenderStyle = useCallback(
    (style: RenderStyle) => {
      renderStyleLockedRef.current = true;
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

  const setLineWeight = useCallback((value: LineWeight) => {
    const nextWeight = Math.max(0, Math.min(2, value));
    setLineWeightState(nextWeight);
    setLineThicknessState(lineWeightToThickness(nextWeight));
  }, []);

  const setLineThickness = useCallback((thickness: LineThickness) => {
    setLineWeight(lineThicknessToWeight(thickness));
  }, [setLineWeight]);

  const setCellSize = useCallback((value: CellSize) => {
    setCellSizeState(Math.max(0.35, Math.min(3.4, value)));
  }, []);

  const setMaterialTransmission = useCallback(
    (value: MaterialTransmission) => {
      const nextTransmission = Math.max(0, Math.min(1, value));
      const nextStyle = materialTransmissionToStyle(nextTransmission);
      materialTransmissionLockedRef.current = true;
      materialTransmissionRef.current = nextTransmission;
      setMaterialTransmissionState(nextTransmission);
      setMaterialStyleState(nextStyle);
      setSceneSpec((prev) => {
        if (!prev) return prev;
        const updatedView = normalizeViewSpec(prev.view);
        const nextScene = {
          ...prev,
          view: {
            ...updatedView,
            material_style: nextStyle,
            material_transmission: nextTransmission,
          },
        } as SceneSpec;
        setSceneJson(JSON.stringify(nextScene, null, 2));
        return nextScene;
      });
    },
    [setSceneJson]
  );

  const setMaterialStyle = useCallback(
    (style: MaterialStyle) => {
      setMaterialTransmission(materialStyleToTransmission(style));
    },
    [setMaterialTransmission]
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
    setPhotonWeaveSettingsState((prev) => {
      const next = { ...prev, ...updates } as PhotonWeaveSettings;
      if (updates.filamentDensityValue != null) {
        next.filamentDensityValue = normalizeFilamentDensityValue(updates.filamentDensityValue, prev.filamentDensity);
        next.filamentDensity = filamentDensityValueToPreset(next.filamentDensityValue);
      } else if (updates.filamentDensity != null) {
        next.filamentDensity = updates.filamentDensity;
        next.filamentDensityValue = filamentDensityToValue(updates.filamentDensity);
      }
      return next;
    });
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
    activeCustom,
    customAttractors,
    communityAttractors,
    editingAttractor,
    resolution,
    autoSpin,
    clampFps60,
    returnToHome,
    drawTrace,
    traceSpeed,
    traceDecay,
    lineThickness,
    lineWeight,
    cellShape,
    cellSize,
    cloudDensity,
    ribbonWidth,
    attractorOpacity,
    materialStyle,
    materialTransmission,
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
    setCustomAttractor: (def: AttractorDef) => setActiveCustomState(def),
    clearCustomAttractor: () => setActiveCustomState(null),
    saveCustomAttractor: (def: AttractorDef) => {
      setCustomAttractors(upsertUserAttractor(def));
      setActiveCustomState(def);
    },
    installCommunityAttractor: (def: AttractorDef) => {
      const installed = { ...def, source: "local" as const };
      setCustomAttractors(upsertUserAttractor(installed));
      setActiveCustomState(installed);
    },
    deleteCustomAttractor: (id: string) => {
      setCustomAttractors(deleteUserAttractor(id));
      setActiveCustomState((cur) => (cur && cur.id === id ? null : cur));
    },
    validateAttractor: (def: AttractorDef, paramValues?: Record<string, number>) =>
      api ? api.validateAttractor(validationInput(def, paramValues)) : null,
    openAttractorEditor: (def?: AttractorDef) => setEditingAttractor(def ?? blankAttractor()),
    closeAttractorEditor: () => setEditingAttractor(null),
    setResolution: setResolutionState,
    toggleAutoSpin: () => setAutoSpin((v) => !v),
    toggleClampFps60: () => setClampFps60((v) => !v),
    toggleReturnToHome: () => setReturnToHome((v) => !v),
    toggleDrawTrace: () => setDrawTrace((v) => !v),
    setTraceSpeed,
    setTraceDecay,
    setLineWeight,
    setLineThickness,
    setCellShape,
    setCellSize,
    setCloudDensity,
    setRibbonWidth,
    setAttractorOpacity,
    setMaterialTransmission,
    setMaterialStyle,
    setRenderStyle,
    setPhotonWeaveSettings,
    setCausticsSettings,
    setPalette,
    setCustomPalette,
    setBackground: (b: Background) => setTheme(b === "light" ? "light" : "dim"),
    setCameraProgram,
    requestRenderStill,
    setRenderStillHandler,
    refreshScene,
  }), [
    api,
    engineReady,
    loading,
    error,
    system,
    activeCustom,
    customAttractors,
    communityAttractors,
    editingAttractor,
    resolution,
    autoSpin,
    clampFps60,
    returnToHome,
    drawTrace,
    traceSpeed,
    traceDecay,
    lineThickness,
    lineWeight,
    cellShape,
    cellSize,
    cloudDensity,
    ribbonWidth,
    attractorOpacity,
    materialStyle,
    materialTransmission,
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
    setLineWeight,
    setLineThickness,
    setCellSize,
    setMaterialTransmission,
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
