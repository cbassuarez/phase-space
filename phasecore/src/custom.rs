//! Runtime user-defined attractor: three compiled derivative expressions
//! evaluated by a fixed-step RK4 integrator. Parallels `integrate_trajectory`
//! for the built-in systems, but the derivative comes from compiled
//! `expr::Program`s with runtime parameters rather than a compile-time struct.

use std::collections::BTreeMap;

use crate::expr::{compile, ExprError, Program};
use crate::integrator::IntegratorConfig;
use crate::vec3::Vec3;

/// Per-equation compile errors (any may be `None` if that one parsed).
#[derive(Debug, Clone, Default)]
pub struct CompileErrors {
    pub dx: Option<ExprError>,
    pub dy: Option<ExprError>,
    pub dz: Option<ExprError>,
}

impl CompileErrors {
    pub fn any(&self) -> bool {
        self.dx.is_some() || self.dy.is_some() || self.dz.is_some()
    }
}

pub struct CustomSystem {
    dx: Program,
    dy: Program,
    dz: Program,
    params: Vec<f32>,
}

impl CustomSystem {
    /// Compile the three derivative expressions against the parameter names.
    /// Parameter iteration order (BTreeMap = sorted keys) defines the index
    /// mapping used by the compiled programs, so values must be read the same
    /// way (they are — both derive from the same map).
    pub fn compile(
        dx: &str,
        dy: &str,
        dz: &str,
        params: &BTreeMap<String, f32>,
    ) -> Result<CustomSystem, CompileErrors> {
        let names: Vec<String> = params.keys().cloned().collect();
        let cx = compile(dx, &names);
        let cy = compile(dy, &names);
        let cz = compile(dz, &names);
        if cx.is_err() || cy.is_err() || cz.is_err() {
            return Err(CompileErrors {
                dx: cx.err(),
                dy: cy.err(),
                dz: cz.err(),
            });
        }
        Ok(CustomSystem {
            dx: cx.unwrap(),
            dy: cy.unwrap(),
            dz: cz.unwrap(),
            params: params.values().copied().collect(),
        })
    }

    #[inline]
    fn f(&self, t: f32, x: &Vec3) -> Vec3 {
        let vars = [x.x, x.y, x.z, t];
        Vec3::new(
            self.dx.eval(&vars, &self.params),
            self.dy.eval(&vars, &self.params),
            self.dz.eval(&vars, &self.params),
        )
    }

    pub fn integrate(&self, x0: Vec3, cfg: IntegratorConfig) -> Vec<Vec3> {
        let mut x = x0;
        let mut t = 0.0_f32;
        let dt = cfg.dt;
        let mut out = Vec::with_capacity(cfg.steps.saturating_sub(cfg.discard_initial));

        for step in 0..cfg.steps {
            // Bail on divergence OR non-finite (NaN slips past the radius test
            // because NaN comparisons are always false).
            if !x.x.is_finite() || !x.y.is_finite() || !x.z.is_finite() || x.norm() > cfg.max_radius
            {
                break;
            }

            let k1 = self.f(t, &x);
            let k2 = self.f(t + 0.5 * dt, &(x + k1 * (0.5 * dt)));
            let k3 = self.f(t + 0.5 * dt, &(x + k2 * (0.5 * dt)));
            let k4 = self.f(t + dt, &(x + k3 * dt));

            let dx = (k1 + k2 * 2.0 + k3 * 2.0 + k4) * (dt / 6.0);
            x += dx;
            t += dt;

            if step >= cfg.discard_initial {
                out.push(x);
            }
        }

        out
    }
}
