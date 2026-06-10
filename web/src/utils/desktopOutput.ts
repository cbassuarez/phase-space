import { isTauri } from "./tauri";

export interface OutputCapability {
  label: string;
  available: boolean;
  detail: string;
}

export interface FfmpegCapability {
  available: boolean;
  command: string;
  version: string | null;
  detail: string;
}

export interface DesktopOutputCapabilities {
  platform: "macos" | "windows" | "linux" | "unknown";
  default_output_dir: string | null;
  syphon: OutputCapability;
  spout: OutputCapability;
  ndi: OutputCapability;
  artnet: OutputCapability;
  ffmpeg: FfmpegCapability;
}

export interface FrameWriteRequest {
  dataUrl: string;
  outputDir: string;
  filename?: string;
  prefix?: string;
  frameIndex?: number;
}

export interface FrameWriteResult {
  path: string;
  bytes: number;
}

export interface ArtnetDmxRequest {
  host: string;
  port?: number;
  universe: number;
  sequence?: number;
  values: number[];
}

export interface ArtnetDmxResult {
  target: string;
  bytes: number;
  channels: number;
}

export interface EncodeSequenceRequest {
  outputDir: string;
  prefix: string;
  fps: number;
  codec: "h264" | "prores";
  outputPath: string;
  startNumber?: number;
}

export interface EncodeSequenceResult {
  output_path: string;
  status_code: number | null;
  success: boolean;
  stdout: string;
  stderr: string;
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("Desktop output is only available in the Tauri app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function getDesktopOutputCapabilities(): Promise<DesktopOutputCapabilities | null> {
  if (!isTauri()) return null;
  return invokeDesktop<DesktopOutputCapabilities>("desktop_output_capabilities");
}

export async function writeDesktopFrame(request: FrameWriteRequest): Promise<FrameWriteResult> {
  return invokeDesktop<FrameWriteResult>("write_desktop_frame", { request });
}

export async function sendArtnetDmx(request: ArtnetDmxRequest): Promise<ArtnetDmxResult> {
  return invokeDesktop<ArtnetDmxResult>("send_artnet_dmx", { request });
}

export async function encodeDesktopSequence(
  request: EncodeSequenceRequest
): Promise<EncodeSequenceResult> {
  return invokeDesktop<EncodeSequenceResult>("encode_desktop_sequence", { request });
}

export async function revealOutputPath(path: string): Promise<void> {
  return invokeDesktop<void>("reveal_output_path", { path });
}
