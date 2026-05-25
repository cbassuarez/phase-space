import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioIO, type AudioFeatureFrame } from "../audio/audioFeatures";
import { InternalSynth } from "../audio/internalSynth";
import { ModulationEngine, type TargetPath, type TargetRegistry } from "../modulation/modEngine";
import type { ModBus, ModBusRuntimeState } from "../modulation/types";
import type { ChannelMode } from "../hooks/useAudioDevices";
import { useAudioDevicesContext } from "./audioDevicesState";

interface ModValues {
  camera: { r: number | null; theta: number | null; phi: number | null; pulse: number };
  paletteShift: number;
  backgroundBrightness: number;
  renderEnergy: number;
  renderPulse: number;
  lineWidthScale: number | null;
  cellSizeScale: number | null;
  photonWeaveBrightness: number | null;
  photonWeaveTrail: number | null;
  emissiveBoost: number | null;
  ribbonWidth: number | null;
  ribbonGlow: number | null;
  cloudDensity: number | null;
  causticsIntensity: number | null;
  causticsBlur: number | null;
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
  micLevel: number;
  channelCount: number;
  outputChannelCount: number;
  channelMode: ChannelMode;
  setChannelMode: (mode: ChannelMode) => void;
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
  const setCameraPulse = (v: number) => {
    valuesRef.current.camera.pulse = clamp01(v);
  };
  const setPaletteShift = (v: number) => {
    valuesRef.current.paletteShift = clamp01(v);
  };
  const setBackgroundBrightness = (v: number) => {
    valuesRef.current.backgroundBrightness = clamp01(v);
  };
  const setActiveEnergy = (v: number) => {
    valuesRef.current.renderEnergy = clamp01(v);
  };
  const setActivePulse = (v: number) => {
    valuesRef.current.renderPulse = clamp01(v);
  };
  const setLineWidth = (v: number) => {
    valuesRef.current.lineWidthScale = Math.max(0.35, Math.min(3.2, v));
  };
  const setCellSize = (v: number) => {
    valuesRef.current.cellSizeScale = Math.max(0.35, Math.min(3.4, v));
  };
  const setPhotonWeaveBrightness = (v: number) => {
    const clamped = Math.max(0.05, Math.min(3.5, v));
    valuesRef.current.photonWeaveBrightness = clamped;
    valuesRef.current.emissiveBoost = clamped;
  };
  const setPhotonWeaveTrail = (v: number) => {
    valuesRef.current.photonWeaveTrail = Math.max(0.35, Math.min(2.8, v));
  };
  const setRibbonWidth = (v: number) => {
    valuesRef.current.ribbonWidth = Math.max(0.3, Math.min(2.8, v));
  };
  const setRibbonGlow = (v: number) => {
    valuesRef.current.ribbonGlow = Math.max(0, Math.min(3.5, v));
  };
  const setCloudDensity = (v: number) => {
    valuesRef.current.cloudDensity = Math.max(0, Math.min(1.6, v));
  };
  const setCausticsIntensity = (v: number) => {
    valuesRef.current.causticsIntensity = Math.max(0.05, Math.min(3.5, v));
  };
  const setCausticsBlur = (v: number) => {
    valuesRef.current.causticsBlur = Math.max(0.08, Math.min(1.8, v));
  };

  const setVoicePitch = (v: number) => synth.setVoicePitch(0, clamp01(v));
  const setVoicePan = (v: number) => synth.setVoicePan(0, clamp01(v));
  const setVoiceBrightness = (v: number) => synth.setVoiceBrightness(0, clamp01(v));
  const setMasterGain = (v: number) => synth.setMasterGain(clamp01(v));

