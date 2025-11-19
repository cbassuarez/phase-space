import { useEffect, useState } from "react";
import CanvasPanel from "./canvas/CanvasPanel";
import ControlPanelDesktop from "./controls/ControlPanelDesktop";
import ControlPanelBottomSheet from "./controls/ControlPanelBottomSheet";
import { useViewerState } from "../state/viewerState";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function MainLayout() {
  const isMobile = useIsMobile();
  const {
    ready,
    trajectories,
    sceneSpec,
    palette,
    background,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    cameraProgram,
    loading,
    error,
  } = useViewerState();

  const viewCamera = sceneSpec?.view?.camera;
  const sceneSeed = sceneSpec?.random_seed ?? undefined;

  return (
    <main className="flex flex-1 flex-col">
      {isMobile ? (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
          <div className="flex-1">
            <CanvasPanel
              ready={ready}
              loading={loading}
              error={error}
              trajectories={trajectories}
              palette={palette}
              background={background}
              camera={viewCamera}
              cameraProgram={cameraProgram}
              randomSeed={sceneSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              lineThickness={lineThickness}
            />
          </div>
          <ControlPanelBottomSheet />
        </div>
      ) : (
        <div className="mx-auto flex max-w-6xl flex-1 gap-4 px-4 pb-6 pt-4 md:pb-6 md:pt-6">
          <aside className="w-full max-w-xs flex-shrink-0">
            <ControlPanelDesktop />
          </aside>
          <section className="flex-1 min-w-0">
            <CanvasPanel
              ready={ready}
              loading={loading}
              error={error}
              trajectories={trajectories}
              palette={palette}
              background={background}
              camera={viewCamera}
              cameraProgram={cameraProgram}
              randomSeed={sceneSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              lineThickness={lineThickness}
            />
          </section>
        </div>
      )}
    </main>
  );
}

export default MainLayout;
