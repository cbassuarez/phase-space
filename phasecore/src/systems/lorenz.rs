use crate::vec3::Vec3;
use super::System3;

#[derive(Debug, Clone, Copy)]
pub struct LorenzParams {
    pub sigma: f32,
    pub rho: f32,
    pub beta: f32,
}

impl Default for LorenzParams {
    fn default() -> Self {
        Self {
            sigma: 10.0,
            rho: 28.0,
            beta: 8.0 / 3.0,
        }
    }
}

#[derive(Default)]
pub struct Lorenz;

impl System3 for Lorenz {
    type Params = LorenzParams;

    fn name() -> &'static str {
        "lorenz"
    }

    fn default_params() -> Self::Params {
        LorenzParams::default()
    }

    fn f(_t: f32, x: &Vec3, p: &Self::Params) -> Vec3 {
        // Classic Lorenz equations
        let dx = p.sigma * (x.y - x.x);
        let dy = x.x * (p.rho - x.z) - x.y;
        let dz = x.x * x.y - p.beta * x.z;

        Vec3::new(dx, dy, dz)
    }
}
