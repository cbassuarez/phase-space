import React, { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { presets } from "../data/presets";
import { systems } from "../data/systems";
import { PresetCard } from "../components/PresetCard";

export const PresetsPage: React.FC = () => {
  const [systemFilter, setSystemFilter] = useState<string | "all">("all");

  const filteredPresets = useMemo(() => {
    if (systemFilter === "all") return presets;
    return presets.filter((p) => p.system === systemFilter);
  }, [systemFilter]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Presets"
        title="Scene library"
        subtitle="Named configurations of systems, parameters, and cameras."
      />

      <Section title="Filters">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSystemFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              systemFilter === "all"
                ? "border-slate-900 bg-slate-900 text-slate-50"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            All systems
          </button>
          {systems.map((system) => (
            <button
              key={system.id}
              type="button"
              onClick={() => setSystemFilter(system.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                systemFilter === system.id
                  ? "border-slate-900 bg-slate-900 text-slate-50"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {system.id}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Presets">
        {filteredPresets.length === 0 ? (
          <p className="text-sm text-slate-600">
            No presets match this filter yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredPresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
