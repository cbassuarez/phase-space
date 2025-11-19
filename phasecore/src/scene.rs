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
// phasewasm/src/lib.rs

use wasm_bindgen::prelude::*;
use phasecore::{integrate_trajectory, SceneSpec, Vec3};
use phasecore::integrator::IntegratorConfig;
use phasecore::scene::{IntegratorSpec, SystemId};
use phasecore::systems::{
    Aizawa, AizawaParams, Lorenz, LorenzParams, Rossler, RosslerParams, Thomas, ThomasParams,
};
use serde_json::Value;
use serde_wasm_bindgen;

/// Set up better panic messages in the browser console.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

fn integrator_spec_to_config(spec: &IntegratorSpec) -> IntegratorConfig {
    IntegratorConfig {
        dt: spec.dt,
        steps: spec.steps,
        discard_initial: spec.discard_initial.unwrap_or(0),
        max_radius: spec.max_radius,
    }
}

#[wasm_bindgen]
pub struct WasmEngine;

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmEngine {
        WasmEngine
    }

    /// Integrate a scene described by JSON SceneSpec, return an array-of-arrays of points
    /// shaped as: `[[[x,y,z], ...], ...]` where outer index = trajectory index.
    #[wasm_bindgen]
    pub fn integrate_scene(&self, scene_json: &str) -> Result<JsValue, JsValue> {
        let scene: SceneSpec = serde_json::from_str(scene_json)
            .map_err(|e| JsValue::from_str(&format!("Scene parse error: {e}")))?;

        match scene.system {
            SystemId::Lorenz => {
                let params = parse_lorenz_params(&scene.params)
                    .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
                let cfg = integrator_spec_to_config(&scene.integrator);

                let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();

                for seed in &scene.initial_seeds {
                    let x0: Vec3 = Vec3::from(seed.x);
                    let points = integrate_trajectory(Lorenz, &params, x0, cfg);
                    trajectories.push(points.into_iter().map(Into::into).collect());
                }

                let js_val = serde_wasm_bindgen::to_value(&trajectories)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))?;
                Ok(js_val)
            }
            SystemId::Rossler => {
                let params = parse_rossler_params(&scene.params)
                    .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
                let cfg = integrator_spec_to_config(&scene.integrator);

                let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();

                for seed in &scene.initial_seeds {
                    let x0: Vec3 = Vec3::from(seed.x);
                    let points = integrate_trajectory(Rossler, &params, x0, cfg);
                    trajectories.push(points.into_iter().map(Into::into).collect());
                }

                let js_val = serde_wasm_bindgen::to_value(&trajectories)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))?;
                Ok(js_val)
            }
            SystemId::Aizawa => {
                let params = parse_aizawa_params(&scene.params)
                    .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
                let cfg = integrator_spec_to_config(&scene.integrator);

                let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();

                for seed in &scene.initial_seeds {
                    let x0: Vec3 = Vec3::from(seed.x);
                    let points = integrate_trajectory(Aizawa, &params, x0, cfg);
                    trajectories.push(points.into_iter().map(Into::into).collect());
                }

                let js_val = serde_wasm_bindgen::to_value(&trajectories)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))?;
                Ok(js_val)
            }
            SystemId::Thomas => {
                let params = parse_thomas_params(&scene.params)
                    .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
                let cfg = integrator_spec_to_config(&scene.integrator);

                let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();

                for seed in &scene.initial_seeds {
                    let x0: Vec3 = Vec3::from(seed.x);
                    let points = integrate_trajectory(Thomas, &params, x0, cfg);
                    trajectories.push(points.into_iter().map(Into::into).collect());
                }

                let js_val = serde_wasm_bindgen::to_value(&trajectories)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))?;
                Ok(js_val)
            }
        }
    }

    /// Return a default Lorenz scene spec JSON string.
    #[wasm_bindgen]
    pub fn default_lorenz_scene(&self) -> String {
        let scene = SceneSpec::default_lorenz();
        serde_json::to_string(&scene).unwrap_or_else(|_| "{}".to_string())
    }

    /// Return a default Rössler scene spec JSON string.
    #[wasm_bindgen]
    pub fn default_rossler_scene(&self) -> String {
        let scene = SceneSpec::default_rossler();
        serde_json::to_string(&scene).unwrap_or_else(|_| "{}".to_string())
    }

    /// Return a default Aizawa scene spec JSON string.
    #[wasm_bindgen]
    pub fn default_aizawa_scene(&self) -> String {
        let scene = SceneSpec::default_aizawa();
        serde_json::to_string(&scene).unwrap_or_else(|_| "{}".to_string())
    }

    /// Return a default Thomas scene spec JSON string.
    #[wasm_bindgen]
    pub fn default_thomas_scene(&self) -> String {
        let scene = SceneSpec::default_thomas();
        serde_json::to_string(&scene).unwrap_or_else(|_| "{}".to_string())
    }
}

// --- Parameter parsers -------------------------------------------------------

fn parse_lorenz_params(v: &Value) -> Result<LorenzParams, String> {
    let sigma = v.get("sigma").and_then(Value::as_f64).unwrap_or(10.0) as f32;
    let rho = v.get("rho").and_then(Value::as_f64).unwrap_or(28.0) as f32;
    let beta = v
        .get("beta")
        .and_then(Value::as_f64)
        .unwrap_or(8.0 / 3.0) as f32;

    Ok(LorenzParams { sigma, rho, beta })
}

fn parse_rossler_params(v: &Value) -> Result<RosslerParams, String> {
    let a = v.get("a").and_then(Value::as_f64).unwrap_or(0.2) as f32;
    let b = v.get("b").and_then(Value::as_f64).unwrap_or(0.2) as f32;
    let c = v.get("c").and_then(Value::as_f64).unwrap_or(5.7) as f32;

    Ok(RosslerParams { a, b, c })
}

fn parse_aizawa_params(v: &Value) -> Result<AizawaParams, String> {
    let a = v.get("a").and_then(Value::as_f64).unwrap_or(0.95) as f32;
    let b = v.get("b").and_then(Value::as_f64).unwrap_or(0.7) as f32;
    let c = v.get("c").and_then(Value::as_f64).unwrap_or(0.6) as f32;
    let d = v.get("d").and_then(Value::as_f64).unwrap_or(3.5) as f32;
    let e = v.get("e").and_then(Value::as_f64).unwrap_or(0.25) as f32;
    let f = v.get("f").and_then(Value::as_f64).unwrap_or(0.1) as f32;

    Ok(AizawaParams { a, b, c, d, e, f })
}

fn parse_thomas_params(v: &Value) -> Result<ThomasParams, String> {
    let b = v
        .get("b")
        .and_then(Value::as_f64)
        .unwrap_or(0.208186) as f32;

    Ok(ThomasParams { b })
}
