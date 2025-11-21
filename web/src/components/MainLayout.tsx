import { useEffect, useRef, useState } from "react";
import CanvasPanel from "./canvas/CanvasPanel";
import ControlPanelDesktop from "./controls/ControlPanelDesktop";
import ControlPanelBottomSheet from "./controls/ControlPanelBottomSheet";
import { useViewerState } from "../state/viewerState";
import { DEFAULT_RENDER_MODE } from "../types";

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
    customPalette,
    background,
    autoSpin,
    animateHeadTail,
    showFullTrajectory,
    lineThickness,
    renderStyle,
    setRenderStyle,
    resolution,
    photonWeaveSettings,
    causticsSettings,
    cameraProgram,
    loading,
    error,
  } = useViewerState();

  const hasAlignedRenderStyle = useRef(false);

  useEffect(() => {
    if (hasAlignedRenderStyle.current) return;

    if (!renderStyle || renderStyle === "photon-weave") {
      setRenderStyle(DEFAULT_RENDER_MODE);
      return;
    }

    hasAlignedRenderStyle.current = true;
  }, [renderStyle, setRenderStyle]);

  const viewCamera = sceneSpec?.view?.camera;
  const sceneSeed = sceneSpec?.random_seed ?? undefined;

  return (
    <main className="flex flex-1 flex-col">
      {isMobile ? (
        <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col px-4">
          <div className="flex-1 min-w-0">
            <CanvasPanel
              ready={ready}
              loading={loading}
              error={error}
              trajectories={trajectories}
              palette={palette}
              customPalette={customPalette}
              background={background}
              camera={viewCamera}
              cameraProgram={cameraProgram}
              randomSeed={sceneSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              lineThickness={lineThickness}
              renderStyle={renderStyle}
              resolution={resolution}
              photonWeaveSettings={photonWeaveSettings}
              causticsSettings={causticsSettings}
            />
          </div>
          <ControlPanelBottomSheet />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-stretch gap-4 px-4 pb-6 pt-4 md:pb-6 md:pt-6">
          <aside className="w-full max-w-xs shrink-0">
            <ControlPanelDesktop />
          </aside>
          <section className="flex min-w-0 flex-1">
            <CanvasPanel
              ready={ready}
              loading={loading}
              error={error}
              trajectories={trajectories}
              palette={palette}
              customPalette={customPalette}
              background={background}
              camera={viewCamera}
              cameraProgram={cameraProgram}
              randomSeed={sceneSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              lineThickness={lineThickness}
              renderStyle={renderStyle}
              resolution={resolution}
              photonWeaveSettings={photonWeaveSettings}
              causticsSettings={causticsSettings}
            />
          </section>
        </div>
      )}
    </main>
  );
}

export default MainLayout;
