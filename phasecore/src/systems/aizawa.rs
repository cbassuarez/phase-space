// phasecore/src/systems/aizawa.rs
use crate::vec3::Vec3;
use super::System3;

/// Aizawa attractor parameters.
///
/// Canonical "pretty" set:
///   a = 0.95, b = 0.7, c = 0.6,
///   d = 3.5,  e = 0.25, f = 0.1
#[derive(Debug, Clone, Copy)]
pub struct AizawaParams {
    pub a: f32,
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
    pub f: f32,
}

impl Default for AizawaParams {
    fn default() -> Self {
        Self {
            a: 0.95,
            b: 0.7,
            c: 0.6,
            d: 3.5,
            e: 0.25,
            f: 0.1,
        }
    }
}

#[derive(Default)]
pub struct Aizawa;

impl System3 for Aizawa {
    type Params = AizawaParams;

    fn name() -> &'static str {
        "aizawa"
    }

    fn default_params() -> Self::Params {
        AizawaParams::default()
    }

    fn f(_t: f32, x: &Vec3, p: &Self::Params) -> Vec3 {
        let xx = x.x;
        let yy = x.y;
        let zz = x.z;

        let r2 = xx * xx + yy * yy;

        let dx = (zz - p.b) * xx - p.d * yy;
        let dy = p.d * xx + (zz - p.b) * yy;
        let dz = p.c + p.a * zz - (zz * zz * zz) / 3.0
            - r2 * (1.0 + p.e * zz)
            + p.f * zz * xx * xx * xx;

        Vec3::new(dx, dy, dz)
    }
}

