use crate::vec3::Vec3;
use crate::systems::System3;

#[derive(Debug, Clone, Copy)]
pub struct IntegratorConfig {
    pub dt: f32,
    pub steps: usize,
    pub discard_initial: usize,
    pub max_radius: f32,
}

impl Default for IntegratorConfig {
    fn default() -> Self {
        Self {
            dt: 0.01,
            steps: 50_000,
            discard_initial: 1_000,
            max_radius: 1_000.0,
        }
    }
}

/// Fixed-step RK4 integrator for 3D systems.
pub fn integrate_trajectory<S>(
    _system: S,
    params: &S::Params,
    x0: Vec3,
    cfg: IntegratorConfig,
) -> Vec<Vec3>
where
    S: System3,
{
    let mut x = x0;
    let mut t = 0.0_f32;
    let dt = cfg.dt;

    let mut out = Vec::with_capacity(cfg.steps.saturating_sub(cfg.discard_initial));

    for step in 0..cfg.steps {
        // Bail-out if diverging
        if x.norm() > cfg.max_radius {
            break;
        }

        let k1 = S::f(t, &x, params);
        let k2 = S::f(t + 0.5 * dt, &(x + k1 * (0.5 * dt)), params);
        let k3 = S::f(t + 0.5 * dt, &(x + k2 * (0.5 * dt)), params);
        let k4 = S::f(t + dt, &(x + k3 * dt), params);

        let dx = (k1 + k2 * 2.0 + k3 * 2.0 + k4) * (dt / 6.0);
        x += dx;
        t += dt;

        if step >= cfg.discard_initial {
            out.push(x);
        }
    }

    out
}

