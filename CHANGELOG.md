## [1.1.1](https://github.com/cbassuarez/phase-space/compare/v1.1.0...v1.1.1) (2026-06-06)


### Features

* desktop app — native cross-platform builds (macOS, Windows, Linux) via Tauri, wrapping the WebGL/WASM viewer in a native window
* native menu bar with standard keyboard shortcuts (Reload, Toggle Fullscreen, Edit/Window items)
* in-app About modal with links to the repository, releases, and GitHub Sponsors
* styled DMG installer with a drag-to-Applications layout matching the viewer aesthetic



## [1.1.0](https://github.com/cbassuarez/phase-space/compare/v1.0.6...v1.1.0) (2026-06-05)


### Features

* free camera mode — drag to orbit with inertia/acceleration; dragging any autonomous mode grabs and gradually unlatches
* global light/dim theme switch in the top bar, driving both the UI chrome and the viewer
* HDR rendering: UnrealBloom pass (zoom-scaled to stay proportional), in-shader saturation boost, and an attractor opacity control
* tabbed sidebar — Scene / Camera / Audio as folder tabs with sliding panels; collapsible to (semi-)fullscreen the viewer
* live status badge (FPS) and a redesigned Inspector with telemetry, an FPS sparkline, attractor parameters, and transparent-PNG export
* contextual per-style controls: line/cell width, cell shapes (round/cel/square), cloud density, ribbon width, plus weave & caustics tuning
* redesigned audio routing — power-glyph channels (CH1…), consolidated input/output row, and a reactive level meter
* browser-tab favicon mirrors the live attractor
* value-driven slider track fill that follows the thumb


### Bug Fixes

* chase camera is smooth and cinematic instead of jittery and over-fast
* dim background no longer blows line/cells out to a solid white glow; dim is now true black
* ribbon width slider widens the ribbon instead of zooming the attractor
* weave glow no longer flickers; line/ribbon render in colour on dark backgrounds
* PNG export captures a clean transparent cutout and no longer fires phantom downloads on load/focus
* selecting a system or render style no longer resets other selections

## [1.0.6](https://github.com/cbassuarez/phase-space/compare/v1.0.5...v1.0.6) (2025-11-21)


### Bug Fixes

* attractor renders on systems page ([f97da03](https://github.com/cbassuarez/phase-space/commit/f97da0306471ed42ff8253beb31e612b609315e0))

## [1.0.5](https://github.com/cbassuarez/phase-space/compare/v1.0.4...v1.0.5) (2025-11-21)


### Bug Fixes

* github link in header ([f7dca10](https://github.com/cbassuarez/phase-space/commit/f7dca10fc4d1dd4d48fd4e7214fd655ed70d2639))

## [1.0.4](https://github.com/cbassuarez/phase-space/compare/v1.0.3...v1.0.4) (2025-11-21)


### Bug Fixes

* version badge ([d661ad0](https://github.com/cbassuarez/phase-space/commit/d661ad0ab6e904e3fb07032ee75bafb45fc34188))

## [1.0.3](https://github.com/cbassuarez/phase-space/compare/v1.0.2...v1.0.3) (2025-11-21)


### Bug Fixes

* install web deps without npm ci ([47c0026](https://github.com/cbassuarez/phase-space/commit/47c0026d74825bf10577157be02daafa5d83ca8c))

## [1.0.2](https://github.com/cbassuarez/phase-space/compare/v1.0.1...v1.0.2) (2025-11-21)


### Bug Fixes

* versioning ([65991bc](https://github.com/cbassuarez/phase-space/commit/65991bcc80df7973946dbd17734d1624fc1fbe0f))

## [1.0.1](https://github.com/cbassuarez/phase-space/compare/v1.0.0...v1.0.1) (2025-11-21)


### Bug Fixes

* version badge ([6a5c46b](https://github.com/cbassuarez/phase-space/commit/6a5c46b8fb2d5ef7b169a74648b18bc6c9324f67))

# 1.0.0 (2025-11-21)


### Bug Fixes

* add husky ([40966bc](https://github.com/cbassuarez/phase-space/commit/40966bcacc5e9a2c4cdde5f695c47aac85c0591a))
* add package-lock.json ([fd55606](https://github.com/cbassuarez/phase-space/commit/fd556062cbb9aee58cc6ea2d9b6191b913b9055b))
* defaults ([dbb5cb9](https://github.com/cbassuarez/phase-space/commit/dbb5cb9c54c6650e9d33c7e4acf039dab2cf54e0))
* move husky to repo root only ([d8ec95b](https://github.com/cbassuarez/phase-space/commit/d8ec95bcddbf25021b3da295b9071f0d28241816))
* package.json ([fc2555d](https://github.com/cbassuarez/phase-space/commit/fc2555da8006615477150f08604466204e8e0ebe))
* release script ([1d40508](https://github.com/cbassuarez/phase-space/commit/1d405083a180676ddeae99420bcdcf313cef726f))


### Features

* add caustics renderer normalization ([6fcc9df](https://github.com/cbassuarez/phase-space/commit/6fcc9df8af37500b9d33107324cbfcc69d16ae1b))
