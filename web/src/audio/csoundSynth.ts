type CsoundFactory = typeof import("@csound/browser/dist/csound.js").Csound;
type CsoundObj = import("@csound/browser/dist/csound.js").CsoundObj;

export type CsoundSynthControl =
  | "drone"
  | "pluck"
  | "dust"
  | "bass"
  | "shimmer"
  | "pitch"
  | "timbre"
  | "motion"
  | "texture"
  | "pulse"
  | "space"
  | "gain";

const CONTROL_NAMES: CsoundSynthControl[] = [
  "drone",
  "pluck",
  "dust",
  "bass",
  "shimmer",
  "pitch",
  "timbre",
  "motion",
  "texture",
  "pulse",
  "space",
  "gain",
];

const DEFAULT_CONTROLS: Record<CsoundSynthControl, number> = {
  drone: 0,
  pluck: 0,
  dust: 0,
  bass: 0,
  shimmer: 0,
  pitch: 0.46,
  timbre: 0.42,
  motion: 0.38,
  texture: 0.24,
  pulse: 0.28,
  space: 0.58,
  gain: 0.42,
};

const CSOUND_SYNTH_CSD = `
<CsoundSynthesizer>
<CsOptions>
-odac -d -m0
</CsOptions>
<CsInstruments>
sr = 48000
ksmps = 64
nchnls = 2
0dbfs = 1

gisine ftgen 1, 0, 16384, 10, 1

instr 1
  kpitchRaw chnget "pitch"
  ktimbreRaw chnget "timbre"
  kmotionRaw chnget "motion"
  ktextureRaw chnget "texture"
  kpulseRaw chnget "pulse"
  kspaceRaw chnget "space"
  kgainRaw chnget "gain"
  kdroneRaw chnget "drone"
  kpluckRaw chnget "pluck"
  kdustRaw chnget "dust"
  kbassRaw chnget "bass"
  kshimmerRaw chnget "shimmer"

  kpitch portk kpitchRaw, 0.08
  ktimbre portk ktimbreRaw, 0.12
  kmotion portk kmotionRaw, 0.08
  ktexture portk ktextureRaw, 0.14
  kpulse portk kpulseRaw, 0.06
  kspace portk kspaceRaw, 0.18
  kgain portk kgainRaw, 0.05
  kdrone portk kdroneRaw, 0.10
  kpluck portk kpluckRaw, 0.035
  kdust portk kdustRaw, 0.08
  kbass portk kbassRaw, 0.06
  kshimmer portk kshimmerRaw, 0.16

  kRoot = 32 + kpitch * 26
  kBase = cpsmidinn(kRoot)
  kDetune = 1.002 + ktimbre * 0.018
  kCut = 260 + ktimbre * 7600 + kdrone * 1800

  aDrone1 oscili 0.22, kBase * (0.996 + kspace * 0.006), gisine
  aDrone2 oscili 0.15, kBase * (1.49 + ktimbre * 0.07) * kDetune, gisine
  aDrone3 oscili 0.09, kBase * 0.5, gisine
  aDroneRaw = aDrone1 + aDrone2 + aDrone3
  aDrone tone aDroneRaw, kCut
  aDrone = aDrone * kdrone

  kPulseRate = 0.75 + kmotion * 12 + kpluck * 4
  aPulseLfo oscili 0.5, kPulseRate, gisine
  aPulseMask = aPulseLfo + 0.5
  aPulseMask = aPulseMask * aPulseMask * aPulseMask * aPulseMask * aPulseMask
  kSeqRatio = 1.75 + kmotion * 2.4
  aSeq oscili 0.34, kBase * kSeqRatio, gisine
  aPulse tone aSeq * aPulseMask, 900 + ktimbre * 7200
  aPulse = aPulse * kpluck * (0.45 + kpulse * 0.7)

  aBassLfo oscili 0.5, 0.35 + kmotion * 3.8 + kbass * 3.5, gisine
  aBassMask = aBassLfo + 0.5
  aBassMask = aBassMask * aBassMask
  aBass oscili 0.36, kBase * (0.23 + kbass * 0.18), gisine
  aBass tone aBass * aBassMask, 160 + kbass * 820
  aBass = aBass * kbass

  aNoise rand 0.24
  aTexture butbp aNoise, 700 + ktexture * 9800, 120 + kdust * 5200
  aTexture = aTexture * kdust * (0.35 + ktexture * 0.85)

  aShimmer1 oscili 0.12, kBase * (4.02 + kshimmer * 4.8), gisine
  aShimmer2 oscili 0.08, kBase * (6.01 + ktimbre * 3.2), gisine
  aShimmer tone aShimmer1 + aShimmer2, 2400 + kspace * 7800
  aShimmer = aShimmer * kshimmer

  aCore = aDrone * 0.58 + aPulse * 0.86 + aBass * 0.82 + aTexture * 0.52 + aShimmer * 0.42
  aRevL, aRevR reverbsc aCore, aCore * (0.82 + kspace * 0.24), 0.62 + kspace * 0.28, 9000

  aL = aCore * (0.76 - kspace * 0.16) + aRevL * (0.16 + kspace * 0.26)
  aR = aCore * (0.76 + kspace * 0.16) + aRevR * (0.16 + kspace * 0.26)
  kOutGain = 0.018 + kgain * 0.105
  aL limit aL * kOutGain, -0.72, 0.72
  aR limit aR * kOutGain, -0.72, 0.72
  outs aL, aR
endin
</CsInstruments>
<CsScore>
i 1 0 604800
</CsScore>
</CsoundSynthesizer>
`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

