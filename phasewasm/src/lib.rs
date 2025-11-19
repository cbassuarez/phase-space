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
        steps: spec.steps as usize,
        discard_initial: spec.discard_initial.unwrap_or(0) as usize,
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
