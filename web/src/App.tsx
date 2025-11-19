import TopBar from "./components/TopBar";
import MainLayout from "./components/MainLayout";
import { ViewerProvider } from "./state/viewerState";

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--ps-bg)]">
      <ViewerProvider>
        <TopBar />
        <MainLayout />
      </ViewerProvider>
    </div>
  );
}

export default App;