class NativeSynthFallback {
  private context: AudioContext;
  private destination: AudioNode | null = null;
  private controls: Record<CsoundSynthControl, number> = { ...DEFAULT_CONTROLS };
  private frameHandle: number | null = null;
  private startedAt = 0;
  private running = false;
  private nodes: {
    output: GainNode;
    limiter: DynamicsCompressorNode;
    dry: GainNode;
    delay: DelayNode;
    delayFeedback: GainNode;
    delayWet: GainNode;
    droneFilter: BiquadFilterNode;
    droneGain: GainNode;
    droneOscs: OscillatorNode[];
    droneOscGains: GainNode[];
    pulseOsc: OscillatorNode;
    pulseFilter: BiquadFilterNode;
    pulsePan: StereoPannerNode;
    pulseGain: GainNode;
    noiseSource: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    noisePan: StereoPannerNode;
    noiseGain: GainNode;
    bassOsc: OscillatorNode;
    bassFilter: BiquadFilterNode;
    bassPan: StereoPannerNode;
    bassGain: GainNode;
    shimmerOscs: OscillatorNode[];
    shimmerFilter: BiquadFilterNode;
    shimmerPan: StereoPannerNode;
    shimmerGain: GainNode;
  } | null = null;

  constructor(context: AudioContext) {
    this.context = context;
  }

  connectMonitorDestination(node: AudioNode) {
    this.destination = node;
    this.connectOutput();
  }

  isRunning(): boolean {
    return this.running;
  }

