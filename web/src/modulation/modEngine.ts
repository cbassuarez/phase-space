import { ModBus, ModBusRuntimeState, AudioFeature, VisualFeature, Curve } from "./types";
import type { AudioFeatureFrame } from "../audio/audioFeatures";
import type { VisualFeatureFrame } from "../visual/visualFeatures";

export type TargetPath =
  | "view.camera.r"
  | "view.camera.theta"
  | "view.camera.phi"
  | "view.palette_shift"
  | "view.background_brightness"
  | "render.photonWeave.brightness"
  | "render.ribbon.width"
  | "render.cloud.density"
  | "render.caustics.intensity"
  | "audio.voice_0.pitch"
  | "audio.voice_0.pan"
  | "audio.voice_0.brightness"
  | "audio.master.gain";

export type TargetSetter = (value: number) => void;

export interface TargetRegistry {
  getSetter(path: TargetPath): TargetSetter | undefined;
}

export interface ModulationEngineConfig {
  buses: ModBus[];
}

export class ModulationEngine {
  private buses: ModBusRuntimeState[] = [];
  private registry: TargetRegistry;

  constructor(config: ModulationEngineConfig, registry: TargetRegistry) {
    this.buses = config.buses.map((bus) => ({
      bus,
      value: 0,
      rawValue: 0,
    }));
    this.registry = registry;
  }

  static async load(registry: TargetRegistry): Promise<ModulationEngine | null> {
    try {
      const base = import.meta.env.BASE_URL ?? "/";
      const normalizedBase = base.endsWith("/") ? base : `${base}/`;
      const res = await fetch(`${normalizedBase}mod-routing.json`);
      if (!res.ok) throw new Error("Failed to load mod-routing.json");
      const json = await res.json();
      const config: ModulationEngineConfig = {
        buses: json.buses ?? [],
      };
      return new ModulationEngine(config, registry);
    } catch (e) {
      console.warn("ModulationEngine: failed to load config", e);
      return null;
    }
  }

  getBuses(): ModBusRuntimeState[] {
    return this.buses;
  }

  updateBusConfig(update: (buses: ModBus[]) => ModBus[]): void {
    this.buses = update(this.buses.map((b) => b.bus)).map((bus, idx) => ({
      bus,
      value: this.buses[idx]?.value ?? 0,
      rawValue: this.buses[idx]?.rawValue ?? 0,
    }));
  }

  step(audio: AudioFeatureFrame | null, visual: VisualFeatureFrame | null): void {
    if (!audio && !visual) return;

    for (const busState of this.buses) {
      const { bus } = busState;
      if (!bus.enabled) continue;

      const { domain, feature, smoothing, gain } = bus.source;
      const raw = this.getFeatureValue(domain, feature, audio, visual);
      const scaled = raw * (gain ?? 1);

      const alpha = Math.max(0, Math.min(1, 1 - smoothing));
      const newValue = alpha * scaled + (1 - alpha) * (busState.value ?? scaled);

      busState.rawValue = scaled;
      busState.value = Math.max(0, Math.min(1, newValue));

      for (const t of bus.targets) {
        this.applyTarget(busState.value, t);
      }
    }
  }

  private getFeatureValue(
    domain: "audio" | "visual",
    feature: AudioFeature | VisualFeature,
    audio: AudioFeatureFrame | null,
    visual: VisualFeatureFrame | null
  ): number {
    if (domain === "audio") {
      if (!audio) return 0;
      return (audio as any)[feature] ?? 0;
    } else {
      if (!visual) return 0;
      return (visual as any)[feature] ?? 0;
    }
  }

  private applyTarget(
    m: number,
    target: { path: string; range: [number, number]; curve?: Curve; bias?: number; lag?: number }
  ): void {
    const tp = target.path as TargetPath;
    const setter = this.registry.getSetter(tp);
    if (!setter) return;

    const value01 = applyCurve(m, target.curve ?? "linear");
    const [min, max] = target.range;
    const base = min + (max - min) * value01;
    const finalValue = (target.bias ?? 0) + base;

    setter(finalValue);
  }
}

function applyCurve(x: number, curve: Curve): number {
  const v = Math.max(0, Math.min(1, x));
  switch (curve) {
    case "exp":
      return Math.pow(v, 2.0);
    case "log":
      return Math.sqrt(v);
    case "step":
      return v > 0.5 ? 1 : 0;
    case "linear":
    default:
      return v;
  }
}
