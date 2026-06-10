import type { AttractorValidation } from "../hooks/usePhaseWasmEngine";
import type { SceneSpec, Trajectories } from "../types";
import { sceneForRust } from "./sceneBridge";
import { isTauri } from "./tauri";

export interface RuntimeCapability {
  label: string;
  available: boolean;
  detail: string;
}

export interface DesktopRuntimeCapabilities {
  native_compute: RuntimeCapability;
  wgpu: RuntimeCapability;
  project_files: RuntimeCapability;
  autosave_path: string;
  attractor_library_path: string;
  default_project_dir: string;
  rayon_threads: number;
}

export interface NativeIntegrateResult {
  trajectories: Trajectories;
  elapsedMs: number;
  points: number;
  threads: number;
  backend: string;
}

export interface ProjectFileResult {
  path: string;
  projectJson: string;
}

export interface DroppedFileResult {
  path: string;
  name: string;
  extension: string;
  kind: "project" | "json" | "palette" | "audio" | "unknown";
  text: string | null;
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("Desktop runtime is only available in the Tauri app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function getDesktopRuntimeCapabilities(): Promise<DesktopRuntimeCapabilities | null> {
  if (!isTauri()) return null;
  return invokeDesktop<DesktopRuntimeCapabilities>("desktop_runtime_capabilities");
}

export async function integrateSceneNative(scene: SceneSpec): Promise<NativeIntegrateResult> {
  return invokeDesktop<NativeIntegrateResult>("integrate_scene_native", {
    request: { scene: sceneForRust(scene) },
  });
}

export async function validateAttractorNative(input: string): Promise<AttractorValidation> {
  return invokeDesktop<AttractorValidation>("validate_attractor_native", { input });
}

export async function savePhaseProject(path: string, projectJson: string): Promise<ProjectFileResult> {
  return invokeDesktop<ProjectFileResult>("save_phase_project", {
    request: { path, projectJson },
  });
}

export async function readPhaseProject(path: string): Promise<ProjectFileResult> {
  return invokeDesktop<ProjectFileResult>("read_phase_project", { path });
}

export async function autosavePhaseProject(projectJson: string): Promise<ProjectFileResult> {
  return invokeDesktop<ProjectFileResult>("autosave_phase_project", {
    request: { projectJson },
  });
}

export async function readPhaseAutosave(): Promise<ProjectFileResult | null> {
  return invokeDesktop<ProjectFileResult | null>("read_phase_autosave");
}

export async function pendingOpenProjectPaths(): Promise<string[]> {
  if (!isTauri()) return [];
  return invokeDesktop<string[]>("pending_open_project_paths");
}

export async function readDroppedFile(path: string): Promise<DroppedFileResult> {
  return invokeDesktop<DroppedFileResult>("read_dropped_file", { path });
}

export async function readAttractorLibrary(): Promise<string | null> {
  if (!isTauri()) return null;
  return invokeDesktop<string>("read_attractor_library");
}

export async function writeAttractorLibrary(libraryJson: string): Promise<string | null> {
  if (!isTauri()) return null;
  return invokeDesktop<string>("write_attractor_library", {
    request: { libraryJson },
  });
}
