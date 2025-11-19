// phasecore/src/systems/mod.rs

mod lorenz;
mod rossler;
mod aizawa;
mod thomas;

pub use lorenz::{Lorenz, LorenzParams};
pub use rossler::{Rossler, RosslerParams};
pub use aizawa::{Aizawa, AizawaParams};
pub use thomas::{Thomas, ThomasParams};

use crate::Vec3;

pub trait System3 {
    type Params: Copy;

    fn name() -> &'static str;
    fn default_params() -> Self::Params;
    fn f(t: f32, x: &Vec3, params: &Self::Params) -> Vec3;
}
