import React from "react";
import { useParams, Link } from "react-router-dom";
import { ContentPageShell } from "../layouts/ContentPageShell";
import { getSystem, SystemId } from "../data/systems";
import { presets } from "../data/presets";
import { PresetCard } from "../components/PresetCard";

export const SystemDetailPage: React.FC = () => {
  const params = useParams<{ systemId: string }>();
  const id = (params.systemId ?? "") as SystemId;
  const system = getSystem(id);

  if (!system) {
    return (
      <ContentPageShell kind="gallery">
        <header className="pt-4 sm:pt-6 lg:pt-8">
          <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
            Systems
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
            System not found
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed max-w-2xl">
            The system you requested does not exist.
          </p>
          <div className="mt-4">
            <Link
              to="/systems"
              className="text-xs font-medium text-[color:var(--ps-text)] underline"
            >
              Back to systems
            </Link>
          </div>
        </header>
      </ContentPageShell>
    );
  }

  const systemPresets = presets.filter((p) => p.system === system.id);

  return (
    <ContentPageShell kind="gallery">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          System
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          {system.name}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed max-w-2xl">
          {system.descriptionShort}
        </p>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[color:var(--ps-text-muted)]">
          You can view this system in the main viewer, browse curated presets, or use it as a starting point for your own explorations.
        </p>
      </header>

      <main className="pb-8 sm:pb-10 lg:pb-12">
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
          <section className="space-y-6 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
            {system.heroImage && (
              <figure className="overflow-hidden rounded-[20px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] shadow-[var(--ps-shadow-soft)]">
                <img
                  src={system.heroImage}
                  alt={system.name}
                  className="h-full w-full object-cover"
                />
                <figcaption className="border-t border-[color:var(--ps-border-subtle)] bg-black/50 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--ps-text)]">
                  Fig. 01 — {system.name} — default scene.
                </figcaption>
              </figure>
            )}

            <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
                  Presets for this system
                </h2>
                <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
                  Named configurations of parameters, seeds, and camera programs.
                </p>
              </div>
              {systemPresets.length === 0 ? (
                <p className="text-sm text-[color:var(--ps-text-muted)]">
                  No presets registered yet for this system—check back later.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
                  {systemPresets.map((preset) => (
                    <PresetCard key={preset.id} preset={preset} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
                  Camera modes that fit
                </h2>
                <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
                  Modes that tend to show off this system’s geometry.
                </p>
              </div>
              <ul className="space-y-3">
                {system.recommendedCameraModes.map((mode) => (
                  <li
                    key={mode.id}
                    className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                      {mode.label}
                    </span>
                    <p className="mt-1">{mode.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
                  For developers
                </h2>
                <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
                  A minimal sketch of how this system fits into a SceneSpec.
                </p>
              </div>
              <p>
                Under the hood, each system is described by a SceneSpec that bundles
                system id, parameters, integrator settings, initial seeds, and view
                configuration. The viewer turns those into trajectories via a Rust +
                WebAssembly bridge.
              </p>
              <div className="overflow-hidden rounded-[14px] border border-[color:var(--ps-border-subtle)] bg-slate-950 px-4 py-3 text-xs text-slate-100 shadow-inner">
                <pre className="overflow-x-auto font-mono text-[11px]">
{`{
  "system": "${system.id}",
  "params": { /* system-specific numbers */ },
  "initial_seeds": [
    { "x": [0.1, 0.0, 0.0], "color_index": 0 }
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
}`}
                </pre>
              </div>
            </section>
          </section>

          <aside className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
                Parameters
              </h2>
              <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
                Typical ranges and qualitative effects of each parameter.
              </p>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-[color:var(--ps-border-subtle)] bg-white">
              <table className="min-w-full border-collapse text-left text-xs font-mono text-[color:var(--ps-text)]">
                <thead className="bg-[color:var(--ps-bg-strong)]">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Parameter</th>
                    <th className="px-4 py-2 font-semibold">Typical range</th>
                    <th className="px-4 py-2 font-semibold">Visual effect</th>
                  </tr>
                </thead>
                <tbody>
                  {system.parameterSummary.map((row) => (
                    <tr key={row.name} className="border-t border-[color:var(--ps-border-subtle)]">
                      <td className="px-4 py-2 align-top">{row.name}</td>
                      <td className="px-4 py-2 align-top text-[color:var(--ps-text-muted)]">
                        {row.range}
                      </td>
                      <td className="px-4 py-2 align-top text-[color:var(--ps-text-soft)]">
                        {row.effect}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-[14px] border border-dashed border-[color:var(--ps-border-subtle)] bg-white/60 p-3 text-xs text-[color:var(--ps-text-muted)]">
              Browse presets to jump straight into this system’s geometry, or open the viewer to tweak seeds and cameras live.
            </div>
          </aside>
        </div>
      </main>
    </ContentPageShell>
  );
};
