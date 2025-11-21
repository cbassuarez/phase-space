import { useCallback, useEffect, useMemo, useState } from "react";

export type AudioDeviceKind = "input" | "output";

export interface AudioDevice {
  id: string;
  label: string;
  kind: AudioDeviceKind;
  channelCount?: number;
}

export type ChannelMode =
  | "stereo-1-2"
  | {
      type: "mono";
      channel: number;
    };

const INPUT_KEY = "phaseSpace.audio.inputDeviceId";
const OUTPUT_KEY = "phaseSpace.audio.outputDeviceId";
const CHANNEL_MODE_KEY = "phaseSpace.audio.channelMode";

export interface AudioDevicesState {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  selectedInputId: string;
  selectedOutputId: string;
  channelMode: ChannelMode;
  hasPermission: boolean;
  supportsSetSinkId: boolean;
  isEnumerating: boolean;
  errorMessage: string | null;
  inputFallbackMessage: string | null;
  outputFallbackMessage: string | null;
}

export interface UseAudioDevicesResult extends AudioDevicesState {
  requestPermission: () => Promise<void>;
  setInputDevice: (id: string) => Promise<void>;
  setChannelMode: (mode: ChannelMode) => void;
  setOutputDevice: (id: string) => Promise<void>;
  clearErrorMessage: () => void;
  clearInputFallbackMessage: () => void;
  clearOutputFallbackMessage: () => void;
  setInputFallbackMessage: (msg: string | null) => void;
  setOutputFallbackMessage: (msg: string | null) => void;
}

function parseStoredChannelMode(raw: string | null): ChannelMode {
  if (!raw) return "stereo-1-2";
  try {
    const parsed = JSON.parse(raw);
    if (parsed === "stereo-1-2") return "stereo-1-2";
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.type === "mono" &&
      typeof parsed.channel === "number"
    ) {
      return { type: "mono", channel: parsed.channel };
    }
  } catch (err) {
    console.warn("Failed to parse stored channel mode", err);
  }
  return "stereo-1-2";
}

export function useAudioDevices(): UseAudioDevicesResult {
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>(() =>
    localStorage.getItem(INPUT_KEY) || "default"
  );
  const [selectedOutputId, setSelectedOutputId] = useState<string>(() =>
    localStorage.getItem(OUTPUT_KEY) || "default"
  );
  const [channelMode, setChannelModeState] = useState<ChannelMode>(() =>
    parseStoredChannelMode(localStorage.getItem(CHANNEL_MODE_KEY))
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [isEnumerating, setIsEnumerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputFallbackMessage, setInputFallbackMessage] = useState<string | null>(null);
  const [outputFallbackMessage, setOutputFallbackMessage] = useState<string | null>(null);

  const supportsSetSinkId = useMemo(
    () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    []
  );

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setIsEnumerating(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDevice[] = [];
      const outputs: AudioDevice[] = [];
      let labelsPresent = false;

      devices.forEach((device) => {
        if (device.kind === "audioinput") {
          labelsPresent = labelsPresent || !!device.label;
          inputs.push({
            id: device.deviceId,
            label: device.label || "Audio input",
            kind: "input",
          });
        } else if (device.kind === "audiooutput") {
          labelsPresent = labelsPresent || !!device.label;
          outputs.push({
            id: device.deviceId,
            label: device.label || "Audio output",
            kind: "output",
          });
        }
      });

      setHasPermission(labelsPresent);
      setInputs(inputs);
      setOutputs(outputs);

      if (selectedInputId !== "default" && !inputs.find((d) => d.id === selectedInputId)) {
        setSelectedInputId("default");
        localStorage.setItem(INPUT_KEY, "default");
        setInputFallbackMessage("Audio device not found; using default input.");
      }

      if (
        supportsSetSinkId &&
        selectedOutputId !== "default" &&
        !outputs.find((d) => d.id === selectedOutputId)
      ) {
        setSelectedOutputId("default");
        localStorage.setItem(OUTPUT_KEY, "default");
        setOutputFallbackMessage("Output device not available; using system default.");
      }
    } catch (err) {
      console.warn("Failed to enumerate audio devices", err);
    } finally {
      setIsEnumerating(false);
    }
  }, [selectedInputId, selectedOutputId, supportsSetSinkId]);

  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => {
    if (!navigator.mediaDevices) return undefined;
    const handleChange = () => enumerateDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleChange);
  }, [enumerateDevices]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      setErrorMessage(null);
      await enumerateDevices();
    } catch (err) {
      console.warn("Microphone permission request failed", err);
      setHasPermission(false);
      setErrorMessage("Microphone permission denied.");
    }
  }, [enumerateDevices]);

  const setInputDevice = useCallback(async (id: string) => {
    setSelectedInputId(id);
    localStorage.setItem(INPUT_KEY, id);
  }, []);

  const setChannelMode = useCallback((mode: ChannelMode) => {
    setChannelModeState(mode);
    localStorage.setItem(CHANNEL_MODE_KEY, JSON.stringify(mode));
  }, []);

  const setOutputDevice = useCallback(async (id: string) => {
    setSelectedOutputId(id);
    localStorage.setItem(OUTPUT_KEY, id);
  }, []);

  const clearErrorMessage = useCallback(() => setErrorMessage(null), []);
  const clearInputFallbackMessage = useCallback(() => setInputFallbackMessage(null), []);
  const clearOutputFallbackMessage = useCallback(() => setOutputFallbackMessage(null), []);

  return {
    inputs,
    outputs,
    selectedInputId,
    selectedOutputId,
    channelMode,
    hasPermission,
    supportsSetSinkId,
    isEnumerating,
    errorMessage,
    inputFallbackMessage,
    outputFallbackMessage,
    requestPermission,
    setInputDevice,
    setChannelMode,
    setOutputDevice,
    clearErrorMessage,
    clearInputFallbackMessage,
    clearOutputFallbackMessage,
    setInputFallbackMessage,
    setOutputFallbackMessage,
  };
}

export default useAudioDevices;
