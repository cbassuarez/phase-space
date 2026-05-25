use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::systems::{AizawaParams, LorenzParams, RosslerParams, ThomasParams};

/// Identifier for which dynamical system a scene uses.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SystemId {
    Lorenz,
    Rossler,
    Aizawa,
    Thomas,
    Chua,
}

/// High-level camera mode selector.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CameraMode {
    Orbit,
    PathRider,
    GridSurface,
    DroneGhost,
    LobeFocus,
    MacroMicro,
}

/// Basic integrator configuration (Euler / RK-style).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegratorSpec {
    pub dt: f32,
    pub steps: u32,
    /// Number of initial steps to discard (transient).
    #[serde(default)]
    pub discard_initial: Option<u32>,
    /// Safety radius; trajectories exceeding this are truncated.
    pub max_radius: f32,
}

/// A single initial seed for a trajectory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialSeed {
    /// Initial position in R³.
    pub x: [f32; 3],
    /// Optional index into a palette; if None, index by trajectory order.
    #[serde(default)]
    pub color_index: Option<u32>,
}

/// Camera configuration for 3D view.
///
/// Spherical coordinates (theta, phi, r) relative to the origin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSpec {
    /// Azimuth angle (radians), around the vertical axis.
    pub theta: f32,
    /// Polar angle (radians), from the +Y axis down.
    pub phi: f32,
    /// Radius (distance from origin).
    pub r: f32,
}

/// View mode: full 3D or planar projection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ViewMode {
    /// 3D view with orbit camera.
    #[serde(rename = "mode3d")]
    Mode3d,
    /// Planar view (e.g. XY / XZ / YZ); details held in plane.
    #[serde(rename = "plane")]
    Plane,
}

/// Optional plane specification for planar projections.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaneSpec {
    /// Normal vector of the plane (not necessarily unit length).
    pub normal: [f32; 3],
    /// Offset from origin along the normal.
    pub offset: f32,
}

/// Color palette for trajectories.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Palette {
    Plasma,
    Viridis,
    Prism,
    Solar,
    Abyss,
    Mono,
    Custom1,
    Custom2,
    Custom3,
}

/// Background style.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Background {
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RenderStyle {
    #[serde(rename = "neon-filaments")]
    NeonFilaments,
    #[serde(rename = "volumetric-cloud")]
    VolumetricCloud,
    #[serde(rename = "crt-scope")]
    CrtScope,
    #[serde(rename = "ribbon")]
    Ribbon,
    #[serde(rename = "path-trace")]
    PathTrace,
}

