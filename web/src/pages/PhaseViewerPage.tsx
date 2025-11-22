import React from "react";
import MainLayout from "../components/MainLayout";
import { ModulationProvider } from "../state/modulationState";
import { ViewerProvider } from "../state/viewerState";

export const PhaseViewerPage: React.FC = () => {
  return (
    <ViewerProvider>
      <ModulationProvider>
        <div className="flex h-full w-full min-h-0 flex-col">
          <MainLayout />
        </div>
      </ModulationProvider>
    </ViewerProvider>
  );
};
