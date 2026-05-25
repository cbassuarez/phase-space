import React from "react";
import { Link } from "react-router-dom";

import { ContentPageShell } from "../layouts/ContentPageShell";
import type { SystemId } from "../types";

type AboutSystem = {
  id: SystemId;
  name: string;
  image: string;
  summary: string;
};

const aboutSystemImage = (fileName: string) =>
  `${import.meta.env.BASE_URL}about/systems/${fileName}`;

const aboutSystems: AboutSystem[] = [
  {
    id: "lorenz",
    name: "Lorenz",
    image: aboutSystemImage("lorenz.webp"),
    summary:
      "The classic butterfly: two lobes pulling a trajectory back and forth through a narrow switching region. It is here because it makes chaos legible without making it feel tame.",
  },
  {
    id: "rossler",
    name: "Rössler",
    image: aboutSystemImage("rossler.webp"),
    summary:
      "A spiral that keeps peeling into a folded sheet. It reads like a slow mechanical orbit until the surface turns over and exposes how much motion is hidden in the loop.",
  },
  {
    id: "aizawa",
    name: "Aizawa",
    image: aboutSystemImage("aizawa.webp"),
    summary:
      "A dense, floral knot with paths that wrap through a compact core. It gives the viewer a more volumetric system where the camera can drift through structure rather than orbit a silhouette.",
  },
  {
    id: "thomas",
    name: "Thomas",
    image: aboutSystemImage("thomas.webp"),
    summary:
      "Soft cyclic motion that gathers into ghostlike loops. Thomas is useful as a quieter counterpoint: still chaotic, but less aggressive and more atmospheric.",
  },
  {
    id: "chua",
    name: "Chua",
    image: aboutSystemImage("chua.webp"),
    summary:
      "A dual-scroll system born from an electronic circuit. It matters because its chaos can be soldered together: a physical system with a clean visual snap between two scrolls.",
  },
];

const featureNotes = [
  "Integrates strange attractors in Rust and runs them in the browser through WebAssembly.",
  "Turns trajectories into WebGL scenes with line, ribbon, photon-weave, caustic, and cloud render modes.",
  "Treats the camera as part of the instrument: orbit, chase, lobe, and survey motion change how each system is understood.",
  "Lets audio input and output modulate the image without turning the panel into a wall of knobs.",
];

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)]";

