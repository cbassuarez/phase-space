// phasecore/src/systems/rossler.rs
use crate::vec3::Vec3;
use super::System3;

/// Rössler attractor parameters.
///
/// Canonical pretty set: a = 0.2, b = 0.2, c = 5.7
#[derive(Debug, Clone, Copy)]
pub struct RosslerParams {
    pub a: f32,
    pub b: f32,
    pub c: f32,
}

impl Default for RosslerParams {
    fn default() -> Self {
        Self {
            a: 0.2,
            b: 0.2,
            c: 5.7,
        }
    }
}

pub struct Rossler;

impl System3 for Rossler {
    type Params = RosslerParams;

    fn name() -> &'static str {
        "rossler"
    }

    fn default_params() -> Self::Params {
        RosslerParams::default()
    }

    fn f(_t: f32, x: &Vec3, p: &Self::Params) -> Vec3 {
        let dx = -x.y - x.z;
        let dy = x.x + p.a * x.y;
        let dz = p.b + x.z * (x.x - p.c);

        Vec3::new(dx, dy, dz)
    }
}

