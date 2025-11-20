import React from "react";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";

export const CreditsPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Credits"
        title="Sources and acknowledgments"
        subtitle="A short list of ideas, systems, and tools that make Phase Space possible."
      />

      <Section title="Systems and background">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
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
      </Section>

      <Section title="Libraries and tools">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Rust, wasm-bindgen, and wasm-pack for the core integrator.</li>
          <li>Vite and React for the frontend shell and instrument panel.</li>
          <li>Tailwind CSS and IBM Plex Sans/Mono for typography and layout.</li>
          <li>React Three Fiber / WebGL (if present) for the 3D viewer.</li>
        </ul>
      </Section>

      <Section title="Project">
        <p className="text-sm text-slate-700">
          Phase Space is an ongoing project exploring how chaotic systems can be
          treated as instruments and visual material. The repository lives on
          GitHub; issues and suggestions are welcome.
        </p>
      </Section>
    </div>
  );
};
