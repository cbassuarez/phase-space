import React from "react";
import TopBar from "../components/TopBar";
import MainLayout from "../components/MainLayout";
import { ViewerProvider } from "../state/viewerState";

export const PhaseViewerPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--ps-bg)]">
      <ViewerProvider>
        <TopBar />
        <section id="viewer" className="scroll-mt-24">
          <MainLayout />
        </section>
        <section
          id="systems"
          className="border-t border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] py-12 text-[color:var(--ps-text)]"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4">
            <h2 className="text-lg font-semibold tracking-tight">Systems</h2>
            <p className="max-w-3xl text-sm text-[color:var(--ps-text-soft)]">
              Explore a collection of iconic chaotic attractors. Switch between Lorenz, Rössler, Aizawa, and Thomas systems to see
              how each responds to your chosen resolution, palette, and view settings.
            </p>
          </div>
        </section>
        <section id="about" className="bg-[color:var(--ps-bg)] py-12 text-[color:var(--ps-text)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4">
            <h2 className="text-lg font-semibold tracking-tight">About</h2>
            <p className="max-w-3xl text-sm text-[color:var(--ps-text-soft)]">
              phase-space is a lightweight viewer that combines WebAssembly integrations with WebGL rendering. Use it to inspect
              trajectories, experiment with parameters, and enjoy smooth interactions across devices.
            </p>
          </div>
        </section>
      </ViewerProvider>
    </div>
  );
};
