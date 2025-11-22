import CanvasPanel from "./canvas/CanvasPanel";
import ControlPanelDesktop from "./controls/ControlPanelDesktop";
import { useViewerState } from "../state/viewerState";

function MainLayout() {
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
    resolution,
    photonWeaveSettings,
    causticsSettings,
    cameraProgram,
    loading,
    error,
  } = useViewerState();

  const viewCamera = sceneSpec?.view?.camera;
  const sceneSeed = sceneSpec?.random_seed ?? undefined;

  return (
    <div className="app-shell-inner grid h-full w-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-x-[clamp(12px,2vw,24px)] md:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
      <aside className="order-2 md:order-1 flex h-full min-h-0 flex-col">
        <ControlPanelDesktop />
      </aside>
      <section className="order-1 md:order-2 flex h-full min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
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
      </section>
    </div>
  );
}

export default MainLayout;
