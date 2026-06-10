use std::collections::BTreeMap;
use std::time::Instant;

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::custom::{CompileErrors, CustomSystem};
use crate::expr::{compile as compile_expr, ExprError};
use crate::integrator::IntegratorConfig;
use crate::scene::{IntegratorSpec, SceneSpec, SystemId};
use crate::systems::{
    Aizawa, AizawaParams, Chua, ChuaParams, Lorenz, LorenzParams, Rossler, RosslerParams, Thomas,
    ThomasParams,
};
use crate::{integrate_trajectory, Vec3};

pub type Trajectory = Vec<[f32; 3]>;
pub type Trajectories = Vec<Trajectory>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrateSceneReport {
    pub trajectories: Trajectories,
    pub elapsed_ms: u128,
    pub points: usize,
    pub threads: usize,
    pub backend: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttractorValidation {
    pub ok: bool,
    pub errors: AttractorValidationErrors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttractorValidationErrors {
    pub dx: Option<AttractorExprError>,
    pub dy: Option<AttractorExprError>,
    pub dz: Option<AttractorExprError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttractorExprError {
    pub message: String,
    pub pos: usize,
}

fn integrator_spec_to_config(spec: &IntegratorSpec) -> IntegratorConfig {
    IntegratorConfig {
        dt: spec.dt,
        steps: spec.steps as usize,
        discard_initial: spec.discard_initial.unwrap_or(0) as usize,
        max_radius: spec.max_radius,
    }
}

fn thread_count() -> usize {
    #[cfg(not(target_arch = "wasm32"))]
    {
        rayon::current_num_threads()
    }
    #[cfg(target_arch = "wasm32")]
    {
        1
    }
}

fn backend_label() -> &'static str {
    #[cfg(not(target_arch = "wasm32"))]
    {
        "native-rust-rayon"
    }
    #[cfg(target_arch = "wasm32")]
    {
        "wasm-rust"
    }
}

fn integrate_builtin<S>(scene: &SceneSpec, params: S::Params, cfg: IntegratorConfig) -> Trajectories
where
    S: crate::systems::System3 + Default + Sync,
    S::Params: Copy + Send + Sync,
{
    #[cfg(not(target_arch = "wasm32"))]
    {
        scene
            .initial_seeds
            .par_iter()
            .map(|seed| {
                let x0: Vec3 = Vec3::from(seed.x);
                integrate_trajectory(S::default(), &params, x0, cfg)
                    .into_iter()
                    .map(Into::into)
                    .collect()
            })
            .collect()
    }

    #[cfg(target_arch = "wasm32")]
    {
        scene
            .initial_seeds
            .iter()
            .map(|seed| {
                let x0: Vec3 = Vec3::from(seed.x);
                integrate_trajectory(S::default(), &params, x0, cfg)
                    .into_iter()
                    .map(Into::into)
                    .collect()
            })
            .collect()
    }
}

fn integrate_custom(scene: &SceneSpec, system: &CustomSystem, cfg: IntegratorConfig) -> Trajectories {
    #[cfg(not(target_arch = "wasm32"))]
    {
        scene
            .initial_seeds
            .par_iter()
            .map(|seed| {
                let x0: Vec3 = Vec3::from(seed.x);
                system.integrate(x0, cfg).into_iter().map(Into::into).collect()
            })
            .collect()
    }

    #[cfg(target_arch = "wasm32")]
    {
        scene
            .initial_seeds
            .iter()
            .map(|seed| {
                let x0: Vec3 = Vec3::from(seed.x);
                system.integrate(x0, cfg).into_iter().map(Into::into).collect()
            })
            .collect()
    }
}

pub fn integrate_scene(scene: SceneSpec) -> Result<IntegrateSceneReport, String> {
    let started = Instant::now();
    let cfg = integrator_spec_to_config(&scene.integrator);
    let trajectories = match scene.system {
        SystemId::Lorenz => {
            let params = parse_lorenz_params(&scene.params)?;
            integrate_builtin::<Lorenz>(&scene, params, cfg)
        }
        SystemId::Rossler => {
            let params = parse_rossler_params(&scene.params)?;
            integrate_builtin::<Rossler>(&scene, params, cfg)
        }
        SystemId::Aizawa => {
            let params = parse_aizawa_params(&scene.params)?;
            integrate_builtin::<Aizawa>(&scene, params, cfg)
        }
        SystemId::Thomas => {
            let params = parse_thomas_params(&scene.params)?;
            integrate_builtin::<Thomas>(&scene, params, cfg)
        }
        SystemId::Chua => {
            let params = parse_chua_params(&scene.params)?;
            integrate_builtin::<Chua>(&scene, params, cfg)
        }
        SystemId::Custom => {
            let custom = scene
                .custom
                .as_ref()
                .ok_or_else(|| "Custom system requires equations".to_string())?;
            let params = parse_param_map(&scene.params);
            let system = CustomSystem::compile(
                &custom.equations.dx,
                &custom.equations.dy,
                &custom.equations.dz,
                &params,
            )
            .map_err(|e| format!("Equation error - {}", first_error_msg(&e)))?;
            integrate_custom(&scene, &system, cfg)
        }
    };

    let points = trajectories.iter().map(Vec::len).sum();
    Ok(IntegrateSceneReport {
        trajectories,
        elapsed_ms: started.elapsed().as_millis(),
        points,
        threads: thread_count(),
        backend: backend_label(),
    })
}

pub fn validate_attractor_input(json: &str) -> Result<AttractorValidation, String> {
    let v: Value = serde_json::from_str(json).map_err(|e| format!("Parse error: {e}"))?;
    let eq = v.get("equations").cloned().unwrap_or(Value::Null);
    let dx = eq.get("dx").and_then(Value::as_str).unwrap_or("");
    let dy = eq.get("dy").and_then(Value::as_str).unwrap_or("");
    let dz = eq.get("dz").and_then(Value::as_str).unwrap_or("");
    let params = parse_param_map(v.get("params").unwrap_or(&Value::Null));
    let names: Vec<String> = params.keys().cloned().collect();

    let errors = AttractorValidationErrors {
        dx: expr_err(compile_expr(dx, &names)),
        dy: expr_err(compile_expr(dy, &names)),
        dz: expr_err(compile_expr(dz, &names)),
    };
    let ok = errors.dx.is_none() && errors.dy.is_none() && errors.dz.is_none();
    Ok(AttractorValidation { ok, errors })
}

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

fn expr_err(r: Result<crate::expr::Program, ExprError>) -> Option<AttractorExprError> {
    match r {
        Ok(_) => None,
        Err(e) => Some(AttractorExprError {
            message: e.message,
            pos: e.pos,
        }),
    }
}

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
