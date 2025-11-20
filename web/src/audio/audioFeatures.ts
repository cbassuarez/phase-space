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

export class AudioIO {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private data: Uint8Array | null = null;
  private listeners = new Set<AudioFeatureListener>();
  private running = false;
  private lastLevel = 0;
  private lastOnsetLevel = 0;
  private ownsContext = false;

  async startMic(context?: AudioContext): Promise<void> {
    if (this.context) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = context ?? new AudioContext();
    this.ownsContext = !context;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();

    analyser.fftSize = 2048;
    src.connect(analyser);

    this.context = ctx;
    this.source = src;
    this.analyser = analyser;
    this.data = new Uint8Array(analyser.frequencyBinCount);
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.source) {
      this.source.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    if (this.context) {
      if (this.ownsContext) {
        this.context.close();
      }
    }
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.data = null;
    this.ownsContext = false;
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  subscribe(listener: AudioFeatureListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tick = () => {
    if (!this.running || !this.analyser || !this.data) return;
    this.analyser.getByteFrequencyData(this.data);
    const frame = this.computeFeatures(this.data);
    this.listeners.forEach((fn) => fn(frame));
    requestAnimationFrame(this.tick);
  };

  private computeFeatures(spectrum: Uint8Array): AudioFeatureFrame {
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

    const level = Math.min(1, (sum / n) * 2);
    const centroidNorm = sum > 0 ? weighted / (sum * n) : 0;

    const low_band = Math.min(1, lowSum / (n * 0.15));
    const mid_band = Math.min(1, midSum / (n * 0.45));
    const high_band = Math.min(1, highSum / (n * 0.4));

    const onsetThreshold = 0.08;
    const onset = level - this.lastOnsetLevel > onsetThreshold ? 1 : 0;
    this.lastOnsetLevel = level * 0.8 + this.lastOnsetLevel * 0.2;

    this.lastLevel = level;

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
