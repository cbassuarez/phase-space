// phasecore/src/systems/thomas.rs
use crate::vec3::Vec3;
use super::System3;

/// Thomas cyclic attractor parameters.
///
/// Canonical pretty set: b ≈ 0.208186
#[derive(Debug, Clone, Copy)]
pub struct ThomasParams {
    pub b: f32,
}

impl Default for ThomasParams {
    fn default() -> Self {
        Self { b: 0.208186 }
    }
}

pub struct Thomas;

impl System3 for Thomas {
    type Params = ThomasParams;

    fn name() -> &'static str {
        "thomas"
    }

    fn default_params() -> Self::Params {
        ThomasParams::default()
    }

    fn f(_t: f32, x: &Vec3, p: &Self::Params) -> Vec3 {
        let dx = (x.y).sin() - p.b * x.x;
        let dy = (x.z).sin() - p.b * x.y;
        let dz = (x.x).sin() - p.b * x.z;

        Vec3::new(dx, dy, dz)
    }
}

