import clsx from "clsx";
import { PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import CanvasPanel from "./canvas/CanvasPanel";
import ControlPanelDesktop from "./controls/ControlPanelDesktop";
import ControlPanelBottomSheet from "./controls/ControlPanelBottomSheet";
import { useViewerState } from "../state/viewerState";
import { useIsMobile } from "../hooks/useIsMobile";
import { useRangeFill } from "../hooks/useRangeFill";
import { setMaterialOpacity } from "./canvas/renderers/materials";
import { setCameraReturnToHome } from "../camera/controller";
import { AnimatePresence } from "framer-motion";
import CustomAttractorModal from "./controls/CustomAttractorModal";

function MainLayout() {
    const isMobile = useIsMobile();
    useRangeFill();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const {
        ready,
        trajectories,
        sceneSpec,
        palette,
        customPalette,
        background,
        autoSpin,
        returnToHome,
        drawTrace,
        traceSpeed,
        traceDecay,
        lineThickness,
        lineWeight,
        cellShape,
        cellSize,
        cloudDensity,
        ribbonWidth,
        attractorOpacity,
        materialStyle,
        materialTransmission,
        renderStyle,
        resolution,
        photonWeaveSettings,
        causticsSettings,
        cameraProgram,
        loading,
        error,
        editingAttractor,
    } = useViewerState();

    // Bridge the React opacity setting into the renderer module (a single
    // alpha multiplier all materials read each frame).
    useEffect(() => {
        setMaterialOpacity(attractorOpacity);
    }, [attractorOpacity]);

    // Bridge the "return to home" camera setting into the controller module.
    useEffect(() => {
        setCameraReturnToHome(returnToHome);
    }, [returnToHome]);

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
                            drawTrace={drawTrace}
                            traceSpeed={traceSpeed}
                            traceDecay={traceDecay}
                            lineThickness={lineThickness}
                            lineWeight={lineWeight}
                            cellShape={cellShape}
                            cellSize={cellSize}
                            cloudDensity={cloudDensity}
                            ribbonWidth={ribbonWidth}
                            materialStyle={materialStyle}
                            materialTransmission={materialTransmission}
                            renderStyle={renderStyle}
                            resolution={resolution}
                            photonWeaveSettings={photonWeaveSettings}
                            causticsSettings={causticsSettings}
                        />
                    </div>
                    <ControlPanelBottomSheet />
                </div>
            ) : (
                <div className="flex h-full w-full flex-1 items-stretch gap-1 px-4 pb-4 pt-4 md:pb-6 md:pt-6">
                    {/* Sidebar: fixed, comfortable width; collapses to give the viewer (semi-)fullscreen */}
                    <aside
                        className={clsx(
                            "flex h-full shrink-0 overflow-hidden transition-[flex-basis,opacity] duration-300 ease-out",
                            sidebarCollapsed
                                ? "basis-0 opacity-0 pointer-events-none"
                                : "basis-[clamp(340px,32vw,500px)] opacity-100"
                        )}
                    >
                        <ControlPanelDesktop onCollapse={() => setSidebarCollapsed(true)} />
                    </aside>

                    {/* Viewer: takes the remaining width, no horizontal scroll */}
                    <section className="relative flex h-full min-w-0 flex-1">
                        {sidebarCollapsed && (
                            <button
                                type="button"
                                onClick={() => setSidebarCollapsed(false)}
                                aria-label="Show controls"
                                title="Show controls"
                                className="absolute left-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text-soft)] shadow-[var(--ps-shadow-soft)] transition hover:text-[color:var(--ps-text)]"
                            >
                                <PanelLeftOpen size={18} />
                            </button>
                        )}
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
                            drawTrace={drawTrace}
                            traceSpeed={traceSpeed}
                            traceDecay={traceDecay}
                            lineThickness={lineThickness}
                            lineWeight={lineWeight}
                            cellShape={cellShape}
                            cellSize={cellSize}
                            cloudDensity={cloudDensity}
                            ribbonWidth={ribbonWidth}
                            materialStyle={materialStyle}
                            materialTransmission={materialTransmission}
                            renderStyle={renderStyle}
                            resolution={resolution}
                            photonWeaveSettings={photonWeaveSettings}
                            causticsSettings={causticsSettings}
                        />
                    </section>
                </div>
            )}
            <AnimatePresence>
                {editingAttractor && (
                    <CustomAttractorModal key={editingAttractor.id} initial={editingAttractor} />
                )}
            </AnimatePresence>
        </div>
    );
}

export default MainLayout;