/// View configuration for rendering a scene.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewSpec {
    pub mode: ViewMode,
    /// Optional plane definition for planar views.
    #[serde(default)]
    pub plane: Option<PlaneSpec>,
    pub camera: CameraSpec,
    pub palette: Palette,
    #[serde(default)]
    pub palette_spec: Option<PaletteSpec>,
    pub background: Background,
    pub point_size: f32,
    #[serde(default = "default_render_style")]
    pub render_style: RenderStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaletteStopSpec {
    pub t: f32,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaletteSpec {
    pub stops: Vec<PaletteStopSpec>,
}

fn default_render_style() -> RenderStyle {
    // default to the calm, cloudy renderer
    RenderStyle::VolumetricCloud
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrbitCameraConfig {
    pub base_radius: f32,
    pub radius_jitter: f32,
    pub azimuth_speed: f32,
    pub polar_speed: f32,
    pub polar_center: f32,
    pub polar_amplitude: f32,
    pub hand_held_jitter: f32,
}

impl Default for OrbitCameraConfig {
    fn default() -> Self {
        Self {
            base_radius: 1.2,
            radius_jitter: 0.05,
            azimuth_speed: 0.25,
            polar_speed: 0.15,
            polar_center: 0.9,
            polar_amplitude: 0.25,
            hand_held_jitter: 0.15,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathRiderCameraConfig {
    pub trajectory_index: u32,
    pub ahead_offset: u32,
    pub lateral_offset: f32,
    pub up_blend: f32,
    pub time_scale: f32,
    #[serde(default = "path_rider_default_loop_mode")]
    pub loop_mode: String, // "wrap" | "ping-pong" | "clamp"
}

fn path_rider_default_loop_mode() -> String {
    "wrap".to_string()
}

impl Default for PathRiderCameraConfig {
    fn default() -> Self {
        Self {
            trajectory_index: 0,
            ahead_offset: 150,
            lateral_offset: 0.3,
            up_blend: 0.6,
            time_scale: 1.0,
            loop_mode: path_rider_default_loop_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridSurfaceCameraConfig {
    pub plane_height: f32,
    pub camera_height: f32,
    pub tilt_angle: f32,
    pub travel_radius: f32,
    pub travel_speed: f32,
    #[serde(default = "grid_surface_default_path_shape")]
    pub path_shape: String, // "circle" | "lemniscate" | "line-scan"
}

fn grid_surface_default_path_shape() -> String {
    "circle".to_string()
}

impl Default for GridSurfaceCameraConfig {
    fn default() -> Self {
        Self {
            plane_height: 0.0,
            camera_height: 2.0,
            tilt_angle: 0.4,
            travel_radius: 1.2,
            travel_speed: 0.25,
            path_shape: grid_surface_default_path_shape(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DroneSystem {
    Lorenz,
    Rossler,
    Thomas,
}

impl Default for DroneSystem {
    fn default() -> Self {
        DroneSystem::Lorenz
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroneGhostCameraConfig {
    pub system: DroneSystem,
    pub radius_scale: f32,
    pub center_bias: f32,
    pub speed: f32,
    #[serde(default = "drone_ghost_default_mode")]
    pub mode: String, // "spherical" | "offset"
}

fn drone_ghost_default_mode() -> String {
    "offset".to_string()
}

impl Default for DroneGhostCameraConfig {
    fn default() -> Self {
        Self {
            system: DroneSystem::Lorenz,
            radius_scale: 1.4,
            center_bias: 0.4,
            speed: 1.0,
            mode: drone_ghost_default_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobeFocusCameraConfig {
    pub dwell_time: f32,
    pub transition_time: f32,
    pub zoom_inner: f32,
    pub zoom_outer: f32,
    #[serde(default = "lobe_focus_default_cycle_mode")]
    pub cycle_mode: String, // "alternate" | "random"
}

fn lobe_focus_default_cycle_mode() -> String {
    "alternate".to_string()
}

impl Default for LobeFocusCameraConfig {
    fn default() -> Self {
        Self {
            dwell_time: 6.0,
            transition_time: 2.5,
            zoom_inner: 0.9,
            zoom_outer: 1.4,
            cycle_mode: lobe_focus_default_cycle_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroMicroCameraConfig {
    pub cycle_duration: f32,
    pub micro_hold_fraction: f32,
    pub macro_radius: f32,
    pub micro_radius: f32,
    #[serde(default = "macro_micro_default_patch_selection")]
    pub patch_selection: String, // "random" | "density" | "seeded"
}

fn macro_micro_default_patch_selection() -> String {
    "random".to_string()
}

impl Default for MacroMicroCameraConfig {
    fn default() -> Self {
        Self {
            cycle_duration: 24.0,
            micro_hold_fraction: 0.4,
            macro_radius: 1.3,
            micro_radius: 0.6,
            patch_selection: macro_micro_default_patch_selection(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraProgram {
    pub mode: CameraMode,
    pub speed_scalar: f32,
    pub zoom_scalar: f32,
    pub stability: f32,

    pub orbit: OrbitCameraConfig,
    pub path_rider: PathRiderCameraConfig,
    pub grid_surface: GridSurfaceCameraConfig,
    pub drone_ghost: DroneGhostCameraConfig,
    pub lobe_focus: LobeFocusCameraConfig,
    pub macro_micro: MacroMicroCameraConfig,
}

impl Default for CameraProgram {
    fn default() -> Self {
        Self {
            mode: CameraMode::Orbit,
            speed_scalar: 1.0,
            zoom_scalar: 1.0,
            stability: 0.25,
            orbit: OrbitCameraConfig::default(),
            path_rider: PathRiderCameraConfig::default(),
            grid_surface: GridSurfaceCameraConfig::default(),
            drone_ghost: DroneGhostCameraConfig::default(),
            lobe_focus: LobeFocusCameraConfig::default(),
            macro_micro: MacroMicroCameraConfig::default(),
        }
    }
}

/// Full specification of a scene: system + parameters + seeds + view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneSpec {
    /// Optional identifier for this scene (for presets).
    #[serde(default)]
    pub id: Option<String>,
    pub system: SystemId,
    /// System-specific parameter JSON (shape depends on system).
    pub params: Value,
    pub initial_seeds: Vec<InitialSeed>,
    pub integrator: IntegratorSpec,
    pub view: ViewSpec,
    /// Optional RNG seed for randomization / reproducibility.
    #[serde(default)]
    pub random_seed: Option<u64>,

    /// Camera program configuration (mode + parameters).
    #[serde(default)]
    pub camera: CameraProgram,
}

impl SceneSpec {
    /// Canonical default Lorenz scene (balanced, classic butterfly).
    pub fn default_lorenz() -> Self {
        let params = LorenzParams::default();
        let params_json = params_to_json_lorenz(&params);

        let mut camera = CameraProgram::default();
        camera.mode = CameraMode::Orbit;
        camera.zoom_scalar = 1.0;
        camera.stability = 0.2;

        SceneSpec {
            id: Some("lorenz-default".to_string()),
            system: SystemId::Lorenz,
            params: params_json,
            initial_seeds: vec![
                InitialSeed {
                    x: [0.1, 0.0, 0.0],
                    color_index: Some(0),
                },
                InitialSeed {
                    x: [0.1001, 0.0, 0.0],
                    color_index: Some(1),
                },
            ],
            integrator: IntegratorSpec {
                dt: 0.01,
                steps: 50_000,
                discard_initial: Some(1_000),
                max_radius: 1000.0,
            },
            view: ViewSpec {
                mode: ViewMode::Mode3d,
                plane: None,
                camera: CameraSpec {
                    theta: 0.8,
                    phi: 0.9,
                    r: 25.0,
                },
                palette: Palette::Prism,
                palette_spec: None,
                background: Background::Light,
                point_size: 1.0,
                render_style: RenderStyle::VolumetricCloud,
            },
            random_seed: Some(42),
            camera,
        }
    }

    /// Canonical default Rössler scene (balanced spiral sheet).
    pub fn default_rossler() -> Self {
        let params = RosslerParams::default();
        let params_json = params_to_json_rossler(&params);

        let mut camera = CameraProgram::default();
        camera.mode = CameraMode::MacroMicro;
        camera.zoom_scalar = 1.15;
        camera.macro_micro.micro_radius = 0.55;

        SceneSpec {
            id: Some("rossler-default".to_string()),
            system: SystemId::Rossler,
            params: params_json,
            initial_seeds: vec![
                InitialSeed {
                    x: [0.1, 0.0, 0.0],
                    color_index: Some(0),
                },
                InitialSeed {
                    x: [0.1002, 0.0, 0.0],
                    color_index: Some(1),
                },
            ],
            integrator: IntegratorSpec {
                dt: 0.02,
                steps: 60_000,
                discard_initial: Some(1_000),
                max_radius: 1000.0,
            },
            view: ViewSpec {
                mode: ViewMode::Mode3d,
                plane: None,
                camera: CameraSpec {
                    theta: 1.0,
                    phi: 0.9,
                    r: 18.0,
                },
                palette: Palette::Prism,
                palette_spec: None,
                background: Background::Dark,
                point_size: 1.0,
                render_style: RenderStyle::VolumetricCloud,
            },
            random_seed: Some(43),
            camera,
        }
    }

    /// Canonical default Aizawa scene (pretty, knotted volume).
    pub fn default_aizawa() -> Self {
        let params = AizawaParams::default();
        let params_json = params_to_json_aizawa(&params);

        let mut camera = CameraProgram::default();
        camera.mode = CameraMode::PathRider;
        camera.path_rider.time_scale = 0.8;
        camera.path_rider.ahead_offset = 220;

        SceneSpec {
            id: Some("aizawa-default".to_string()),
            system: SystemId::Aizawa,
            params: params_json,
            initial_seeds: vec![
                InitialSeed {
                    x: [0.1, 0.0, 0.0],
                    color_index: Some(0),
                },
                InitialSeed {
                    x: [-0.1, 0.0, 0.0],
                    color_index: Some(1),
                },
                InitialSeed {
                    x: [0.0, 0.1, 0.0],
                    color_index: Some(2),
                },
            ],
            integrator: IntegratorSpec {
                dt: 0.01,
                steps: 80_000,
                discard_initial: Some(2_000),
                max_radius: 1000.0,
            },
            view: ViewSpec {
                mode: ViewMode::Mode3d,
                plane: None,
                camera: CameraSpec {
                    theta: 1.2,
                    phi: 0.9,
                    r: 22.0,
                },
                palette: Palette::Prism,
                palette_spec: None,
                background: Background::Dark,
                point_size: 1.0,
                render_style: RenderStyle::VolumetricCloud,
            },
            random_seed: Some(44),
            camera,
        }
    }

    /// Canonical default Thomas scene (pretty cyclic knot).
    pub fn default_thomas() -> Self {
        let params = ThomasParams::default();
        let params_json = params_to_json_thomas(&params);

        let mut camera = CameraProgram::default();
        camera.mode = CameraMode::DroneGhost;
        camera.drone_ghost.radius_scale = 1.6;
        camera.drone_ghost.center_bias = 0.35;

        SceneSpec {
            id: Some("thomas-default".to_string()),
            system: SystemId::Thomas,
            params: params_json,
            initial_seeds: vec![
                InitialSeed {
                    x: [1.0, 0.0, 0.0],
                    color_index: Some(0),
                },
                InitialSeed {
                    x: [-1.0, 0.0, 0.5],
                    color_index: Some(1),
                },
                InitialSeed {
                    x: [0.0, 1.0, -0.5],
                    color_index: Some(2),
                },
            ],
            integrator: IntegratorSpec {
                dt: 0.02,
                steps: 80_000,
                discard_initial: Some(2_000),
                max_radius: 1000.0,
            },
            view: ViewSpec {
                mode: ViewMode::Mode3d,
                plane: None,
                camera: CameraSpec {
                    theta: 0.7,
                    phi: 0.9,
                    r: 16.0,
                },
                // Bias toward "pretty" palettes.
                palette: Palette::Prism,
                palette_spec: None,
                background: Background::Dark,
                point_size: 1.0,
                render_style: RenderStyle::VolumetricCloud,
            },
            random_seed: Some(45),
            camera,
        }
    }
}

// --- Parameter → JSON helpers ------------------------------------------------

fn params_to_json_lorenz(p: &LorenzParams) -> Value {
    serde_json::json!({
        "sigma": p.sigma,
        "rho": p.rho,
        "beta": p.beta,
    })
}

fn params_to_json_rossler(p: &RosslerParams) -> Value {
    serde_json::json!({
        "a": p.a,
        "b": p.b,
        "c": p.c,
    })
}

fn params_to_json_aizawa(p: &AizawaParams) -> Value {
    serde_json::json!({
        "a": p.a,
        "b": p.b,
        "c": p.c,
        "d": p.d,
        "e": p.e,
        "f": p.f,
    })
}

fn params_to_json_thomas(p: &ThomasParams) -> Value {
    serde_json::json!({
        "b": p.b,
    })
}
