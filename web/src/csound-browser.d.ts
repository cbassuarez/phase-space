declare module "@csound/browser/dist/csound.js" {
  export interface CsoundObj {
    compileCSD: (csd: string, mode?: number) => Promise<number>;
    getNode: () => Promise<AudioNode | undefined>;
    on: (eventName: string, listener: (...args: unknown[]) => void) => unknown;
    perform: () => Promise<number>;
    setControlChannel: (channelName: string, value: number) => Promise<undefined>;
    start: () => Promise<number>;
    stop: () => Promise<undefined>;
    cleanup: () => Promise<number>;
    terminateInstance: () => Promise<void>;
  }

  export function Csound(params?: {
    audioContext?: AudioContext | OfflineAudioContext;
    inputChannelCount?: number;
    outputChannelCount?: number;
    autoConnect?: boolean;
    withPlugins?: object[];
    useWorker?: boolean;
    useSAB?: boolean;
  }): Promise<CsoundObj | undefined>;

  export default Csound;
}
