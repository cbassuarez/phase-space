import React from "react";
import { Link } from "react-router-dom";
import { ContentPageShell } from "../layouts/ContentPageShell";
import { systems } from "../data/systems";
import { SystemCard } from "../components/SystemCard";
import VersionBadge from "../components/VersionBadge";
import {
  PHASE_SPACE_VERSION,
  PHASECORE_VERSION,
  PHASEWASM_VERSION,
  PLATFORM_BADGES,
} from "../version";

export const AboutPage: React.FC = () => {
  return (
    <ContentPageShell kind="prose">
      <header className="pt-4 sm:pt-6 lg:pt-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--ps-text-muted)] uppercase">
          About
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[color:var(--ps-text)]">
          What is Phase Space?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[color:var(--ps-text-soft)] leading-relaxed">
          Phase Space is a small instrument panel for exploring chaotic
          dynamical systems as moving points in three-dimensional space.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <VersionBadge label={`phase-space v${PHASE_SPACE_VERSION}`} />
          <VersionBadge label={`phasecore v${PHASECORE_VERSION}`} />
          <VersionBadge label={`phasewasm v${PHASEWASM_VERSION}`} />
          {PLATFORM_BADGES.map((badge) => (
            <VersionBadge key={badge} label={badge} />
          ))}
        </div>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm text-[color:var(--ps-text-soft)]">
          It’s designed both as a mesmerizing toy to stare at and as a reusable
          engine for other tools and artworks that need attractors, trajectories,
          or phase portraits.
        </p>
      </header>

      <main className="pb-8 sm:pb-10 lg:pb-12">
        <section className="space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              Why it exists
            </h2>
            <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
              Phase Space sits between a sketchbook and an engine: it’s simple enough to play with casually, but structured enough to plug into other projects.
            </p>
          </div>
          <div className="space-y-3 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
            <p>
              As a toy, it invites you to wander around familiar chaotic systems like
              Lorenz and Rössler, changing parameters and camera modes to see how the
              geometry responds. As an engine, it organizes systems, integrators, and
              cameras into a uniform SceneSpec that can be serialized, shared, and
              eventually embedded elsewhere.
            </p>
            <p>
              Over time, Phase Space will grow a small library of presets, field
              notes, and camera programs—so you can treat it like a little
              attractor-synth rather than a single demo.
            </p>
          </div>
        </section>

        <section className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              Systems you can explore
            </h2>
            <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
              Each system has its own page with presets, parameter notes, and camera suggestions.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
            {systems.map((system) => (
              <SystemCard key={system.id} system={system} />
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="mt-6 sm:mt-8 space-y-4 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:space-y-5 sm:p-6"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              How it works
            </h2>
            <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
              From differential equations to pixels: the pipeline that turns systems into moving trajectories.
            </p>
          </div>
          <ol className="space-y-3 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
            <li className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                01 — System
              </span>
              <p className="mt-1">
                Pick a system like Lorenz, Rössler, Aizawa, or Thomas. Each one
                defines a set of differential equations in three variables.
              </p>
            </li>
            <li className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                02 — Integrator
              </span>
              <p className="mt-1">
                The integrator steps those equations forward in time using a
                numerical method, producing trajectories as sequences of points in
                R³.
              </p>
            </li>
            <li className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                03 — SceneSpec
              </span>
              <p className="mt-1">
                A SceneSpec bundles the system, parameters, initial seeds, view
                configuration, and camera program into one JSON-serializable
                description.
              </p>
            </li>
            <li className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                04 — WASM bridge
              </span>
              <p className="mt-1">
                Rust code runs the integrator in WebAssembly, returning arrays of
                points that stay close to the attractor and discard transients.
              </p>
            </li>
            <li className="rounded-xl border border-[color:var(--ps-border-subtle)] bg-white/60 p-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]">
                05 — Viewer
              </span>
              <p className="mt-1">
                The viewer renders those trajectories with WebGL, applying
                palettes, background styles, and camera motions to produce the final
                image and motion.
              </p>
            </li>
          </ol>
          <p className="pt-1 text-xs sm:text-sm text-[color:var(--ps-text-muted)]">
            You can jump straight into the viewer at any time from the top bar or
            by clicking <Link to="/" className="underline">Open Viewer</Link>.
          </p>
        </section>

        <section className="mt-6 sm:mt-8 space-y-3 rounded-[18px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-5 shadow-[var(--ps-shadow-soft)] sm:p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
              Tech stack
            </h2>
            <p className="text-sm sm:text-base text-[color:var(--ps-text-soft)]">
              Phase Space uses a small, opinionated stack meant for fast iteration.
            </p>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm sm:text-base leading-relaxed text-[color:var(--ps-text-soft)]">
            <li>
              <span className="font-semibold text-[color:var(--ps-text)]">Rust + WebAssembly</span> for the
              core integrator, system definitions, and trajectory generation.
            </li>
            <li>
              <span className="font-semibold text-[color:var(--ps-text)]">Vite + React</span> for the
              instrument panel and viewer shell.
            </li>
            <li>
              <span className="font-semibold text-[color:var(--ps-text)]">Tailwind + IBM Plex</span> for a
              print-inspired, diagram-friendly UI.
            </li>
          </ul>
        </section>
      </main>
    </ContentPageShell>
  );
};
