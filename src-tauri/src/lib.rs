use base64::{engine::general_purpose, Engine as _};
use phasecore::{integrate_scene, validate_attractor_input, SceneSpec};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::net::UdpSocket;
use std::path::{Path, PathBuf};
use std::process::Command as ProcessCommand;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_opener::OpenerExt;

const REPO_URL: &str = "https://github.com/cbassuarez/phase-space";
const RELEASES_URL: &str = "https://github.com/cbassuarez/phase-space/releases";
const SPONSOR_URL: &str = "https://github.com/sponsors/cbassuarez";

#[derive(Debug, Serialize)]
struct OutputCapability {
    label: &'static str,
    available: bool,
    detail: String,
}

#[derive(Debug, Serialize)]
struct FfmpegCapability {
    available: bool,
    command: String,
    version: Option<String>,
    detail: String,
}

#[derive(Debug, Serialize)]
struct DesktopOutputCapabilities {
    platform: &'static str,
    default_output_dir: Option<String>,
    syphon: OutputCapability,
    spout: OutputCapability,
    ndi: OutputCapability,
    artnet: OutputCapability,
    ffmpeg: FfmpegCapability,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrameWriteRequest {
    data_url: String,
    output_dir: String,
    filename: Option<String>,
    prefix: Option<String>,
    frame_index: Option<u32>,
}

#[derive(Debug, Serialize)]
struct FrameWriteResult {
    path: String,
    bytes: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArtnetDmxRequest {
    host: String,
    port: Option<u16>,
    universe: u16,
    sequence: Option<u8>,
    values: Vec<u8>,
}

#[derive(Debug, Serialize)]
struct ArtnetDmxResult {
    target: String,
    bytes: usize,
    channels: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncodeSequenceRequest {
    output_dir: String,
    prefix: String,
    fps: f32,
    codec: String,
    output_path: String,
    start_number: Option<u32>,
}

#[derive(Debug, Serialize)]
struct EncodeSequenceResult {
    output_path: String,
    status_code: Option<i32>,
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Serialize)]
struct RuntimeCapability {
    label: &'static str,
    available: bool,
    detail: String,
}

#[derive(Debug, Serialize)]
struct DesktopRuntimeCapabilities {
    native_compute: RuntimeCapability,
    wgpu: RuntimeCapability,
    project_files: RuntimeCapability,
    autosave_path: String,
    attractor_library_path: String,
    default_project_dir: String,
    rayon_threads: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeIntegrateRequest {
    scene: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeIntegrateResult {
    trajectories: Vec<Vec<[f32; 3]>>,
    elapsed_ms: u128,
    points: usize,
    threads: usize,
    backend: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileRequest {
    path: String,
    project_json: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AutosaveProjectRequest {
    project_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileResult {
    path: String,
    project_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DroppedFileResult {
    path: String,
    name: String,
    extension: String,
    kind: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttractorLibraryWriteRequest {
    library_json: String,
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn default_output_dir() -> Option<PathBuf> {
    home_dir().map(|home| {
        if cfg!(target_os = "macos") {
            home.join("Movies").join("phase-space")
        } else {
            home.join("phase-space-output")
        }
    })
}

fn app_data_dir() -> PathBuf {
    if cfg!(target_os = "macos") {
        return home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
            .join("phase-space");
    }
    if cfg!(target_os = "windows") {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            return PathBuf::from(appdata).join("phase-space");
        }
    }
    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(xdg).join("phase-space");
    }
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".local")
        .join("share")
        .join("phase-space")
}

fn default_project_dir() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Documents")
        .join("phase-space")
}

fn autosave_path() -> PathBuf {
    app_data_dir().join("autosave").join("recovery.phsp")
}

fn attractor_library_path() -> PathBuf {
    app_data_dir().join("library").join("attractors.json")
}

fn expand_user_path(input: &str) -> PathBuf {
    if input == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(input));
    }
    if let Some(rest) = input.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(input)
}

fn sanitize_filename_component(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches(['-', '.', '_']);
    if trimmed.is_empty() {
        "phase-space".to_string()
    } else {
        trimmed.to_string()
    }
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn decode_png_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "Frame payload is not a data URL".to_string())?;
    if !header.starts_with("data:image/png") || !header.contains(";base64") {
        return Err("Frame payload must be a base64 PNG data URL".to_string());
    }
    general_purpose::STANDARD
        .decode(encoded.as_bytes())
        .map_err(|err| format!("Failed to decode PNG data: {err}"))
}

fn ffmpeg_capability() -> FfmpegCapability {
    match ProcessCommand::new("ffmpeg").arg("-version").output() {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout);
            let version = text.lines().next().map(|line| line.to_string());
            FfmpegCapability {
                available: true,
                command: "ffmpeg".to_string(),
                version,
                detail: "System ffmpeg is available.".to_string(),
            }
        }
        Ok(output) => FfmpegCapability {
            available: false,
            command: "ffmpeg".to_string(),
            version: None,
            detail: format!(
                "ffmpeg returned status {}.",
                output
                    .status
                    .code()
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "unknown".to_string())
            ),
        },
        Err(err) => FfmpegCapability {
            available: false,
            command: "ffmpeg".to_string(),
            version: None,
            detail: format!("ffmpeg was not found on PATH: {err}"),
        },
    }
}

