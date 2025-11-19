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
Rainbow,
Inferno,
Magma,
Cividis,
}

/// Background style.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Background {
Dark,
Light,
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
pub background: Background,
pub point_size: f32,
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
}

impl SceneSpec {
/// Canonical default Lorenz scene (balanced, classic butterfly).
pub fn default_lorenz() -> Self {
let params = LorenzParams::default();
let params_json = params_to_json_lorenz(&params);
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
            palette: Palette::Plasma,
            background: Background::Dark,
            point_size: 1.0,
        },
        random_seed: Some(42),
    }
}

/// Canonical default Rössler scene (balanced spiral sheet).
pub fn default_rossler() -> Self {
    let params = RosslerParams::default();
    let params_json = params_to_json_rossler(&params);
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
            palette: Palette::Viridis,
            background: Background::Dark,
            point_size: 1.0,
        },
        random_seed: Some(43),
    }
}

/// Canonical default Aizawa scene (pretty, knotted volume).
pub fn default_aizawa() -> Self {
    let params = AizawaParams::default();
    let params_json = params_to_json_aizawa(&params);

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
            palette: Palette::Rainbow,
            background: Background::Dark,
            point_size: 1.0,
        },
        random_seed: Some(44),
    }
}

/// Canonical default Thomas scene (pretty cyclic knot).
pub fn default_thomas() -> Self {
    let params = ThomasParams::default();
    let params_json = params_to_json_thomas(&params);

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
            palette: Palette::Plasma,
            background: Background::Dark,
            point_size: 1.0,
        },
        random_seed: Some(45),
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
