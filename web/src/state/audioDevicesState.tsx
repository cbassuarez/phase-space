import React, { createContext, useContext } from "react";
import useAudioDevices, { type UseAudioDevicesResult } from "../hooks/useAudioDevices";

const AudioDevicesContext = createContext<UseAudioDevicesResult | null>(null);

export function AudioDevicesProvider({ children }: { children: React.ReactNode }) {
  const audioDevices = useAudioDevices();
  return <AudioDevicesContext.Provider value={audioDevices}>{children}</AudioDevicesContext.Provider>;
}

export function useAudioDevicesContext() {
  const ctx = useContext(AudioDevicesContext);
  if (!ctx) throw new Error("useAudioDevicesContext must be used within AudioDevicesProvider");
  return ctx;
}
