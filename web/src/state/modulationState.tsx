import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AudioIO, type AudioFeatureFrame } from "../audio/audioFeatures";
import { InternalSynth } from "../audio/internalSynth";
import { ModulationEngine, type TargetPath, type TargetRegistry } from "../modulation/modEngine";
import type { ModBus, ModBusRuntimeState } from "../modulation/types";

interface ModValues {
  camera: { r: number | null; theta: number | null; phi: number | null };
  paletteShift: number;
  backgroundBrightness: number;
  neonEmissive: number | null;
  ribbonWidth: number | null;
  cloudDensity: number | null;
  crtScanDepth: number | null;
}

interface ModulationContextValue {
  modEngine: ModulationEngine | null;
  buses: ModBusRuntimeState[];
  updateBuses: (updater: (buses: ModBus[]) => ModBus[]) => void;
  audioIO: AudioIO;
  audioFrameRef: React.MutableRefObject<AudioFeatureFrame | null>;
  modValuesRef: React.MutableRefObject<ModValues>;
  synth: InternalSynth;
  micEnabled: boolean;
  toggleMic: () => Promise<void>;
}

const ModulationContext = createContext<ModulationContextValue | null>(null);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const createTargetRegistry = (
  valuesRef: React.MutableRefObject<ModValues>,
  synth: InternalSynth
): TargetRegistry => {
  const setCameraR = (v: number) => {
    valuesRef.current.camera.r = Math.max(4, Math.min(120, v));
  };
  const setCameraTheta = (v: number) => {
    const wrapped = ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    valuesRef.current.camera.theta = wrapped;
  };
  const setCameraPhi = (v: number) => {
    const clamped = Math.max(0.05, Math.min(Math.PI - 0.05, v));
    valuesRef.current.camera.phi = clamped;
  };
  const setPaletteShift = (v: number) => {
    valuesRef.current.paletteShift = clamp01(v);
  };
  const setBackgroundBrightness = (v: number) => {
    valuesRef.current.backgroundBrightness = clamp01(v);
  };
  const setNeonEmissive = (v: number) => {
    valuesRef.current.neonEmissive = Math.max(0.05, Math.min(3.5, v));
  };
  const setRibbonWidth = (v: number) => {
    valuesRef.current.ribbonWidth = Math.max(0.3, Math.min(2.8, v));
  };
  const setCloudDensity = (v: number) => {
    valuesRef.current.cloudDensity = clamp01(v);
  };
  const setCrtScanDepth = (v: number) => {
    valuesRef.current.crtScanDepth = clamp01(v);
  };

  const setVoicePitch = (v: number) => synth.setVoicePitch(0, clamp01(v));
  const setVoicePan = (v: number) => synth.setVoicePan(0, clamp01(v));
  const setVoiceBrightness = (v: number) => synth.setVoiceBrightness(0, clamp01(v));
  const setMasterGain = (v: number) => synth.setMasterGain(clamp01(v));

  const map: Partial<Record<TargetPath, (val: number) => void>> = {
    "view.camera.r": setCameraR,
    "view.camera.theta": setCameraTheta,
    "view.camera.phi": setCameraPhi,
    "view.palette_shift": setPaletteShift,
    "view.background_brightness": setBackgroundBrightness,
    "render.neon.emissiveIntensity": setNeonEmissive,
    "render.ribbon.width": setRibbonWidth,
    "render.cloud.density": setCloudDensity,
    "render.crt.scanlineDepth": setCrtScanDepth,
    "audio.voice_0.pitch": setVoicePitch,
    "audio.voice_0.pan": setVoicePan,
    "audio.voice_0.brightness": setVoiceBrightness,
    "audio.master.gain": setMasterGain,
  };

  return {
    getSetter(path: TargetPath) {
      return map[path];
    },
  };
};

export function ModulationProvider({ children }: { children: React.ReactNode }) {
  const [modEngine, setModEngine] = useState<ModulationEngine | null>(null);
  const [buses, setBuses] = useState<ModBusRuntimeState[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const audioIO = useMemo(() => new AudioIO(), []);
  const synth = useMemo(() => new InternalSynth(audioIO.getContext() ?? undefined), [audioIO]);
  const audioFrameRef = useRef<AudioFeatureFrame | null>(null);
  const modValuesRef = useRef<ModValues>({
    camera: { r: null, theta: null, phi: null },
    paletteShift: 0,
    backgroundBrightness: 0,
    neonEmissive: null,
    ribbonWidth: null,
    cloudDensity: null,
    crtScanDepth: null,
  });

  useEffect(() => {
    const unsub = audioIO.subscribe((frame) => {
      audioFrameRef.current = frame;
    });
    return () => unsub();
  }, [audioIO]);

  useEffect(() => {
    synth.setMasterGain(0.15);
  }, [synth]);

  const registry = useMemo(() => createTargetRegistry(modValuesRef, synth), [modValuesRef, synth]);

  useEffect(() => {
    ModulationEngine.load(registry).then((engine) => {
      setModEngine(engine);
      setBuses(engine?.getBuses() ?? []);
    });
  }, [registry]);

  const updateBuses = (updater: (buses: ModBus[]) => ModBus[]) => {
    if (!modEngine) return;
    modEngine.updateBusConfig(updater);
    setBuses(modEngine.getBuses());
  };

  const toggleMic = async () => {
    if (micEnabled) {
      audioIO.stop();
      setMicEnabled(false);
      return;
    }
    try {
      await audioIO.startMic(synth.getContext());
      if (synth.getContext().state === "suspended") {
        await synth.getContext().resume();
      }
      setMicEnabled(true);
    } catch (err) {
      console.warn("Failed to start mic", err);
      setMicEnabled(false);
    }
  };

  const value: ModulationContextValue = {
    modEngine,
    buses,
    updateBuses,
    audioIO,
    audioFrameRef,
    modValuesRef,
    synth,
    micEnabled,
    toggleMic,
  };

  return <ModulationContext.Provider value={value}>{children}</ModulationContext.Provider>;
}

export function useModulation() {
  const ctx = useContext(ModulationContext);
  if (!ctx) throw new Error("useModulation must be used within ModulationProvider");
  return ctx;
}
