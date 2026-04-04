# phase-space 

> A strange-attractor sandbox and visual instrument: Rust integrator + WebGL renderer + sound-reactive camera playground.

![phase-space](docs/media/phase-space-version-badge.svg)

![Last commit](https://img.shields.io/github/last-commit/cbassuarez/phase-space)
![Open issues](https://img.shields.io/github/issues/cbassuarez/phase-space)
![Open PRs](https://img.shields.io/github/issues-pr/cbassuarez/phase-space)

![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)
![WASM](https://img.shields.io/badge/target-wasm32--unknown--unknown-563d7c)
![Node LTS](https://img.shields.io/badge/node-LTS-339933?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)




[![CI](https://github.com/cbassuarez/phase-space/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/cbassuarez/phase-space/actions/workflows/deploy-web.yml)
[![GitHub Pages](https://img.shields.io/badge/pages-live-0d1117?logo=github)](https://cbassuarez.github.io/phase-space/)
![License](https://img.shields.io/badge/license-see%20LICENSE-informational)

---

<!-- Hero image / GIF placeholder -->

<!--
![phase-space viewer hero](docs/media/phase-space-hero.png)
-->

## Live viewer

**▶ Try it in your browser**

* **Live viewer:** [https://cbassuarez.github.io/phase-space/](https://cbassuarez.github.io/phase-space/)
* Best on a desktop browser with WebGL and microphone access enabled.
* Use it as:

  * a **toy** (poke the parameters and watch),
  * a **visualizer** (feed it audio),
  * or a **reference instrument** while you work on other systems.

---

## What is this?

`phase-space` is both:

* a **playable instrument** for classic strange attractors, light, and sound, and
* a **Rust + WebAssembly engine** that integrates and renders those systems with a clean JSON scene model.

At a high level:

* **`phasecore/`** – Rust core for dynamical systems, integrators, and `SceneSpec`.
* **`phasewasm/`** – `wasm-bindgen` bridge exposing the engine to the browser.
* **`web/`** – React + Vite + Three.js viewer: “Instrument Panel” UI, camera modes, render styles, and audio I/O.

The viewer that runs on GitHub Pages is the same one you get when you run `npm run dev` in `web/`.

---

## Features

### Systems & scenes

* Built-in systems:

  * **Lorenz**
  * **Rössler**
  * **Aizawa**
  * **Thomas**
* Each system ships with **pretty, balanced defaults** (not too chaotic, not too tame).
* Scenes are described by a single JSON structure, `SceneSpec`, which captures:

  * system type and parameters (e.g. `sigma`, `rho`, `beta` for Lorenz),
  * integration configuration (step size, steps, transient discard, safety radius),
  * initial seeds (starting points and palette indices),
  * camera + view mode,
  * color palette and background,
  * an optional random seed for reproducibility.

### Render modes

Multiple real-time rendering styles share the same scene, camera, and resolution controls:

| Mode             | Description                                       |
| ---------------- | ------------------------------------------------- |
| **Cells**        | Clean, performant point cloud; baseline view.     |
| **Ribbon**       | Continuous band draped along the trajectory.      |
| **Photon Weave** | Luminous filaments woven along the attractor.     |
| **Caustics**     | Screen-space light density / spill, caustic-like. |

Modes are designed to be:

* **Consistent** – they all respect the same scene/camera model and global resolution slider.
* **Composable** – you can switch modes mid-flight without resetting the system.
* **Mesmerizing** – tuned for “stare at this for a while” behavior.

### Camera modes

To make the output actually useful for visual work (not just screenshots), the viewer ships with camera behaviors such as:

* **Orbit** – classic orbit around the attractor; stable and predictable.
* **Path Rider** – camera rides along the trajectory, useful for “inside the attractor” POV.
* **Lobe Focus** – camera biases toward the active lobe / region of phase space.
* **Macro / Micro** – pushes the camera into very close or very distant views to highlight structure at different scales.

Camera configurations live inside `SceneSpec.view`, so presets can carry their own camera setups.

### Sound I/O (browser-based)

The viewer includes a minimal but powerful **I/O & Routing** section:

* **Input**

  * “Audio” toggle to enable microphone / device input.
  * Device dropdown (when supported) to pick an input device.
  * Channel selection that matches your environment (mono/stereo, or more when exposed by the browser).
* **Output**

  * Output device dropdown where supported (otherwise, system default).
* **Modulation**

  * Audio amplitude / band information can modulate:

    * camera parameters (e.g. radius, jitter),
    * render parameters (e.g. intensity, falloff) in safe, bounded ranges.

The goal is TouchDesigner-style routing without a sea of knobs: a few carefully chosen mappings that still feel deep.

---

## Scene model (`SceneSpec`)

Under the hood, everything is driven by a serializable scene model. Simplified:

```rust
// phasecore/src/scene.rs (conceptual)
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SystemId {
    Lorenz,
    Rossler,
    Aizawa,
    Thomas,
}

#[derive(Serialize, Deserialize)]
pub struct IntegratorSpec {
    pub dt: f32,
    pub steps: u32,
    #[serde(default)]
    pub discard_initial: Option<u32>,
    pub max_radius: f32,
}

#[derive(Serialize, Deserialize)]
pub struct SceneSpec {
    #[serde(default)]
    pub id: Option<String>,
    pub system: SystemId,
    pub params: serde_json::Value,       // system-specific fields
    pub initial_seeds: Vec<InitialSeed>, // starting points
    pub integrator: IntegratorSpec,
    pub view: ViewSpec,                  // camera, palette, background
    #[serde(default)]
    pub random_seed: Option<u64>,
}
```

The JSON representation looks like:

```jsonc
{
  "id": "lorenz-default",
  "system": "lorenz",
  "params": {
    "sigma": 10.0,
    "rho": 28.0,
    "beta": 2.6666667
  },
  "initial_seeds": [
    { "x": [0.1, 0.0, 0.0], "color_index": 0 },
    { "x": [0.1001, 0.0, 0.0], "color_index": 1 }
  ],
  "integrator": {
    "dt": 0.01,
    "steps": 50000,
    "discard_initial": 1000,
    "max_radius": 1000.0
  },
  "view": {
    "mode": "mode3d",
    "camera": { "theta": 0.8, "phi": 0.9, "r": 25.0 },
    "palette": "plasma",
    "background": "dark",
    "point_size": 1.0
  },
  "random_seed": 42
}
```

> ⚠️ Note: `SceneSpec` is documented here to make the engine understandable, but it’s still evolving. Treat it as an internal model rather than a stable public API.

---

## Project structure

This is a Cargo workspace plus a Vite web app:

```text
phase-space/
  phasecore/        # Rust core: systems, integrator, SceneSpec model
  phasewasm/        # Rust -> WebAssembly bridge via wasm-bindgen
  phasecli/         # CLI tools (early / experimental)
  web/              # React + Vite + Three.js viewer (Instrument Panel)
```

### `phasecore/` (Rust engine)

* Implements:

  * **Systems** – Lorenz, Rössler, Aizawa, Thomas.
  * **Integrator** – `IntegratorConfig` and `integrate_trajectory`.
  * **SceneSpec** – the full scene model described above.
* Designed to be **engine-first**: usable without the web viewer in other Rust contexts.

Very rough sketch:

```rust
use phasecore::{
    systems::{Lorenz, LorenzParams},
    integrator::{IntegratorConfig, integrate_trajectory},
    Vec3,
};

let params = LorenzParams::default();
let cfg = IntegratorConfig {
    dt: 0.01,
    steps: 50_000,
    discard_initial: 1_000,
    max_radius: 1000.0,
};
let x0 = Vec3::new(0.1, 0.0, 0.0);

let points = integrate_trajectory(Lorenz, &params, x0, cfg);
// `points` is a Vec<Vec3> with transient removed.
```

### `phasewasm/` (WASM bridge)

`phasewasm` exposes a small WebAssembly API to the viewer:

```rust
#[wasm_bindgen]
pub struct WasmEngine;

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmEngine {
        WasmEngine
    }

    /// Integrate a JSON SceneSpec and return trajectories as JS arrays.
    #[wasm_bindgen]
    pub fn integrate_scene(&self, scene_json: &str) -> Result<JsValue, JsValue> {
        // parse SceneSpec, run phasecore, serialize trajectories...
    }

    #[wasm_bindgen]
    pub fn default_lorenz_scene(&self) -> String { /* ... */ }

    #[wasm_bindgen]
    pub fn default_rossler_scene(&self) -> String { /* ... */ }

    #[wasm_bindgen]
    pub fn default_aizawa_scene(&self) -> String { /* ... */ }

    #[wasm_bindgen]
    pub fn default_thomas_scene(&self) -> String { /* ... */ }
}
```

On the TypeScript side, the viewer calls into `WasmEngine` to get trajectories and presets, then hands them off to Three.js renderers.

### `web/` (React + Vite + Three.js viewer)

The UI is an “Instrument Panel” with:

* **Top bar**

  * Wordmark `phase-space` or `p-s` (on very small screens).
  * Navigation:

    * `Viewer`
    * `Systems`
    * `Presets`
    * `Field Notes`
    * `Credits`
  * Version badge (tri-color pill, e.g. `phase-space vX.Y.Z • beta`).
  * GitHub link button.

* **Main layout**

  * Left: inspector / configuration cards (systems, render mode, I/O & Routing).
  * Right: WebGL viewer (max width, responsive).
  * Light theme by default, with accent colors echoing primary tri-color primaries (Red/Yellow/Blue) and neutral grays.

---

## Running the viewer locally

You don’t have to touch Rust to play with the toy.

```bash
# Clone
git clone https://github.com/phase-space/phase-space.git
cd phase-space

# Install web dependencies
cd web
npm install

# Run dev server
npm run dev
```

* Open the printed `http://localhost:5173` (or similar) URL.
* This gives you the same viewer as GitHub Pages, plus dev tools and console.

> Note: the WASM bundle produced by `phasewasm` is already wired into the `web/` app. If you change `phasecore` or `phasewasm`, follow the internal build instructions (e.g. using `wasm-pack`) in the contributing docs.

---

## Using audio I/O

In the **I/O & Routing** section of the inspector:

1. **Turn on audio input**

   * Flip the “Audio” toggle.
   * Grant microphone permissions to the page when prompted.
2. **Select input device**

   * Choose from the device dropdown (browser support varies).
   * Pick an input channel layout that matches your environment.
3. **(When available) Select output device**

   * Use the output dropdown in the header to pick a playback device.
4. **Watch modulation**

   * Camera and render parameters will respond to audio according to the current routing configuration.

This is intentionally minimal: good defaults, not a DAW. The goal is to make it easy to treat `phase-space` like a **visual instrument** in a performance, installation, or studio setup.

---

## Why?

`phase-space` sits somewhere between:

* **numerical toy** – a place to poke at classic attractors and integration settings,
* **visual instrument** – a light and motion source you can drive with sound, and
* **engine** – a Rust core that can live in other projects.

It’s built by a composer / performer working with light, sound, and software as a single practice. The viewer is intentionally “instrument-like” rather than “dashboard-like”: you should be able to open it, drag a few controls, and get something worth watching or recording.

---

## Credits & license

* **Engine & viewer**

  * Rust core / WASM bridge / viewer UI: `phase-space` project (see repo contributors).
* **Tech**

  * Rust, wasm-bindgen, Web Audio API.
  * TypeScript, React, Vite.
  * Three.js / WebGL.

Licensed under the terms in [`LICENSE`](LICENSE).

If you end up using `phase-space` in a performance, installation, or project, a mention is appreciated but not required. PRs, bug reports, and weird use-cases are very welcome.
