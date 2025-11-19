mod lorenz;

pub use lorenz::{Lorenz, LorenzParams};

use crate::Vec3;

pub trait System3 {
    type Params: Copy;

    fn name() -> &'static str;

    fn default_params() -> Self::Params;

    fn f(t: f32, x: &Vec3, params: &Self::Params) -> Vec3;
}