#[tauri::command]
fn desktop_output_capabilities() -> DesktopOutputCapabilities {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    };

    DesktopOutputCapabilities {
        platform,
        default_output_dir: default_output_dir().map(|path| path.to_string_lossy().to_string()),
        syphon: OutputCapability {
            label: "Syphon",
            available: false,
            detail: if cfg!(target_os = "macos") {
                "Requires a native shared-texture publisher; the current Tauri webview canvas does not expose a shareable GL texture.".to_string()
            } else {
                "macOS only.".to_string()
            },
        },
        spout: OutputCapability {
            label: "Spout",
            available: false,
            detail: if cfg!(target_os = "windows") {
                "Requires a native shared-texture publisher; the current Tauri webview canvas does not expose a shareable GL texture.".to_string()
            } else {
                "Windows only.".to_string()
            },
        },
        ndi: OutputCapability {
            label: "NDI",
            available: false,
            detail: "NDI SDK/runtime integration is not bundled yet.".to_string(),
        },
        artnet: OutputCapability {
            label: "Art-Net",
            available: true,
            detail: "UDP ArtDMX packets can be sent from the desktop shell.".to_string(),
        },
        ffmpeg: ffmpeg_capability(),
    }
}

#[tauri::command]
fn desktop_runtime_capabilities() -> DesktopRuntimeCapabilities {
    let autosave = autosave_path();
    let library = attractor_library_path();
    let projects = default_project_dir();
    DesktopRuntimeCapabilities {
        native_compute: RuntimeCapability {
            label: "Native Rust compute",
            available: true,
            detail: "Desktop scenes integrate through phasecore with Rayon across trajectories."
                .to_string(),
        },
        wgpu: RuntimeCapability {
            label: "wgpu native renderer",
            available: false,
            detail: "Not wired yet; current desktop builds still render through the webview WebGL canvas."
                .to_string(),
        },
        project_files: RuntimeCapability {
            label: ".phsp project files",
            available: true,
            detail: "Projects, autosaves, and dropped project files are read and written by the native shell."
                .to_string(),
        },
        autosave_path: autosave.to_string_lossy().to_string(),
        attractor_library_path: library.to_string_lossy().to_string(),
        default_project_dir: projects.to_string_lossy().to_string(),
        rayon_threads: rayon_thread_count(),
    }
}

fn rayon_thread_count() -> usize {
    std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
}

#[tauri::command]
fn integrate_scene_native(request: NativeIntegrateRequest) -> Result<NativeIntegrateResult, String> {
    let scene: SceneSpec = serde_json::from_value(request.scene)
        .map_err(|err| format!("Scene value error: {err}"))?;
    let report = integrate_scene(scene)?;
    Ok(NativeIntegrateResult {
        trajectories: report.trajectories,
        elapsed_ms: report.elapsed_ms,
        points: report.points,
        threads: report.threads,
        backend: report.backend,
    })
}

#[tauri::command]
fn validate_attractor_native(input: String) -> Result<Value, String> {
    let validation = validate_attractor_input(&input)?;
    serde_json::to_value(validation).map_err(|err| format!("Serialize error: {err}"))
}

fn pretty_json(input: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(input).map_err(|err| format!("JSON parse error: {err}"))?;
    serde_json::to_string_pretty(&value).map_err(|err| format!("JSON serialize error: {err}"))
}

fn write_project_file(path: &Path, project_json: &str) -> Result<ProjectFileResult, String> {
    let formatted = pretty_json(project_json)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
    }
    fs::write(path, &formatted)
        .map_err(|err| format!("Failed to write project {}: {err}", path.display()))?;
    Ok(ProjectFileResult {
        path: path.to_string_lossy().to_string(),
        project_json: formatted,
    })
}

#[tauri::command]
fn save_phase_project(request: ProjectFileRequest) -> Result<ProjectFileResult, String> {
    let path = expand_user_path(&request.path);
    write_project_file(&path, &request.project_json)
}

#[tauri::command]
fn read_phase_project(path: String) -> Result<ProjectFileResult, String> {
    let path = expand_user_path(&path);
    let project_json = fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read project {}: {err}", path.display()))?;
    let formatted = pretty_json(&project_json)?;
    Ok(ProjectFileResult {
        path: path.to_string_lossy().to_string(),
        project_json: formatted,
    })
}

