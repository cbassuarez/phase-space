import React from "react";
import MainLayout from "../components/MainLayout";
import { ModulationProvider } from "../state/modulationState";
import { ViewerProvider } from "../state/viewerState";

export const PhaseViewerPage: React.FC = () => {
  return (
    <div className="flex flex-1 min-h-0 bg-[color:var(--ps-bg)]">
      <ViewerProvider>
        <ModulationProvider>
          <MainLayout />
        </ModulationProvider>
      </ViewerProvider>
    </div>
  );
};
