import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AudioDevicesProvider } from "./state/audioDevicesState";
import { AboutPage } from "./pages/AboutPage";
import { SystemsIndexPage } from "./pages/SystemsIndexPage";
import { SystemDetailPage } from "./pages/SystemDetailPage";
import { PresetsPage } from "./pages/PresetsPage";
import { FieldNotesPage } from "./pages/FieldNotesPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PhaseViewerPage } from "./pages/PhaseViewerPage";

const App: React.FC = () => {
  return (
    <AudioDevicesProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<PhaseViewerPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/systems" element={<SystemsIndexPage />} />
          <Route path="/systems/:systemId" element={<SystemDetailPage />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/field-notes" element={<FieldNotesPage />} />
          <Route path="/credits" element={<CreditsPage />} />
        </Routes>
      </AppLayout>
    </AudioDevicesProvider>
  );
};

export default App;