  const map: Partial<Record<TargetPath, (val: number) => void>> = {
    "view.camera.r": setCameraR,
    "view.camera.theta": setCameraTheta,
    "view.camera.phi": setCameraPhi,
    "view.camera.pulse": setCameraPulse,
    "view.palette_shift": setPaletteShift,
    "view.background_brightness": setBackgroundBrightness,
    "render.active.energy": setActiveEnergy,
    "render.active.pulse": setActivePulse,
    "render.line.width": setLineWidth,
    "render.cells.size": setCellSize,
    "render.photonWeave.brightness": setPhotonWeaveBrightness,
    "render.photonWeave.trail": setPhotonWeaveTrail,
    "render.ribbon.width": setRibbonWidth,
    "render.ribbon.glow": setRibbonGlow,
    "render.cloud.density": setCloudDensity,
    "render.caustics.intensity": setCausticsIntensity,
    "render.caustics.blur": setCausticsBlur,
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
  const audioDevices = useAudioDevicesContext();
  const {
    selectedInputId,
    selectedOutputId,
    channelMode,
    hasPermission,
    requestPermission,
    setInputDevice,
    setChannelMode,
    setOutputDevice,
    supportsSetSinkId,
    setInputFallbackMessage,
    setOutputFallbackMessage,
  } = audioDevices;
  const [modEngine, setModEngine] = useState<ModulationEngine | null>(null);
  const [buses, setBuses] = useState<ModBusRuntimeState[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [channelCount, setChannelCount] = useState(2);
  const [outputChannelCount, setOutputChannelCount] = useState(2);
  const audioIO = useMemo(() => new AudioIO(), []);
  const synth = useMemo(() => new InternalSynth(audioIO.getContext() ?? undefined), [audioIO]);
  const [monitorDestination, setMonitorDestination] = useState<MediaStreamAudioDestinationNode | null>(null);
  const monitorAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeInputRef = useRef<string | null>(null);
  const audioFrameRef = useRef<AudioFeatureFrame | null>(null);
  const modValuesRef = useRef<ModValues>({
    camera: { r: null, theta: null, phi: null, pulse: 0 },
    paletteShift: 0,
    backgroundBrightness: 0,
    renderEnergy: 0,
    renderPulse: 0,
    lineWidthScale: null,
    cellSizeScale: null,
    photonWeaveBrightness: null,
    photonWeaveTrail: null,
    emissiveBoost: null,
    ribbonWidth: null,
    ribbonGlow: null,
    cloudDensity: null,
    causticsIntensity: null,
    causticsBlur: null,
  });

  useEffect(() => {
    const unsub = audioIO.subscribe((frame) => {
      audioFrameRef.current = frame;
    });
    return () => unsub();
  }, [audioIO]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setMicLevel(audioIO.getLastLevel());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [audioIO]);

  useEffect(() => {
    synth.setMasterGain(0.15);
  }, [synth]);

  useEffect(() => {
    const ctx = synth.getContext();
    const destination = ctx.createMediaStreamDestination();
    synth.connectMonitorDestination(destination);
    setMonitorDestination(destination);
    const dest = synth.getContext().destination;
    const reportedCount = dest.maxChannelCount || dest.channelCount || dest.numberOfOutputs || 2;
    setOutputChannelCount(Math.max(1, Math.min(8, reportedCount)));
  }, [synth]);

  useEffect(() => {
    const audioEl = monitorAudioRef.current;
    if (!audioEl || !monitorDestination) return;
    audioEl.srcObject = monitorDestination.stream;
    audioEl.play().catch(() => undefined);
  }, [monitorDestination]);

  const registry = useMemo(() => createTargetRegistry(modValuesRef, synth), [modValuesRef, synth]);

  useEffect(() => {
    ModulationEngine.load(registry).then((engine) => {
      setModEngine(engine);
      setBuses(engine?.getBuses() ?? []);
    });
  }, [registry]);

  useEffect(() => () => {
    audioIO.stop();
  }, [audioIO]);

  const updateBuses = (updater: (buses: ModBus[]) => ModBus[]) => {
    if (!modEngine) return;
    modEngine.updateBusConfig(updater);
    setBuses(modEngine.getBuses());
  };

  const startMicWithDevice = useCallback(
    async (deviceId: string) => {
      try {
        const count = await audioIO.startMic(synth.getContext(), deviceId, channelMode);
        setChannelCount(count);
        activeInputRef.current = deviceId;
        if (synth.getContext().state === "suspended") {
          await synth.getContext().resume();
        }
        setMicEnabled(true);
      } catch (err) {
        console.warn("Failed to start mic", err);
        setMicEnabled(false);
        setChannelCount(2);
        setInputFallbackMessage("Audio input failed; using default input.");
        if (deviceId !== "default") {
          await setInputDevice("default");
        }
      }
    },
    [audioIO, channelMode, setInputDevice, setInputFallbackMessage, synth]
  );

  const toggleMic = async () => {
    if (micEnabled) {
      await audioIO.stop();
      setMicEnabled(false);
      setMicLevel(0);
      activeInputRef.current = null;
      return;
    }
    if (!hasPermission) {
      await requestPermission();
    }
    if (!audioDevices.hasPermission) {
      setMicEnabled(false);
      return;
    }
    await startMicWithDevice(selectedInputId);
  };

  useEffect(() => {
    if (!micEnabled) return;
    if (activeInputRef.current === selectedInputId) return;
    startMicWithDevice(selectedInputId);
  }, [micEnabled, selectedInputId, startMicWithDevice]);

  useEffect(() => {
    if (!micEnabled) return;
    audioIO.updateChannelMode(channelMode);
  }, [audioIO, channelMode, micEnabled]);

  useEffect(() => {
    const applySink = async () => {
      if (!supportsSetSinkId) return;
      const audioEl = monitorAudioRef.current;
      if (!audioEl || !monitorDestination) return;
      try {
        await (audioEl as any).setSinkId(selectedOutputId);
        setOutputFallbackMessage(null);
      } catch (err) {
        console.warn("Failed to set output device", err);
        setOutputFallbackMessage("Output device not available; using system default.");
        await setOutputDevice("default");
      }
    };
    applySink();
  }, [monitorDestination, selectedOutputId, setOutputDevice, setOutputFallbackMessage, supportsSetSinkId]);

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
    micLevel,
    channelCount,
    outputChannelCount,
    channelMode,
    setChannelMode,
  };

  return (
    <ModulationContext.Provider value={value}>
      {children}
      <audio ref={monitorAudioRef} className="hidden" autoPlay />
    </ModulationContext.Provider>
  );
}

export function useModulation() {
  const ctx = useContext(ModulationContext);
  if (!ctx) throw new Error("useModulation must be used within ModulationProvider");
  return ctx;
}
