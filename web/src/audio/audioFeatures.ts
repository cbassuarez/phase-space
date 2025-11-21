import type { ChannelMode } from "../hooks/useAudioDevices";

export interface AudioFeatureFrame {
  level: number; // 0..1, RMS / loudness
  brightness: number; // 0..1, normalized spectral centroid
  low_band: number; // 0..1
  mid_band: number; // 0..1
  high_band: number; // 0..1
  onset: number; // 0 or 1 impulse
  pitch?: number; // 0..1 or undefined (v1 can omit pitch detection)
}

type AudioFeatureListener = (frame: AudioFeatureFrame) => void;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export class AudioIO {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private data: Uint8Array | null = null;
  private timeData: Float32Array | null = null;
  private listeners = new Set<AudioFeatureListener>();
  private running = false;
  private lastLevel = 0;
  private lastOnsetLevel = 0;
  private channelMode: ChannelMode = { type: "stereo", channels: [1, 2] };
  private channelCount = 2;
  private micStream: MediaStream | null = null;

  async startMic(
    context: AudioContext,
    deviceId: string,
    channelMode: ChannelMode
  ): Promise<number> {
    await this.stop();
    this.context = context;
    this.channelMode = channelMode;

    const constraints =
      deviceId === "default"
        ? { audio: true }
        : {
            audio: {
              deviceId: { exact: deviceId },
            },
          };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getAudioTracks()[0];
    const inferredChannelCount = track?.getSettings()?.channelCount;
    this.channelCount = clamp(inferredChannelCount ?? 2, 1, 8);

    const src = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;

    this.timeData = new Float32Array(analyser.fftSize);

    const splitter = context.createChannelSplitter(Math.max(2, this.channelCount));
    const merger = context.createChannelMerger(2);

    src.connect(splitter);
    this.applyChannelMode(splitter, merger, this.channelMode);
    merger.connect(analyser);

    this.context = context;
    this.source = src;
    this.splitter = splitter;
    this.merger = merger;
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Float32Array(analyser.fftSize);
    this.running = true;
    this.micStream = stream;
    this.tick();

    return this.channelCount;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.source) {
      this.source.disconnect();
    }
    if (this.splitter) {
      this.splitter.disconnect();
    }
    if (this.merger) {
      this.merger.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
    }
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.data = null;
    this.timeData = null;
    this.micStream = null;
    this.splitter = null;
    this.merger = null;
    this.lastLevel = 0;
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  getChannelCount(): number {
    return this.channelCount;
  }

  getLastLevel(): number {
    return this.lastLevel;
  }

  updateChannelMode(mode: ChannelMode) {
    this.channelMode = mode;
    if (!this.splitter || !this.merger) return;
    this.splitter.disconnect();
    this.merger.disconnect();
    this.applyChannelMode(this.splitter, this.merger, mode);
    if (this.analyser) {
      this.merger.connect(this.analyser);
    }
  }

  subscribe(listener: AudioFeatureListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private applyChannelMode(
    splitter: ChannelSplitterNode,
    merger: ChannelMergerNode,
    mode: ChannelMode
  ) {
    const ensureChannel = (index: number) => clamp(index, 0, splitter.numberOfOutputs - 1);
    if (mode.type === "stereo") {
      const [l, r] = mode.channels;
      splitter.connect(merger, ensureChannel(l - 1), 0);
      splitter.connect(merger, ensureChannel(r - 1), 1);
    } else {
      const channelIdx = ensureChannel((mode.channel ?? 1) - 1);
      splitter.connect(merger, channelIdx, 0);
      splitter.connect(merger, channelIdx, 1);
    }
  }

  private tick = () => {
    if (!this.running || !this.analyser || !this.data) return;
    this.analyser.getByteFrequencyData(this.data);
    if (this.timeData) {
      this.analyser.getFloatTimeDomainData(this.timeData);
    }
    const frame = this.computeFeatures(this.data, this.timeData);
    this.listeners.forEach((fn) => fn(frame));
    requestAnimationFrame(this.tick);
  };

  private computeFeatures(
    spectrum: Uint8Array,
    timeDomain: Float32Array | null
  ): AudioFeatureFrame {
    const n = spectrum.length;
    if (n === 0) {
      return {
        level: 0,
        brightness: 0,
        low_band: 0,
        mid_band: 0,
        high_band: 0,
        onset: 0,
      };
    }

    let sum = 0;
    let weighted = 0;

    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < n; i++) {
      const v = spectrum[i] / 255;
      sum += v;
      weighted += v * i;

      const ratio = i / n;
      if (ratio < 0.15) lowSum += v;
      else if (ratio < 0.6) midSum += v;
      else highSum += v;
    }

    const spectralLevel = Math.min(1, (sum / n) * 2);
    let rms = 0;
    if (timeDomain && timeDomain.length) {
      for (let i = 0; i < timeDomain.length; i++) {
        const v = timeDomain[i];
        rms += v * v;
      }
      rms = Math.sqrt(rms / timeDomain.length);
    }

    const db = rms > 0 ? 20 * Math.log10(rms) : -120;
    const meterLevel = clamp((db + 60) / 60, 0, 1); // -60dBFS floor
    this.lastLevel = this.lastLevel * 0.55 + meterLevel * 0.45;

    const level = Math.max(spectralLevel, meterLevel);
    const centroidNorm = sum > 0 ? weighted / (sum * n) : 0;

    const low_band = Math.min(1, lowSum / (n * 0.15));
    const mid_band = Math.min(1, midSum / (n * 0.45));
    const high_band = Math.min(1, highSum / (n * 0.4));

    const onsetThreshold = 0.08;
    const onset = spectralLevel - this.lastOnsetLevel > onsetThreshold ? 1 : 0;
    this.lastOnsetLevel = spectralLevel * 0.8 + this.lastOnsetLevel * 0.2;

    return {
      level,
      brightness: centroidNorm,
      low_band,
      mid_band,
      high_band,
      onset,
    };
  }
}