  async start() {
    if (this.running) {
      await this.resumeContext();
      return;
    }
    await this.resumeContext();
    this.running = true;
    this.startedAt = this.context.currentTime;
    this.nodes = this.createGraph();
    this.connectOutput();
    this.applyControls();
    this.nodes.output.gain.setValueAtTime(0, this.context.currentTime);
    this.nodes.output.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.08);
    this.tick();
  }

  async stop() {
    this.running = false;
    if (this.frameHandle !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    const nodes = this.nodes;
    this.nodes = null;
    if (!nodes) return;

    const stopAt = this.context.currentTime + 0.12;
    nodes.output.gain.cancelScheduledValues(this.context.currentTime);
    nodes.output.gain.setValueAtTime(nodes.output.gain.value, this.context.currentTime);
    nodes.output.gain.linearRampToValueAtTime(0, stopAt);
    window.setTimeout(() => {
      [...nodes.droneOscs, nodes.pulseOsc, nodes.noiseSource, nodes.bassOsc, ...nodes.shimmerOscs].forEach((node) => {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      });
      try {
        nodes.output.disconnect();
      } catch {
        // Ignore stale graph state.
      }
    }, 140);
  }

  setControl(name: CsoundSynthControl, value: number) {
    this.controls[name] = clamp01(value);
    if (this.running) this.applyControls();
  }

  private createGraph() {
    const output = this.context.createGain();
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 6;
    limiter.ratio.value = 18;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;
    limiter.connect(output);

    const dry = this.context.createGain();
    const delay = this.context.createDelay(1);
    const delayFeedback = this.context.createGain();
    const delayWet = this.context.createGain();
    dry.connect(limiter);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(limiter);

    const droneFilter = this.context.createBiquadFilter();
    droneFilter.type = "lowpass";
    const droneGain = this.context.createGain();
    droneFilter.connect(droneGain);
    droneGain.connect(dry);
    droneGain.connect(delay);

    const droneOscs = [this.context.createOscillator(), this.context.createOscillator(), this.context.createOscillator()];
    const droneOscGains = droneOscs.map((osc, index) => {
      osc.type = index === 1 ? "triangle" : "sine";
      const gain = this.context.createGain();
      gain.gain.value = index === 0 ? 0.16 : index === 1 ? 0.09 : 0.06;
      osc.connect(gain);
      gain.connect(droneFilter);
      osc.start();
      return gain;
    });

    const pulseOsc = this.context.createOscillator();
    pulseOsc.type = "triangle";
    const pulseFilter = this.context.createBiquadFilter();
    pulseFilter.type = "lowpass";
    const pulsePan = this.context.createStereoPanner();
    const pulseGain = this.context.createGain();
    pulseOsc.connect(pulseFilter);
    pulseFilter.connect(pulsePan);
    pulsePan.connect(pulseGain);
    pulseGain.connect(dry);
    pulseGain.connect(delay);
    pulseOsc.start();

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = this.createNoiseBuffer();
    noiseSource.loop = true;
    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    const noisePan = this.context.createStereoPanner();
    const noiseGain = this.context.createGain();
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noisePan);
    noisePan.connect(noiseGain);
    noiseGain.connect(dry);
    noiseGain.connect(delay);
    noiseSource.start();

    const bassOsc = this.context.createOscillator();
    bassOsc.type = "sawtooth";
    const bassFilter = this.context.createBiquadFilter();
    bassFilter.type = "lowpass";
    const bassPan = this.context.createStereoPanner();
    const bassGain = this.context.createGain();
    bassOsc.connect(bassFilter);
    bassFilter.connect(bassPan);
    bassPan.connect(bassGain);
    bassGain.connect(dry);
    bassGain.connect(delay);
    bassOsc.start();

    const shimmerFilter = this.context.createBiquadFilter();
    shimmerFilter.type = "highpass";
    const shimmerPan = this.context.createStereoPanner();
    const shimmerGain = this.context.createGain();
    shimmerFilter.connect(shimmerPan);
    shimmerPan.connect(shimmerGain);
    shimmerGain.connect(dry);
    shimmerGain.connect(delay);
    const shimmerOscs = [this.context.createOscillator(), this.context.createOscillator()];
    shimmerOscs.forEach((osc, index) => {
      osc.type = index === 0 ? "sine" : "triangle";
      osc.connect(shimmerFilter);
      osc.start();
    });

    return {
      output,
      limiter,
      dry,
      delay,
      delayFeedback,
      delayWet,
      droneFilter,
      droneGain,
      droneOscs,
      droneOscGains,
      pulseOsc,
      pulseFilter,
      pulsePan,
      pulseGain,
      noiseSource,
      noiseFilter,
      noisePan,
      noiseGain,
      bassOsc,
      bassFilter,
      bassPan,
      bassGain,
      shimmerOscs,
      shimmerFilter,
      shimmerPan,
      shimmerGain,
    };
  }

  private createNoiseBuffer() {
    const length = Math.max(1, Math.floor(this.context.sampleRate * 2));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = last * 0.92 + (Math.random() * 2 - 1) * 0.08;
      data[i] = last;
    }
    return buffer;
  }

  private connectOutput() {
    if (!this.nodes || !this.destination) return;
    try {
      this.nodes.output.disconnect();
    } catch {
      // Ignore stale graph state.
    }
    this.nodes.output.connect(this.destination);
  }

  private applyControls() {
    const nodes = this.nodes;
    if (!nodes) return;
    const now = this.context.currentTime;
    const t = now - this.startedAt;
    const { drone, pluck, dust, bass, shimmer, pitch, timbre, motion, texture, pulse, space, gain } = this.controls;
    const rootMidi = 32 + pitch * 26;
    const base = 440 * Math.pow(2, (rootMidi - 69) / 12);
    const detune = 1.002 + timbre * 0.018;
    const cut = 520 + timbre * 6800;
    const gainScale = 0.28 + gain * 0.72;
    const rate = 0.45 + motion * 8.5;
    const lfo = Math.sin(t * rate * Math.PI * 2);
    const pulseMask = Math.pow(lfo * 0.5 + 0.5, 3);
    const pan = Math.sin(t * (0.08 + space * 0.22)) * space * 0.58;

    nodes.droneOscs[0].frequency.setTargetAtTime(base, now, 0.04);
    nodes.droneOscs[1].frequency.setTargetAtTime(base * 1.5 * detune, now, 0.04);
    nodes.droneOscs[2].frequency.setTargetAtTime(base * 0.5, now, 0.06);
    nodes.droneFilter.frequency.setTargetAtTime(cut, now, 0.08);
    nodes.droneGain.gain.setTargetAtTime(drone * (0.018 + gain * 0.072) * gainScale, now, 0.08);

    const seqRatio = 1.75 + motion * 2.4;
    nodes.pulseOsc.frequency.setTargetAtTime(base * seqRatio, now, 0.035);
    nodes.pulseFilter.frequency.setTargetAtTime(650 + timbre * 6200, now, 0.06);
    nodes.pulseGain.gain.setTargetAtTime(pluck * (0.002 + pulse * 0.095 * pulseMask) * gainScale, now, 0.025);
    nodes.pulsePan.pan.setTargetAtTime(pan, now, 0.08);

    nodes.noiseFilter.frequency.setTargetAtTime(700 + texture * 9000, now, 0.08);
    nodes.noiseFilter.Q.setTargetAtTime(0.7 + dust * 8.5, now, 0.08);
    nodes.noiseGain.gain.setTargetAtTime(dust * texture * (0.008 + gain * 0.052), now, 0.08);
    nodes.noisePan.pan.setTargetAtTime(-pan * 0.72, now, 0.12);

    const bassMask = Math.pow(Math.sin(t * (0.35 + motion * 3.8 + bass * 3.5) * Math.PI * 2) * 0.5 + 0.5, 2);
    nodes.bassOsc.frequency.setTargetAtTime(base * (0.23 + bass * 0.18), now, 0.04);
    nodes.bassFilter.frequency.setTargetAtTime(160 + bass * 820, now, 0.06);
    nodes.bassGain.gain.setTargetAtTime(bass * (0.01 + bassMask * 0.11) * gainScale, now, 0.04);
    nodes.bassPan.pan.setTargetAtTime(-pan * 0.25, now, 0.1);

    nodes.shimmerOscs[0].frequency.setTargetAtTime(base * (4.02 + shimmer * 4.8), now, 0.08);
    nodes.shimmerOscs[1].frequency.setTargetAtTime(base * (6.01 + timbre * 3.2), now, 0.08);
    nodes.shimmerFilter.frequency.setTargetAtTime(2400 + space * 7800, now, 0.12);
    nodes.shimmerGain.gain.setTargetAtTime(shimmer * (0.006 + gain * 0.036) * gainScale, now, 0.12);
    nodes.shimmerPan.pan.setTargetAtTime(pan * 0.85, now, 0.12);

    nodes.dry.gain.setTargetAtTime(0.72 - space * 0.18, now, 0.12);
    nodes.delay.delayTime.setTargetAtTime(0.12 + space * 0.42, now, 0.12);
    nodes.delayFeedback.gain.setTargetAtTime(0.12 + space * 0.42, now, 0.12);
    nodes.delayWet.gain.setTargetAtTime(0.08 + space * 0.22, now, 0.12);
  }

  private tick = () => {
    if (!this.running || typeof window === "undefined") return;
    this.applyControls();
    this.frameHandle = window.requestAnimationFrame(this.tick);
  };

  private async resumeContext() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }
}