#[tauri::command]
fn autosave_phase_project(request: AutosaveProjectRequest) -> Result<ProjectFileResult, String> {
    let path = autosave_path();
    write_project_file(&path, &request.project_json)
}

#[tauri::command]
fn read_phase_autosave() -> Result<Option<ProjectFileResult>, String> {
    let path = autosave_path();
    if !path.exists() {
        return Ok(None);
    }
    let project_json = fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read autosave {}: {err}", path.display()))?;
    let formatted = pretty_json(&project_json)?;
    Ok(Some(ProjectFileResult {
        path: path.to_string_lossy().to_string(),
        project_json: formatted,
    }))
}

#[tauri::command]
fn pending_open_project_paths() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            Path::new(arg)
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("phsp"))
                .unwrap_or(false)
        })
        .collect()
}

#[tauri::command]
fn read_dropped_file(path: String) -> Result<DroppedFileResult, String> {
    let path_buf = expand_user_path(&path);
    let name = path_buf
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled")
        .to_string();
    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let kind = match extension.as_str() {
        "phsp" => "project",
        "json" => "json",
        "ase" | "gpl" | "palette" => "palette",
        "wav" | "aif" | "aiff" | "mp3" | "flac" | "m4a" | "ogg" => "audio",
        _ => "unknown",
    }
    .to_string();

    let text = match kind.as_str() {
        "project" | "json" | "palette" => {
            let meta = fs::metadata(&path_buf)
                .map_err(|err| format!("Failed to stat {}: {err}", path_buf.display()))?;
            if meta.len() > 8 * 1024 * 1024 {
                return Err(format!("{} is too large for text import", path_buf.display()));
            }
            Some(
                fs::read_to_string(&path_buf)
                    .map_err(|err| format!("Failed to read {}: {err}", path_buf.display()))?,
            )
        }
        _ => None,
    };

    Ok(DroppedFileResult {
        path: path_buf.to_string_lossy().to_string(),
        name,
        extension,
        kind,
        text,
    })
}

#[tauri::command]
fn read_attractor_library() -> Result<String, String> {
    let path = attractor_library_path();
    if !path.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read attractor library {}: {err}", path.display()))
}

#[tauri::command]
fn write_attractor_library(request: AttractorLibraryWriteRequest) -> Result<String, String> {
    let formatted = pretty_json(&request.library_json)?;
    let path = attractor_library_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create {}: {err}", parent.display()))?;
    }
    fs::write(&path, &formatted)
        .map_err(|err| format!("Failed to write attractor library {}: {err}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_desktop_frame(request: FrameWriteRequest) -> Result<FrameWriteResult, String> {
    let bytes = decode_png_data_url(&request.data_url)?;
    let dir = expand_user_path(&request.output_dir);
    fs::create_dir_all(&dir)
        .map_err(|err| format!("Failed to create output directory {}: {err}", dir.display()))?;

    let filename = match request.filename {
        Some(name) => sanitize_filename_component(&name),
        None => {
            let prefix = sanitize_filename_component(request.prefix.as_deref().unwrap_or("phase-space"));
            match request.frame_index {
                Some(index) => format!("{prefix}-{index:06}.png"),
                None => format!("{prefix}-{}.png", timestamp_millis()),
            }
        }
    };
    let filename = if filename.to_ascii_lowercase().ends_with(".png") {
        filename
    } else {
        format!("{filename}.png")
    };
    let path = dir.join(filename);
    fs::write(&path, &bytes)
        .map_err(|err| format!("Failed to write frame {}: {err}", path.display()))?;

    Ok(FrameWriteResult {
        path: path.to_string_lossy().to_string(),
        bytes: bytes.len(),
    })
}

#[tauri::command]
fn send_artnet_dmx(request: ArtnetDmxRequest) -> Result<ArtnetDmxResult, String> {
    if request.host.trim().is_empty() {
        return Err("Art-Net host is required".to_string());
    }
    if request.values.is_empty() {
        return Err("Art-Net values must include at least one channel".to_string());
    }
    if request.values.len() > 512 {
        return Err("Art-Net packets can carry at most 512 DMX channels".to_string());
    }

    let port = request.port.unwrap_or(6454);
    let target = format!("{}:{port}", request.host.trim());
    let channels = request.values.len();
    let length = channels as u16;
    let mut packet = Vec::with_capacity(18 + channels);
    packet.extend_from_slice(b"Art-Net\0");
    packet.extend_from_slice(&0x5000u16.to_le_bytes()); // OpDmx
    packet.extend_from_slice(&14u16.to_be_bytes()); // protocol version
    packet.push(request.sequence.unwrap_or(0));
    packet.push(0); // physical input
    packet.extend_from_slice(&request.universe.to_le_bytes());
    packet.extend_from_slice(&length.to_be_bytes());
    packet.extend_from_slice(&request.values);

    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|err| format!("Failed to bind UDP socket: {err}"))?;
    socket
        .set_broadcast(true)
        .map_err(|err| format!("Failed to enable UDP broadcast: {err}"))?;
    let bytes = socket
        .send_to(&packet, &target)
        .map_err(|err| format!("Failed to send Art-Net packet to {target}: {err}"))?;

    Ok(ArtnetDmxResult {
        target,
        bytes,
        channels,
    })
}

