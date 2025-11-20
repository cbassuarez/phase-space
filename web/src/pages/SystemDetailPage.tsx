import React from "react";
import { useParams, Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { getSystem, SystemId } from "../data/systems";
import { presets } from "../data/presets";
import { PresetCard } from "../components/PresetCard";

export const SystemDetailPage: React.FC = () => {
  const params = useParams<{ systemId: string }>();
  const id = (params.systemId ?? "") as SystemId;
  const system = getSystem(id);

  if (!system) {
    return (
      <div>
        <PageHeader
          eyebrow="Systems"
          title="System not found"
          subtitle="The system you requested does not exist."
        >
          <Link to="/systems" className="text-xs text-slate-500 underline">
            Back to systems
          </Link>
        </PageHeader>
      </div>
    );
  }

  const systemPresets = presets.filter((p) => p.system === system.id);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="System"
        title={system.name}
        subtitle={system.descriptionShort}
      >
        <p className="max-w-2xl text-xs text-slate-600">
          You can view this system in the main viewer, browse curated presets, or
          use it as a starting point for your own explorations.
        </p>
      </PageHeader>

      {system.heroImage && (
        <Section title="Figure">
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
            <img
              src={system.heroImage}
              alt={system.name}
              className="h-full w-full object-cover"
            />
            <figcaption className="border-t border-slate-800 bg-slate-950/40 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-200">
              Fig. 01 — {system.name} — default scene.
            </figcaption>
          </figure>
        </Section>
      )}

      <Section
        title="Presets for this system"
        description="Named configurations of parameters, seeds, and camera programs."
      >
        {systemPresets.length === 0 ? (
          <p className="text-sm text-slate-600">
            No presets registered yet for this system—check back later.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {systemPresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Parameters"
        description="Typical ranges and qualitative effects of each parameter."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-left text-xs font-mono text-slate-800">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2 font-semibold">Parameter</th>
                <th className="px-4 py-2 font-semibold">Typical range</th>
                <th className="px-4 py-2 font-semibold">Visual effect</th>
              </tr>
            </thead>
            <tbody>
              {system.parameterSummary.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="px-4 py-2 align-top">{row.name}</td>
                  <td className="px-4 py-2 align-top text-slate-500">
                    {row.range}
                  </td>
                  <td className="px-4 py-2 align-top text-slate-700">
                    {row.effect}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Camera modes that fit"
        description="Modes that tend to show off this system’s geometry."
      >
        <ul className="space-y-3 text-sm text-slate-700">
          {system.recommendedCameraModes.map((mode) => (
            <li key={mode.id}>
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
                {mode.label}
              </span>
              <p>{mode.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="For developers"
        description="A minimal sketch of how this system fits into a SceneSpec."
      >
        <p className="text-sm text-slate-700">
          Under the hood, each system is described by a SceneSpec that bundles
          system id, parameters, integrator settings, initial seeds, and view
          configuration. The viewer turns those into trajectories via a Rust +
          WebAssembly bridge.
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-slate-100">
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
    "background": "dim",
    "point_size": 1.0
  },
  "random_seed": 42
}`}
          </pre>
        </div>
      </Section>
    </div>
  );
};