export class CsoundSynth {
  private context: AudioContext;
  private csound: CsoundObj | null = null;
  private node: AudioNode | null = null;
  private destination: AudioNode | null = null;
  private fallback: NativeSynthFallback;
  private engineMode: "csound" | "native" | null = null;
  private performPromise: Promise<number> | null = null;
  private running = false;
  private startingPromise: Promise<void> | null = null;
  private controls: Record<CsoundSynthControl, number> = { ...DEFAULT_CONTROLS };
  private lastSent: Partial<Record<CsoundSynthControl, number>> = {};
  private flushHandle: number | null = null;
  private flushInFlight = false;
  private dirtyDuringFlush = false;

  constructor(context: AudioContext) {
    this.context = context;
    this.fallback = new NativeSynthFallback(context);
  }

  connectMonitorDestination(node: AudioNode) {
    this.destination = node;
    this.fallback.connectMonitorDestination(node);
    this.connectNode();
  }

  isRunning(): boolean {
    return this.running || this.fallback.isRunning();
  }

  async start(): Promise<void> {
    if (this.running) {
      await this.resumeContext();
      return;
    }
    if (this.startingPromise) return this.startingPromise;
    this.startingPromise = this.startInternal().finally(() => {
      this.startingPromise = null;
    });
    return this.startingPromise;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.engineMode = null;
    if (this.flushHandle !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.flushHandle);
      this.flushHandle = null;
    }
    await this.fallback.stop();
    const instance = this.csound;
    this.performPromise = null;
    this.csound = null;
    this.disconnectNode();
    if (!instance) return;
    try {
      await instance.setControlChannel("gain", 0);
    } catch {
      // Instance may already be stopped.
    }
    try {
      await instance.stop();
      await instance.cleanup();
      await instance.terminateInstance();
    } catch (err) {
      console.warn("CsoundSynth: failed to stop", err);
    }
  }

  setControl(name: CsoundSynthControl, value: number) {
    this.controls[name] = clamp01(value);
    this.fallback.setControl(name, this.controls[name]);
    this.scheduleFlush();
  }

  resetRouteControls() {
    (["drone", "pluck", "dust", "bass", "shimmer"] as CsoundSynthControl[]).forEach((name) => {
      this.setControl(name, 0);
    });
  }

  private async startInternal() {
    await this.resumeContext();
    try {
      await this.startCsound();
    } catch (err) {
      console.warn("CsoundSynth: Csound failed; using native Synth fallback", err);
      await this.fallback.start();
      this.running = true;
      this.engineMode = "native";
    }
  }

  private async startCsound() {
    const { Csound } = await import("@csound/browser/dist/csound.js");
    const createCsound = Csound as CsoundFactory;
    const csound = await createCsound({
      audioContext: this.context,
      outputChannelCount: 2,
      autoConnect: false,
      useWorker: false,
      useSAB: false,
    });
    if (!csound) {
      throw new Error("Csound failed to initialize.");
    }

    try {
      csound.on("message", (message) => {
        if (typeof message === "string" && message.trim()) {
          console.debug("Csound:", message);
        }
      });

      const compileResult = await csound.compileCSD(CSOUND_SYNTH_CSD, 1);
      if (compileResult !== 0) {
        throw new Error(`Csound compile failed (${compileResult}).`);
      }

      await this.sendAllControls(csound, true);
      const startResult = await csound.start();
      if (startResult !== 0) {
        throw new Error(`Csound start failed (${startResult}).`);
      }

      this.csound = csound;
      this.running = true;
      this.engineMode = "csound";
      this.node = (await csound.getNode()) ?? null;
      if (!this.node) {
        throw new Error("Csound did not expose an AudioNode.");
      }
      this.connectNode();
      this.performPromise = csound.perform().catch((err) => {
        if (this.running && this.engineMode === "csound") {
          console.warn("CsoundSynth: performance ended unexpectedly", err);
        }
        return -1;
      });
      this.scheduleFlush();
    } catch (err) {
      await csound.terminateInstance().catch(() => undefined);
      this.csound = null;
      this.node = null;
      this.running = false;
      this.engineMode = null;
      throw err;
    }
  }

  private async resumeContext() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  private connectNode() {
    if (!this.node || !this.destination) return;
    try {
      this.node.disconnect();
    } catch {
      // Ignore stale/disconnected node state.
    }
    try {
      this.node.connect(this.destination);
    } catch (err) {
      console.warn("CsoundSynth: failed to connect monitor destination", err);
    }
  }

  private disconnectNode() {
    if (!this.node) return;
    try {
      this.node.disconnect();
    } catch {
      // Ignore stale/disconnected node state.
    }
    this.node = null;
  }

  private scheduleFlush() {
    if (!this.running || !this.csound || typeof window === "undefined") return;
    if (this.flushInFlight) {
      this.dirtyDuringFlush = true;
      return;
    }
    if (this.flushHandle !== null) return;
    this.flushHandle = window.requestAnimationFrame(() => {
      this.flushHandle = null;
      void this.flushControls();
    });
  }

  private async flushControls() {
    if (!this.csound || !this.running) return;
    this.flushInFlight = true;
    try {
      await this.sendAllControls(this.csound, false);
    } finally {
      this.flushInFlight = false;
      if (this.dirtyDuringFlush) {
        this.dirtyDuringFlush = false;
        this.scheduleFlush();
      }
    }
  }

  private async sendAllControls(csound: CsoundObj, force: boolean) {
    const updates = CONTROL_NAMES.filter((name) => {
      const value = this.controls[name];
      return force || Math.abs(value - (this.lastSent[name] ?? -1)) > 0.002;
    });
    if (updates.length === 0) return;
    await Promise.allSettled(
      updates.map(async (name) => {
        const value = this.controls[name];
        await csound.setControlChannel(name, value);
        this.lastSent[name] = value;
      })
    );
  }
}
