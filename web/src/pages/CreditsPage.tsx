import React from "react";
import { ContentPageShell } from "../layouts/ContentPageShell";

export const CreditsPage: React.FC = () => {
  return (
    <ContentPageShell kind="prose">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          Credits
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          Sources and acknowledgments
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed">
          A short list of ideas, systems, and tools that make Phase Space possible.
        </p>
      </header>

      <main className="pb-8 sm:pb-10 lg:pb-12">
        <div className="mt-6 grid gap-4 sm:gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              Systems and background
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
              <li>
                Lorenz system — inspiration from classic work on deterministic chaos
                and weather models.
              </li>
              <li>
                Rössler system — a simple three-dimensional system with a rich spiral
                attractor.
              </li>
              <li>
                Aizawa and Thomas systems — additional chaotic systems chosen for
                their visual behavior in phase space.
              </li>
            </ul>
          </section>

          <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              Libraries and tools
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
              <li>Rust, wasm-bindgen, and wasm-pack for the core integrator.</li>
              <li>Vite and React for the frontend shell and instrument panel.</li>
              <li>Tailwind CSS and IBM Plex Sans/Mono for typography and layout.</li>
              <li>React Three Fiber / WebGL (if present) for the 3D viewer.</li>
            </ul>
          </section>

          <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:col-span-2 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">Project</h2>
            <p className="text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
              Phase Space is an ongoing project exploring how chaotic systems can be
              treated as instruments and visual material. The repository lives on
              GitHub; issues and suggestions are welcome.
            </p>
          </section>
        </div>
      </main>
    </ContentPageShell>
  );
};
