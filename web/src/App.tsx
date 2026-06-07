import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AudioDevicesProvider } from "./state/audioDevicesState";
import { ThemeProvider } from "./state/themeState";
import { AboutModalProvider } from "./state/aboutModalState";
import { AboutPage } from "./pages/AboutPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PhaseViewerPage } from "./pages/PhaseViewerPage";

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AudioDevicesProvider>
        <AboutModalProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<PhaseViewerPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/credits" element={<CreditsPage />} />
            </Routes>
          </AppLayout>
        </AboutModalProvider>
      </AudioDevicesProvider>
    </ThemeProvider>
  );
};

export default App;
