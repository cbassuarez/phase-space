use crate::{Vec3, integrator::IntegratorConfig};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SystemId {
    Lorenz,
    // TODO: add Rossler, Aizawa, Thomas, Custom1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ViewMode {
    Mode3d,
    Mode2d,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Plane {
    Xy,
    Yz,
    Xz,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Palette {
    Plasma,
    Viridis,
    Mono,
    Rainbow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Background {
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSpec {
    pub theta: f32,
    pub phi: f32,
    pub r: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialSeed {
    pub x: [f32; 3],
    #[serde(default)]
    pub color_index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegratorSpec {
    pub dt: f32,
    pub steps: usize,
    #[serde(default)]
    pub discard_initial: Option<usize>,
    #[serde(default = "default_max_radius")]
    pub max_radius: f32,
}

fn default_max_radius() -> f32 {
    1000.0
}

impl From<IntegratorSpec> for IntegratorConfig {
    fn from(spec: IntegratorSpec) -> Self {
        Self {
            dt: spec.dt,
            steps: spec.steps,
            discard_initial: spec.discard_initial.unwrap_or(1000),
            max_radius: spec.max_radius,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewSpec {
    pub mode: ViewMode,
    #[serde(default)]
    pub plane: Option<Plane>,
    pub camera: CameraSpec,
    pub palette: Palette,
    pub background: Background,
    pub point_size: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneSpec {
    #[serde(default)]
    pub id: Option<String>,
    pub system: SystemId,
    pub params: serde_json::Value,
    pub initial_seeds: Vec<InitialSeed>,
    pub integrator: IntegratorSpec,
    pub view: ViewSpec,
    #[serde(default)]
    pub random_seed: Option<u64>,
}

impl SceneSpec {
    pub fn default_lorenz() -> Self {
        use crate::systems::{Lorenz, LorenzParams};

        let params = LorenzParams::default();
        let params_json = serde_json::to_value(params_to_json_lorenz(&params)).unwrap();

        Self {
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
}

/// Helper: we keep this simple for now; each system can define its own param struct → json mapping.
///
/// For Lorenz we just forward the fields; later we can add a trait.
fn params_to_json_lorenz(p: &crate::systems::LorenzParams) -> serde_json::Value {
    serde_json::json!({
        "sigma": p.sigma,
        "rho": p.rho,
        "beta": p.beta,
    })
}

