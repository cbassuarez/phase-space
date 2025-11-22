import CanvasPanel from "./canvas/CanvasPanel";
import ControlPanelDesktop from "./controls/ControlPanelDesktop";
import ControlPanelBottomSheet from "./controls/ControlPanelBottomSheet";
import { useViewerState } from "../state/viewerState";
import { useIsMobile } from "../hooks/useIsMobile";

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
        <div className="flex w-full flex-1 min-h-0 flex-col">
            {isMobile ? (
                <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-4 pb-4 pt-4">
                    <div className="flex-1 min-h-0 min-w-0">
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
                <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 items-stretch gap-4 px-4 pb-4 pt-4 md:pb-6 md:pt-6">
                    <aside className="flex min-h-0 flex-col basis-[260px] shrink-0">
                        <ControlPanelDesktop />
                    </aside>
                    <section className="flex min-h-0 min-w-0 flex-1">
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
        </div>
    );
}

export default MainLayout;