#[tauri::command]
fn encode_desktop_sequence(request: EncodeSequenceRequest) -> Result<EncodeSequenceResult, String> {
    let dir = expand_user_path(&request.output_dir);
    let prefix = sanitize_filename_component(&request.prefix);
    let pattern = dir.join(format!("{prefix}-%06d.png"));
    let output_path = expand_user_path(&request.output_path);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create output directory {}: {err}",
                parent.display()
            )
        })?;
    }

    let fps = request.fps.clamp(1.0, 120.0);
    let start_number = request.start_number.unwrap_or(0).to_string();
    let fps_arg = if fps.fract() == 0.0 {
        format!("{fps:.0}")
    } else {
        format!("{fps:.3}")
    };

    let mut command = ProcessCommand::new("ffmpeg");
    command
        .arg("-y")
        .arg("-framerate")
        .arg(&fps_arg)
        .arg("-start_number")
        .arg(start_number)
        .arg("-i")
        .arg(pattern.as_os_str());

    match request.codec.as_str() {
        "prores" => {
            command
                .arg("-c:v")
                .arg("prores_ks")
                .arg("-profile:v")
                .arg("3")
                .arg("-pix_fmt")
                .arg("yuv422p10le");
        }
        _ => {
            command
                .arg("-c:v")
                .arg("libx264")
                .arg("-crf")
                .arg("18")
                .arg("-pix_fmt")
                .arg("yuv420p");
        }
    }

    let output = command
        .arg(output_path.as_os_str())
        .output()
        .map_err(|err| format!("Failed to run ffmpeg: {err}"))?;

    Ok(EncodeSequenceResult {
        output_path: output_path.to_string_lossy().to_string(),
        status_code: output.status.code(),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

#[tauri::command]
fn reveal_output_path<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let target = expand_user_path(&path);
    let to_open: &Path = if target.is_file() {
        target.parent().unwrap_or(&target)
    } else {
        &target
    };
    app.opener()
        .open_path(to_open.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| format!("Failed to open {}: {err}", to_open.display()))
}

/// Native app menu. The "about" and "reload" items emit a `menu` event the
/// frontend acts on (about opens the in-app modal; reload refreshes the view);
/// the link items open URLs natively; everything else is a standard OS item
/// with its conventional shortcut.
fn build_menu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        handle,
        "phase-space",
        true,
        &[
            &MenuItem::with_id(handle, "about", "About phase-space", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;
    let file = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &MenuItem::with_id(handle, "open-project", "Open Project…", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(handle, "save-project", "Save Project", true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(
                handle,
                "recover-autosave",
                "Recover Autosave",
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?,
        ],
    )?;
    let edit = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;
    let view = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &MenuItem::with_id(handle, "reload", "Reload View", true, Some("CmdOrCtrl+R"))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::fullscreen(handle, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;
    let help = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            &MenuItem::with_id(handle, "github", "phase-space on GitHub", true, None::<&str>)?,
            &MenuItem::with_id(handle, "releases", "Releases & Downloads", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "sponsor", "Sponsor phase-space", true, None::<&str>)?,
        ],
    )?;
    Menu::with_items(handle, &[&app_menu, &file, &edit, &view, &window, &help])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            desktop_output_capabilities,
            desktop_runtime_capabilities,
            integrate_scene_native,
            validate_attractor_native,
            save_phase_project,
            read_phase_project,
            autosave_phase_project,
            read_phase_autosave,
            pending_open_project_paths,
            read_dropped_file,
            read_attractor_library,
            write_attractor_library,
            write_desktop_frame,
            send_artnet_dmx,
            encode_desktop_sequence,
            reveal_output_path,
        ])
        .menu(|handle| build_menu(handle))
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            match id {
                // Handled by the frontend (modal / refresh).
                "about" | "reload" | "open-project" | "save-project" | "recover-autosave" => {
                    let _ = app.emit("menu", id);
                }
                "github" => {
                    let _ = app.opener().open_url(REPO_URL, None::<&str>);
                }
                "releases" => {
                    let _ = app.opener().open_url(RELEASES_URL, None::<&str>);
                }
                "sponsor" => {
                    let _ = app.opener().open_url(SPONSOR_URL, None::<&str>);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running phase-space");
}
