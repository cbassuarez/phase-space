import React, { useMemo, useState } from "react";
import { ContentPageShell } from "../layouts/ContentPageShell";
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
    <ContentPageShell kind="gallery">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          Presets
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          Scene library
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed max-w-2xl">
          Named configurations of systems, parameters, and cameras.
        </p>
      </header>

      <section className="pb-8 sm:pb-10 lg:pb-12 space-y-6 sm:space-y-8">
        <div className="rounded-[16px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)] sm:p-5">
          <h2 className="text-sm font-semibold tracking-tight text-[color:var(--ps-text)]">Filters</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSystemFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                systemFilter === "all"
                  ? "border-[color:var(--ps-text)] bg-[color:var(--ps-text)] text-white"
                  : "border-[color:var(--ps-border-subtle)] bg-white text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]"
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
                    ? "border-[color:var(--ps-text)] bg-[color:var(--ps-text)] text-white"
                    : "border-[color:var(--ps-border-subtle)] bg-white text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]"
                }`}
              >
                {system.id}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">Presets</h2>
            <p className="text-xs text-[color:var(--ps-text-muted)]">{filteredPresets.length} total</p>
          </div>
          {filteredPresets.length === 0 ? (
            <p className="text-sm text-[color:var(--ps-text-muted)]">
              No presets match this filter yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPresets.map((preset) => (
                <PresetCard key={preset.id} preset={preset} />
              ))}
            </div>
          )}
        </div>
      </section>
    </ContentPageShell>
  );
};