export const AboutPage: React.FC = () => {
  return (
    <ContentPageShell kind="gallery">
      <main className="pb-10 sm:pb-12 lg:pb-16">
        <header className="grid gap-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
          <div className="max-w-3xl">
            <p className={sectionLabel}>About</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--ps-text)] sm:text-5xl lg:text-6xl">
              Phase Space
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--ps-text-soft)] sm:text-lg">
              A strange-attractor sandbox and visual instrument for looking at chaotic systems as moving geometry.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--ps-text-soft)] sm:text-base">
              It sits between a sketchbook, a renderer, and a small cybernetic instrument: pick a system, let the
              equations move, then use camera motion, light, and sound to find the shape inside the motion.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex rounded-lg bg-[color:var(--ps-text)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Open viewer
              </Link>
              <a
                href="#systems"
                className="inline-flex rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--ps-text)] transition hover:border-[color:var(--ps-text-soft)]"
              >
                View systems
              </a>
            </div>
          </div>

          <nav
            aria-label="About page sections"
            className="grid gap-2 border-l border-[color:var(--ps-border-subtle)] pl-4 text-sm text-[color:var(--ps-text-soft)]"
          >
            <a href="#why" className="hover:text-[color:var(--ps-text)]">
              Why this exists
            </a>
            <a href="#what" className="hover:text-[color:var(--ps-text)]">
              What it does
            </a>
            <a href="#systems" className="hover:text-[color:var(--ps-text)]">
              Systems
            </a>
            <a href="#sebastian" className="hover:text-[color:var(--ps-text)]">
              Sebastian
            </a>
            <a href="#more-info" className="hover:text-[color:var(--ps-text)]">
              More info
            </a>
          </nav>
        </header>

        <section id="why" className="mt-12 border-t border-[color:var(--ps-border-subtle)] pt-8 sm:mt-16 sm:pt-10">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <p className={sectionLabel}>Why this exists</p>
            <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-[color:var(--ps-text-soft)] sm:text-base">
              <p>
                I built Phase Space because strange attractors are usually treated as either textbook diagrams or
                screen-saver decoration. I wanted something in between: a working instrument where the math stays
                intact, but the experience is visual, tactile, and a little unstable.
              </p>
              <p>
                The project is also a way to study public systems in miniature. A few equations, a feedback loop, a
                camera, and an input signal can produce behavior that feels alive without pretending to be alive.
              </p>
            </div>
          </div>
        </section>

        <section id="what" className="mt-12 border-t border-[color:var(--ps-border-subtle)] pt-8 sm:mt-16 sm:pt-10">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <p className={sectionLabel}>What it does</p>
            <div className="grid max-w-4xl gap-3 sm:grid-cols-2">
              {featureNotes.map((note) => (
                <div
                  key={note}
                  className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white/70 p-4 text-sm leading-relaxed text-[color:var(--ps-text-soft)]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="systems" className="mt-12 border-t border-[color:var(--ps-border-subtle)] pt-8 sm:mt-16 sm:pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={sectionLabel}>Systems</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--ps-text)]">
                Five ways chaos becomes visible
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-[color:var(--ps-text-soft)]">
              Each image is a local WebP render generated from the system equations, not a screenshot of the old pages.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {aboutSystems.map((system) => (
              <article
                key={system.id}
                className="overflow-hidden rounded-lg border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)]"
              >
                <img
                  src={system.image}
                  alt={`${system.name} attractor render`}
                  className="aspect-[10/7] w-full bg-slate-950 object-cover"
                  loading="lazy"
                />
                <div className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
                      {system.name}
                    </h3>
                    <Link
                      to={`/?system=${system.id}`}
                      className="shrink-0 text-xs font-medium text-[color:var(--ps-text)] underline-offset-2 hover:underline"
                    >
                      Open in viewer
                    </Link>
                  </div>
                  <p className="text-sm leading-relaxed text-[color:var(--ps-text-soft)]">{system.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="sebastian" className="mt-12 border-t border-[color:var(--ps-border-subtle)] pt-8 sm:mt-16 sm:pt-10">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <p className={sectionLabel}>Sebastian</p>
            <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-[color:var(--ps-text-soft)] sm:text-base">
              <p className="text-xl font-semibold tracking-tight text-[color:var(--ps-text)]">
                Sebastian Suarez-Solis is a cybernetic artist, public systems artist, and creative technologist.
              </p>
              <p>
                His work is interested in feedback, infrastructure, signal, and the point where a tool starts acting
                like an environment. Phase Space is one small expression of that: a browser instrument where equations,
                rendering, and input routing become something you can steer.
              </p>
            </div>
          </div>
        </section>

        <section id="more-info" className="mt-12 border-t border-[color:var(--ps-border-subtle)] pt-8 sm:mt-16 sm:pt-10">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <p className={sectionLabel}>More info</p>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
              <div className="space-y-4 text-sm leading-relaxed text-[color:var(--ps-text-soft)] sm:text-base">
                <p>
                  Internally, Phase Space is split into a Rust core, a WebAssembly bridge, and a React/WebGL viewer.
                  A scene model carries the chosen system, parameters, seeds, view settings, and camera behavior.
                </p>
                <p>
                  The goal is not to turn the About page into documentation. It is enough to know that the visuals are
                  generated from the same structured engine the viewer uses.
                </p>
              </div>
              <div className="grid gap-2 text-sm">
                <a className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-4 py-3 text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]" href="https://github.com/cbassuarez" target="_blank" rel="noopener noreferrer">
                  GitHub profile
                </a>
                <a className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-4 py-3 text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]" href="https://github.com/cbassuarez/phase-space" target="_blank" rel="noopener noreferrer">
                  Phase Space repository
                </a>
                <a className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-4 py-3 text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]" href="mailto:contact@cbassuarez.com">
                  contact@cbassuarez.com
                </a>
                <Link className="rounded-lg border border-[color:var(--ps-border-subtle)] bg-white px-4 py-3 text-[color:var(--ps-text)] hover:border-[color:var(--ps-text-soft)]" to="/credits">
                  Credits
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </ContentPageShell>
  );
};
