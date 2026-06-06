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
import { CsoundSynth, type CsoundSynthControl } from "../audio/csoundSynth";
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
  audioEnabled: boolean;
  audioNeedsInput: boolean;
  audioNeedsSynth: boolean;
  audioTrim: number;
  setAudioTrim: (trim: number) => void;
  synthEnabled: boolean;
  synthStarting: boolean;
  synthError: string | null;
  toggleAudio: () => Promise<void>;
  clearSynthError: () => void;
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
const isSynthTargetPath = (path: string) => path.startsWith("audio.synth.");
const isLegacyAudioTargetPath = (path: string) =>
  path.startsWith("audio.voice_0.") || path === "audio.master.gain";

function getAudioRouteNeeds(buses: ModBusRuntimeState[]) {
  let input = false;
  let synth = false;
  let legacy = false;
  buses.forEach(({ bus }) => {
    if (!bus.enabled) return;
    input = input || bus.source.domain === "audio";
    bus.targets.forEach((target) => {
      synth = synth || isSynthTargetPath(target.path);
      legacy = legacy || isLegacyAudioTargetPath(target.path);
    });
  });
  return { input, synth, legacy };
}

const createTargetRegistry = (
  valuesRef: React.MutableRefObject<ModValues>,
  synth: InternalSynth,
  csoundSynth: CsoundSynth
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
  const setSynthControl = (name: CsoundSynthControl) => (v: number) => {
    csoundSynth.setControl(name, clamp01(v));
  };
  const setLegacySynthControl =
    (name: CsoundSynthControl, layer: "drone" | "pluck" | "dust" | "bass" | "shimmer") => (v: number) => {
      const value = clamp01(v);
      csoundSynth.setControl(name, value);
      csoundSynth.setControl(layer, value);
    };
  const setSynthPreset = (preset: "drone" | "pluck" | "dust" | "bass" | "shimmer") => (v: number) => {
    const value = clamp01(v);
    switch (preset) {
      case "drone":
        csoundSynth.setControl("drone", value);
        csoundSynth.setControl("pitch", 0.28 + value * 0.52);
        csoundSynth.setControl("timbre", 0.22 + value * 0.58);
        csoundSynth.setControl("space", 0.58 + value * 0.36);
        break;
      case "pluck":
        csoundSynth.setControl("pluck", value);
        csoundSynth.setControl("motion", value * (0.18 + value * 0.78));
        csoundSynth.setControl("pulse", value * (0.38 + value * 0.62));
        csoundSynth.setControl("timbre", 0.48 + value * 0.42);
        break;
      case "dust":
        csoundSynth.setControl("dust", value);
        csoundSynth.setControl("texture", 0.25 + value * 0.75);
        csoundSynth.setControl("timbre", 0.18 + value * 0.62);
        csoundSynth.setControl("space", 0.24 + value * 0.6);
        break;
      case "bass":
        csoundSynth.setControl("bass", value);
        csoundSynth.setControl("pitch", 0.04 + value * 0.28);
        csoundSynth.setControl("motion", value * (0.12 + value * 0.72));
        csoundSynth.setControl("pulse", value * (0.35 + value * 0.5));
        break;
      case "shimmer":
        csoundSynth.setControl("shimmer", value);
        csoundSynth.setControl("pitch", 0.52 + value * 0.3);
        csoundSynth.setControl("timbre", 0.42 + value * 0.5);
        csoundSynth.setControl("space", 0.66 + value * 0.3);
        break;
    }
  };

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
    "audio.synth.drone": setSynthPreset("drone"),
    "audio.synth.pluck": setSynthPreset("pluck"),
    "audio.synth.dust": setSynthPreset("dust"),
    "audio.synth.bass": setSynthPreset("bass"),
    "audio.synth.shimmer": setSynthPreset("shimmer"),
    "audio.synth.pitch": setLegacySynthControl("pitch", "drone"),
    "audio.synth.timbre": setLegacySynthControl("timbre", "drone"),
    "audio.synth.motion": setLegacySynthControl("motion", "pluck"),
    "audio.synth.texture": setLegacySynthControl("texture", "dust"),
    "audio.synth.pulse": setLegacySynthControl("pulse", "bass"),
    "audio.synth.space": setLegacySynthControl("space", "shimmer"),
    "audio.synth.gain": setSynthControl("gain"),
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
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioTrim, setAudioTrimState] = useState(0.68);
  const [micEnabled, setMicEnabled] = useState(false);
  const [synthEnabled, setSynthEnabled] = useState(false);
  const [synthStarting, setSynthStarting] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [channelCount, setChannelCount] = useState(2);
  const [outputChannelCount, setOutputChannelCount] = useState(2);
  const audioIO = useMemo(() => new AudioIO(), []);
  const synth = useMemo(() => new InternalSynth(audioIO.getContext() ?? undefined), [audioIO]);
  const csoundSynth = useMemo(() => new CsoundSynth(synth.getContext()), [synth]);
  const audioRouteNeeds = useMemo(() => getAudioRouteNeeds(buses), [buses]);
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
    synth.setMasterGain(0);
  }, [synth]);

  const setAudioTrim = useCallback(
    (trim: number) => {
      const clamped = clamp01(trim);
      setAudioTrimState(clamped);
      csoundSynth.setControl("gain", clamped);
      if (audioRouteNeeds.legacy && audioEnabled) {
        synth.setMasterGain(clamped * 0.25);
      }
    },
    [audioEnabled, audioRouteNeeds.legacy, csoundSynth, synth]
  );

  useEffect(() => {
    const ctx = synth.getContext();
    const destination = ctx.createMediaStreamDestination();
    synth.connectMonitorDestination(destination);
    csoundSynth.connectMonitorDestination(destination);
    setMonitorDestination(destination);
    const dest = synth.getContext().destination;
    const reportedCount = dest.maxChannelCount || dest.channelCount || dest.numberOfOutputs || 2;
    setOutputChannelCount(Math.max(1, Math.min(8, reportedCount)));
  }, [csoundSynth, synth]);

  useEffect(() => {
    const audioEl = monitorAudioRef.current;
    if (!audioEl || !monitorDestination) return;
    audioEl.srcObject = monitorDestination.stream;
    audioEl.play().catch(() => undefined);
  }, [monitorDestination]);

  const ensureMonitorPlayback = useCallback(() => {
    const audioEl = monitorAudioRef.current;
    if (!audioEl) return;
    audioEl.play().catch(() => undefined);
  }, []);

  const registry = useMemo(
    () => createTargetRegistry(modValuesRef, synth, csoundSynth),
    [modValuesRef, synth, csoundSynth]
  );

  useEffect(() => {
    ModulationEngine.load(registry).then((engine) => {
      setModEngine(engine);
      setBuses(engine?.getBuses() ?? []);
    });
  }, [registry]);

  useEffect(() => () => {
    audioIO.stop();
    void csoundSynth.stop();
  }, [audioIO, csoundSynth]);

  const updateBuses = (updater: (buses: ModBus[]) => ModBus[]) => {
    if (!modEngine) return;
    modEngine.updateBusConfig(updater);
    const nextBuses = modEngine.getBuses();
    csoundSynth.resetRouteControls();
    modEngine.applyCurrentValues();
    const nextNeeds = getAudioRouteNeeds(nextBuses);
    const needsAudio = nextNeeds.input || nextNeeds.synth || nextNeeds.legacy;
    setBuses(nextBuses);
    setAudioEnabled(needsAudio);
    if (!needsAudio) {
      void Promise.allSettled([csoundSynth.stop(), audioIO.stop()]);
      synth.setMasterGain(0);
      setSynthEnabled(false);
      setMicEnabled(false);
      setMicLevel(0);
      activeInputRef.current = null;
    }
  };

  const stopMicInput = useCallback(async () => {
    await audioIO.stop();
    setMicEnabled(false);
    setMicLevel(0);
    activeInputRef.current = null;
  }, [audioIO]);

  const startMicWithDevice = useCallback(
    async (deviceId: string) => {
      try {
        const count = await audioIO.startMic(synth.getContext(), deviceId, channelMode);
        setChannelCount(count);
        activeInputRef.current = deviceId;
        if (synth.getContext().state === "suspended") {
          await synth.getContext().resume();
        }
        ensureMonitorPlayback();
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
    [audioIO, channelMode, ensureMonitorPlayback, setInputDevice, setInputFallbackMessage, synth]
  );

  const toggleMic = async () => {
    if (micEnabled) {
      await stopMicInput();
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

  const stopAllAudio = useCallback(async () => {
    await Promise.allSettled([csoundSynth.stop(), stopMicInput()]);
    synth.setMasterGain(0);
    setAudioEnabled(false);
    setSynthEnabled(false);
    setSynthError(null);
  }, [csoundSynth, stopMicInput, synth]);

  const startSynthOutput = useCallback(async () => {
    if (synthStarting || synthEnabled || csoundSynth.isRunning()) return;
    setSynthStarting(true);
    setSynthError(null);
    try {
      await csoundSynth.start();
      ensureMonitorPlayback();
      setSynthEnabled(true);
    } catch (err) {
      console.warn("Failed to start Synth", err);
      setSynthEnabled(false);
      setSynthError("Audio output failed to start.");
    } finally {
      setSynthStarting(false);
    }
  }, [csoundSynth, ensureMonitorPlayback, synthEnabled, synthStarting]);

  const applyAudioRouteState = useCallback(async () => {
    csoundSynth.setControl("gain", audioTrim);
    synth.setMasterGain(audioRouteNeeds.legacy ? audioTrim * 0.25 : 0);

    if (audioRouteNeeds.synth) {
      await startSynthOutput();
    } else if (synthEnabled || csoundSynth.isRunning()) {
      await csoundSynth.stop();
      setSynthEnabled(false);
      setSynthError(null);
    }

    if (audioRouteNeeds.input) {
      if (!micEnabled || activeInputRef.current !== selectedInputId) {
        if (!hasPermission) {
          await requestPermission();
        }
        await startMicWithDevice(selectedInputId);
      }
    } else if (micEnabled) {
      await stopMicInput();
    }
  }, [
    audioRouteNeeds.input,
    audioRouteNeeds.legacy,
    audioRouteNeeds.synth,
    audioTrim,
    csoundSynth,
    hasPermission,
    micEnabled,
    requestPermission,
    selectedInputId,
    startMicWithDevice,
    startSynthOutput,
    stopMicInput,
    synth,
    synthEnabled,
  ]);

  const toggleAudio = useCallback(async () => {
    if (synthStarting) return;
    if (audioEnabled) {
      await stopAllAudio();
      return;
    }
    setAudioEnabled(true);
    await applyAudioRouteState();
  }, [applyAudioRouteState, audioEnabled, stopAllAudio, synthStarting]);

  useEffect(() => {
    if (!audioEnabled) return;
    void applyAudioRouteState();
  }, [applyAudioRouteState, audioEnabled]);

  const clearSynthError = useCallback(() => {
    setSynthError(null);
  }, []);

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
    audioEnabled,
    audioNeedsInput: audioRouteNeeds.input,
    audioNeedsSynth: audioRouteNeeds.synth,
    audioTrim,
    setAudioTrim,
    synthEnabled,
    synthStarting,
    synthError,
    toggleAudio,
    clearSynthError,
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
