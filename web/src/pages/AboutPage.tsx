import React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { systems } from "../data/systems";
import { SystemCard } from "../components/SystemCard";

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="About"
        title="What is Phase Space?"
        subtitle="Phase Space is a small instrument panel for exploring chaotic dynamical systems as moving points in three-dimensional space."
      >
        <p className="max-w-2xl text-xs text-slate-600">
          It’s designed both as a mesmerizing toy to stare at and as a reusable
          engine for other tools and artworks that need attractors, trajectories,
          or phase portraits.
        </p>
      </PageHeader>

      <Section
        title="Why it exists"
        description="Phase Space sits between a sketchbook and an engine: it’s simple enough to play with casually, but structured enough to plug into other projects."
      >
        <p className="text-sm text-slate-700">
          As a toy, it invites you to wander around familiar chaotic systems like
          Lorenz and Rössler, changing parameters and camera modes to see how the
          geometry responds. As an engine, it organizes systems, integrators, and
          cameras into a uniform SceneSpec that can be serialized, shared, and
          eventually embedded elsewhere.
        </p>
        <p className="text-sm text-slate-700">
          Over time, Phase Space will grow a small library of presets, field
          notes, and camera programs—so you can treat it like a little
          attractor-synth rather than a single demo.
        </p>
      </Section>

      <Section
        title="Systems you can explore"
        description="Each system has its own page with presets, parameter notes, and camera suggestions."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {systems.map((system) => (
            <SystemCard key={system.id} system={system} />
          ))}
        </div>
      </Section>

      <Section
        id="how-it-works"
        title="How it works"
        description="From differential equations to pixels: the pipeline that turns systems into moving trajectories."
      >
        <ol className="space-y-3 text-sm text-slate-700">
          <li>
            <span className="font-mono text-xs text-slate-500">
              01 — System
            </span>
            <p>
              Pick a system like Lorenz, Rössler, Aizawa, or Thomas. Each one
              defines a set of differential equations in three variables.
            </p>
          </li>
          <li>
            <span className="font-mono text-xs text-slate-500">
              02 — Integrator
            </span>
            <p>
              The integrator steps those equations forward in time using a
              numerical method, producing trajectories as sequences of points in
              R³.
            </p>
          </li>
          <li>
            <span className="font-mono text-xs text-slate-500">
              03 — SceneSpec
            </span>
            <p>
              A SceneSpec bundles the system, parameters, initial seeds, view
              configuration, and camera program into one JSON-serializable
              description.
            </p>
          </li>
          <li>
            <span className="font-mono text-xs text-slate-500">
              04 — WASM bridge
            </span>
            <p>
              Rust code runs the integrator in WebAssembly, returning arrays of
              points that stay close to the attractor and discard transients.
            </p>
          </li>
          <li>
            <span className="font-mono text-xs text-slate-500">
              05 — Viewer
            </span>
            <p>
              The viewer renders those trajectories with WebGL, applying
              palettes, background styles, and camera motions to produce the final
              image and motion.
            </p>
          </li>
        </ol>
        <p className="pt-2 text-xs text-slate-500">
          You can jump straight into the viewer at any time from the top bar or
          by clicking <Link to="/" className="underline">Open Viewer</Link>.
        </p>
      </Section>

      <Section
        title="Tech stack"
        description="Phase Space uses a small, opinionated stack meant for fast iteration."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            <span className="font-semibold">Rust + WebAssembly</span> for the
            core integrator, system definitions, and trajectory generation.
          </li>
          <li>
            <span className="font-semibold">Vite + React</span> for the
            instrument panel and viewer shell.
          </li>
          <li>
            <span className="font-semibold">Tailwind + IBM Plex</span> for a
            print-inspired, diagram-friendly UI.
          </li>
        </ul>
      </Section>
    </div>
  );
};
