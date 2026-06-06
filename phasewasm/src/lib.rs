// phasewasm/src/lib.rs

use std::collections::BTreeMap;

use phasecore::custom::{CompileErrors, CustomSystem};
use phasecore::expr::{compile as compile_expr, ExprError};
use phasecore::integrator::IntegratorConfig;
use phasecore::scene::{IntegratorSpec, SystemId};
use phasecore::systems::{
    Aizawa, AizawaParams, Chua, ChuaParams, Lorenz, LorenzParams, Rossler, RosslerParams, Thomas,
    ThomasParams,
};
use phasecore::{integrate_trajectory, SceneSpec, Vec3};
use serde_json::Value;
use serde_wasm_bindgen;
use wasm_bindgen::prelude::*;

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

fn integrate_scene_spec(scene: SceneSpec) -> Result<JsValue, JsValue> {
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

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
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

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
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

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
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

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
        }
        SystemId::Chua => {
            let params = parse_chua_params(&scene.params)
                .map_err(|e| JsValue::from_str(&format!("Param error: {e}")))?;
            let cfg = integrator_spec_to_config(&scene.integrator);

            let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();

            for seed in &scene.initial_seeds {
                let x0: Vec3 = Vec3::from(seed.x);
                let points = integrate_trajectory(Chua, &params, x0, cfg);
                trajectories.push(points.into_iter().map(Into::into).collect());
            }

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
        }
        SystemId::Custom => {
            let custom = scene
                .custom
                .as_ref()
                .ok_or_else(|| JsValue::from_str("Custom system requires equations"))?;
            let params = parse_param_map(&scene.params);
            let system = CustomSystem::compile(
                &custom.equations.dx,
                &custom.equations.dy,
                &custom.equations.dz,
                &params,
            )
            .map_err(|e| JsValue::from_str(&format!("Equation error — {}", first_error_msg(&e))))?;
            let cfg = integrator_spec_to_config(&scene.integrator);

            let mut trajectories: Vec<Vec<[f32; 3]>> = Vec::new();
            for seed in &scene.initial_seeds {
                let x0: Vec3 = Vec3::from(seed.x);
                let points = system.integrate(x0, cfg);
                trajectories.push(points.into_iter().map(Into::into).collect());
            }

            serde_wasm_bindgen::to_value(&trajectories)
                .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
        }
    }
}

/// Parse a `{ name: number, ... }` JSON object into a sorted param map.
fn parse_param_map(v: &Value) -> BTreeMap<String, f32> {
    let mut m = BTreeMap::new();
    if let Some(obj) = v.as_object() {
        for (k, val) in obj {
            if let Some(n) = val.as_f64() {
                m.insert(k.clone(), n as f32);
            }
        }
    }
    m
}

fn first_error_msg(e: &CompileErrors) -> String {
    if let Some(err) = &e.dx {
        return format!("dx: {}", err.message);
    }
    if let Some(err) = &e.dy {
        return format!("dy: {}", err.message);
    }
    if let Some(err) = &e.dz {
        return format!("dz: {}", err.message);
    }
    "invalid equation".to_string()
}

fn expr_err_json(r: Result<phasecore::expr::Program, ExprError>) -> Value {
    match r {
        Ok(_) => Value::Null,
        Err(e) => serde_json::json!({ "message": e.message, "pos": e.pos }),
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

        integrate_scene_spec(scene)
    }

    /// Integrate a scene described by a JavaScript SceneSpec object.
    #[wasm_bindgen]
    pub fn integrate_scene_value(&self, scene_value: JsValue) -> Result<JsValue, JsValue> {
        let scene: SceneSpec = serde_wasm_bindgen::from_value(scene_value)
            .map_err(|e| JsValue::from_str(&format!("Scene value error: {e}")))?;

        integrate_scene_spec(scene)
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

    /// Validate user-defined attractor equations. Input JSON:
    /// `{ "equations": { "dx", "dy", "dz" }, "params": { name: number } }`.
    /// Returns `{ ok: bool, errors: { dx, dy, dz } }` where each error is
    /// `null` (valid) or `{ message, pos }`. The same parser the integrator
    /// uses, so "valid here" means "runnable" — reused by the modal and CI.
    #[wasm_bindgen]
    pub fn validate_attractor(&self, json: &str) -> Result<JsValue, JsValue> {
        let v: Value = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {e}")))?;
        let eq = v.get("equations").cloned().unwrap_or(Value::Null);
        let dx = eq.get("dx").and_then(Value::as_str).unwrap_or("");
        let dy = eq.get("dy").and_then(Value::as_str).unwrap_or("");
        let dz = eq.get("dz").and_then(Value::as_str).unwrap_or("");
        let params = parse_param_map(v.get("params").unwrap_or(&Value::Null));
        let names: Vec<String> = params.keys().cloned().collect();

        let errors = serde_json::json!({
            "dx": expr_err_json(compile_expr(dx, &names)),
            "dy": expr_err_json(compile_expr(dy, &names)),
            "dz": expr_err_json(compile_expr(dz, &names)),
        });
        let ok = errors["dx"].is_null() && errors["dy"].is_null() && errors["dz"].is_null();
        let out = serde_json::json!({ "ok": ok, "errors": errors });
        serde_wasm_bindgen::to_value(&out)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
    }
}

// --- Parameter parsers -------------------------------------------------------

fn parse_lorenz_params(v: &Value) -> Result<LorenzParams, String> {
    let sigma = v.get("sigma").and_then(Value::as_f64).unwrap_or(10.0) as f32;
    let rho = v.get("rho").and_then(Value::as_f64).unwrap_or(28.0) as f32;
    let beta = v.get("beta").and_then(Value::as_f64).unwrap_or(8.0 / 3.0) as f32;

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
    let b = v.get("b").and_then(Value::as_f64).unwrap_or(0.19) as f32;

    Ok(ThomasParams { b })
}

fn parse_chua_params(v: &Value) -> Result<ChuaParams, String> {
    let alpha = v.get("alpha").and_then(Value::as_f64).unwrap_or(15.6) as f32;
    let beta = v.get("beta").and_then(Value::as_f64).unwrap_or(28.0) as f32;
    let m0 = v.get("m0").and_then(Value::as_f64).unwrap_or(-8.0 / 7.0) as f32;
    let m1 = v.get("m1").and_then(Value::as_f64).unwrap_or(-5.0 / 7.0) as f32;
    let bp = v.get("bp").and_then(Value::as_f64).unwrap_or(1.0) as f32;

    Ok(ChuaParams {
        alpha,
        beta,
        m0,
        m1,
        bp,
    })
}
