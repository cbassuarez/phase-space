export class InternalSynth {
  private context: AudioContext;
  private master: GainNode;
  private voices: {
    osc: OscillatorNode;
    gain: GainNode;
    pan: StereoPannerNode;
    baseFreq: number;
  }[];

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.context.destination);

    this.voices = [];

    for (let i = 0; i < 2; i++) {
      const osc = this.context.createOscillator();
      osc.type = "sine";

      const gain = this.context.createGain();
      gain.gain.value = 0.0;

      const pan = new StereoPannerNode(this.context);
      pan.pan.value = 0.0;

      osc.connect(gain);
      gain.connect(pan);
      pan.connect(this.master);

      osc.start();

      this.voices.push({
        osc,
        gain,
        pan,
        baseFreq: 220 * Math.pow(2, i),
      });
    }
  }

  setMasterGain(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    this.master.gain.linearRampToValueAtTime(clamped, this.context.currentTime + 0.05);
  }

  setVoicePitch(index: number, v: number) {
    const voice = this.voices[index];
    if (!voice) return;

    const norm = Math.max(0, Math.min(1, v));
    const semis = norm * 24 - 12;
    const freq = voice.baseFreq * Math.pow(2, semis / 12);
    voice.osc.frequency.linearRampToValueAtTime(freq, this.context.currentTime + 0.05);
  }

  setVoicePan(index: number, v: number) {
    const voice = this.voices[index];
    if (!voice) return;
    const pan = Math.max(-1, Math.min(1, v * 2 - 1));
    voice.pan.pan.linearRampToValueAtTime(pan, this.context.currentTime + 0.05);
  }

  setVoiceBrightness(index: number, v: number) {
    const voice = this.voices[index];
    if (!voice) return;
    const gain = Math.max(0, Math.min(1, v));
    voice.gain.gain.linearRampToValueAtTime(gain, this.context.currentTime + 0.05);
  }

  getContext(): AudioContext {
    return this.context;
  }
}
