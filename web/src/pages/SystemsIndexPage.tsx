import React from "react";
import { ContentPageShell } from "../layouts/ContentPageShell";
import { systems } from "../data/systems";
import { SystemCard } from "../components/SystemCard";

export const SystemsIndexPage: React.FC = () => {
  return (
    <ContentPageShell kind="gallery">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          Systems
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          Systems inside Phase Space
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed max-w-2xl">
          A small field guide to the chaotic dynamical systems you can explore.
        </p>
      </header>

      <section className="pb-8 sm:pb-10 lg:pb-12">
        <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {systems.map((system) => (
            <SystemCard key={system.id} system={system} />
          ))}
        </div>
      </section>
    </ContentPageShell>
  );
};
