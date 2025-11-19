use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand};

use phasecore::{SceneSpec, Vec3, integrate_trajectory};
use phasecore::integrator::IntegratorConfig;
use phasecore::scene::SystemId;
use phasecore::systems::{Lorenz, LorenzParams};
use image::{RgbImage, Rgb};

#[derive(Parser, Debug)]
#[command(name = "phasecli", version, about = "Phase-space toy CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Print a default Lorenz scene JSON to stdout
    DefaultLorenz,
    /// Render a scene JSON file to a PNG
    Render {
        /// Path to scene JSON file
        #[arg(short, long)]
        scene: PathBuf,
        /// Output PNG path
        #[arg(short, long)]
        out: PathBuf,
        /// Image size (square)
        #[arg(long, default_value_t = 1024)]
        size: u32,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::DefaultLorenz => {
            let scene = SceneSpec::default_lorenz();
            let text = serde_json::to_string_pretty(&scene)?;
            println!("{text}");
        }
        Commands::Render { scene, out, size } => {
            let text = fs::read_to_string(scene)?;
            let spec: SceneSpec = serde_json::from_str(&text)?;

            render_scene_to_png(&spec, &out, size)?;
        }
    }

    Ok(())
}

fn render_scene_to_png(scene: &SceneSpec, out: &PathBuf, size: u32) -> Result<()> {
    let cfg: IntegratorConfig = scene.integrator.clone().into();

    let mut trajectories: Vec<Vec<Vec3>> = Vec::new();

    match scene.system {
        SystemId::Lorenz => {
            let params = parse_lorenz_params(&scene.params)?;
            for seed in &scene.initial_seeds {
                let x0 = Vec3::from(seed.x);
                let pts = integrate_trajectory(Lorenz, &params, x0, cfg);
                trajectories.push(pts);
            }
        }
    }

    let mut img = RgbImage::new(size, size);

    // Find bounds for simple auto-scaling
    let mut min = Vec3::new(f32::MAX, f32::MAX, f32::MAX);
    let mut max = Vec3::new(f32::MIN, f32::MIN, f32::MIN);

    for traj in &trajectories {
        for p in traj {
            if p.x < min.x { min.x = p.x; }
            if p.y < min.y { min.y = p.y; }
            if p.z < min.z { min.z = p.z; }

            if p.x > max.x { max.x = p.x; }
            if p.y > max.y { max.y = p.y; }
            if p.z > max.z { max.z = p.z; }
        }
    }

    let scale_x = (size as f32 * 0.9) / (max.x - min.x).max(1e-5);
    let scale_y = (size as f32 * 0.9) / (max.y - min.y).max(1e-5);
    let scale = scale_x.min(scale_y);
    let cx = (min.x + max.x) * 0.5;
    let cy = (min.y + max.y) * 0.5;

    // Dark background
    for px in img.pixels_mut() {
        *px = Rgb([5, 5, 15]);
    }

    for (ti, traj) in trajectories.iter().enumerate() {
        let color = color_for_index(ti as u32);

        for p in traj {
            let x = ((p.x - cx) * scale + (size as f32) * 0.5) as i32;
            let y = ((p.y - cy) * scale + (size as f32) * 0.5) as i32;

            if x >= 0 && x < size as i32 && y >= 0 && y < size as i32 {
                let (ux, uy) = (x as u32, y as u32);
                img.put_pixel(ux, uy, color);
            }
        }
    }

    img.save(out)?;

    Ok(())
}

fn color_for_index(idx: u32) -> Rgb<u8> {
    match idx % 4 {
        0 => Rgb([240, 120, 80]),
        1 => Rgb([80, 200, 240]),
        2 => Rgb([200, 160, 255]),
        _ => Rgb([255, 230, 120]),
    }
}

fn parse_lorenz_params(v: &serde_json::Value) -> Result<LorenzParams> {
    let sigma = v.get("sigma").and_then(|x| x.as_f64()).unwrap_or(10.0) as f32;
    let rho = v.get("rho").and_then(|x| x.as_f64()).unwrap_or(28.0) as f32;
    let beta = v.get("beta").and_then(|x| x.as_f64()).unwrap_or(8.0 / 3.0) as f32;

    Ok(LorenzParams { sigma, rho, beta })
}

