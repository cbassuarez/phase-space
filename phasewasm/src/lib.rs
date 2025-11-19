use wasm_bindgen::prelude::*;
use phasecore::{SceneSpec, Vec3, integrate_trajectory};
use phasecore::integrator::IntegratorConfig;
use phasecore::systems::{Lorenz, LorenzParams};
use serde_json::Value;

#[wasm_bindgen(start)]
pub fn start() {
    // Better panic messages in debug builds
    console_error_panic_hook::set_once();
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
    phasecore::scene::SystemId::Lorenz => {
        let params = parse_lorenz_params(&scene.params)
            .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
        let cfg: IntegratorConfig = scene.integrator.clone().into();

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
}
    }

    /// Return a default Lorenz scene spec JSON string.
    #[wasm_bindgen]
    pub fn default_lorenz_scene(&self) -> String {
        let scene = SceneSpec::default_lorenz();
        serde_json::to_string(&scene).unwrap_or_else(|_| "{}".to_string())
    }
}

fn parse_lorenz_params(v: &Value) -> Result<LorenzParams, String> {
    let sigma = v.get("sigma")
        .and_then(Value::as_f64)
        .unwrap_or(10.0) as f32;
    let rho = v.get("rho")
        .and_then(Value::as_f64)
        .unwrap_or(28.0) as f32;
    let beta = v.get("beta")
        .and_then(Value::as_f64)
        .unwrap_or(8.0 / 3.0) as f32;

    Ok(LorenzParams { sigma, rho, beta })
}

