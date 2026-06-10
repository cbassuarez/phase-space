// phasecore/src/systems/chua.rs
use crate::vec3::Vec3;
use super::System3;

/// Chua's circuit (dimensionless form) — the dual-scroll attractor.
///
///   dx/dt = alpha * (y - x - g(x))
///   dy/dt = x - y + z
///   dz/dt = -beta * y
///
/// where `g(x)` is the piecewise-linear Chua-diode characteristic:
///
///   g(x) = m1*x + 0.5*(m0 - m1) * (|x + bp| - |x - bp|)
///
/// `m0` is the inner-segment slope (|x| < bp), `m1` the outer-segment
/// slope (|x| > bp), and `bp` the breakpoint. The kink at |x| = bp is
/// the mechanism behind the scroll-to-scroll snap: trajectories spiral
/// out on one scroll, cross the breakpoint, and are flung into the
/// opposite scroll's basin.
///
/// Canonical "dual scroll" set (Matsumoto / Chua / Komuro 1985):
///   alpha = 15.6
///   beta  = 28.0
///   m0    = -8/7  ≈ -1.142857
///   m1    = -5/7  ≈ -0.714286
///   bp    = 1.0
///
/// Lowering alpha sweeps the attractor through a period-doubling cascade:
///   alpha ≈ 6.0  — period-1 limit cycle
///   alpha ≈ 7.5  — period-2 / period-4
///   alpha ≈ 8.4  — spiral chaos (single scroll, one basin)
///   alpha ≈ 9.0  — single scroll, dense
///   alpha ≈ 15.6 — full dual scroll (both basins linked)
#[derive(Debug, Clone, Copy)]
pub struct ChuaParams {
    pub alpha: f32,
    pub beta: f32,
    /// Inner-segment slope of the Chua diode (|x| < bp).
    pub m0: f32,
    /// Outer-segment slope of the Chua diode (|x| > bp).
    pub m1: f32,
    /// Breakpoint of the piecewise-linear diode.
    pub bp: f32,
}

impl Default for ChuaParams {
    fn default() -> Self {
        Self {
            alpha: 15.6,
            beta: 28.0,
            m0: -8.0 / 7.0,
            m1: -5.0 / 7.0,
            bp: 1.0,
        }
    }
}

#[inline]
fn chua_diode(x: f32, m0: f32, m1: f32, bp: f32) -> f32 {
    // Piecewise-linear, C0-continuous. Equivalent to:
    //   |x| < bp        ->  m0 * x
    //   x  >  bp        ->  m1 * x + (m0 - m1) * bp
    //   x  < -bp        ->  m1 * x - (m0 - m1) * bp
    m1 * x + 0.5 * (m0 - m1) * ((x + bp).abs() - (x - bp).abs())
}

pub struct Chua;

impl System3 for Chua {
    type Params = ChuaParams;

    fn name() -> &'static str {
        "chua"
    }

    fn default_params() -> Self::Params {
        ChuaParams::default()
    }

    fn f(_t: f32, x: &Vec3, p: &Self::Params) -> Vec3 {
        let gx = chua_diode(x.x, p.m0, p.m1, p.bp);
        let dx = p.alpha * (x.y - x.x - gx);
        let dy = x.x - x.y + x.z;
        let dz = -p.beta * x.y;
        Vec3::new(dx, dy, dz)
    }
}
