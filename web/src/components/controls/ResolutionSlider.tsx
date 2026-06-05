import type { ChangeEvent } from "react";
import type { Resolution } from "../../types";
import { commandButtonClass } from "./controlStyles";

const resolutionStops: { id: Resolution; label: string }[] = [
    { id: "fast", label: "Fast" },
    { id: "default", label: "Default" },
    { id: "high", label: "High" },
    { id: "ultra", label: "Ultra" },
];

// A native range thumb's centre travels from `thumbRadius` to
// `trackWidth - thumbRadius`, never the literal 0%/100% edges. Place the
// detents on that same path so the thumb sits exactly on each one.
const THUMB_SIZE = "1.08rem"; // matches --ps-res-thumb-size in index.css
function detentLeft(index: number, count: number): string {
    const f = count > 1 ? index / (count - 1) : 0;
    return `calc(${THUMB_SIZE} / 2 + ${f} * (100% - ${THUMB_SIZE}))`;
}

interface ResolutionSliderProps {
    value: Resolution;
    onChange: (value: Resolution) => void;
}

function ResolutionSlider({ value, onChange }: ResolutionSliderProps) {
    const activeIndex = resolutionStops.findIndex((s) => s.id === value);
    const safeIndex = activeIndex === -1 ? 1 : activeIndex;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextIndex = Number(event.target.value);
        const nextStop = resolutionStops[nextIndex];
        if (nextStop) {
            onChange(nextStop.id);
        }
    };

    return (
        <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]">
                    RESOLUTION
                </div>
            </div>

            <div className="group relative flex min-h-[44px] items-center">
                <div className="pointer-events-none absolute inset-0 flex items-center px-[6px]">
                    <div className="relative w-full">
                        <div
                            className="h-[14px] rounded-full bg-[linear-gradient(to_right,#3B82F6,#22C55E,#FACC15,#EF4444)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25),inset_0_0_8px_rgba(0,0,0,0.35)]"
                            style={{ width: "calc(100% + 12px)", marginLeft: "-6px" }}
                        />
                        <div className="absolute inset-0">
                            {resolutionStops.map((stop, i) => {
                                const isActive = stop.id === value;
                                return (
                                    <div
                                        key={stop.id}
                                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-150 ${
                                            isActive
                                                ? "h-2.5 w-2.5 bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                                                : "h-[6px] w-[6px] bg-white/50"
                                        } group-hover:scale-105`}
                                        style={{ left: detentLeft(i, resolutionStops.length) }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <input
                    type="range"
                    min={0}
                    max={resolutionStops.length - 1}
                    step={1}
                    value={safeIndex}
                    onChange={handleChange}
                    className="phase-resolution-slider relative z-10 w-full cursor-pointer appearance-none bg-transparent px-[6px] focus:outline-none"
                    aria-label="Resolution"
                    aria-valuetext={resolutionStops[safeIndex].label}
                />
            </div>

            <div className="flex justify-between text-[10px] text-[color:var(--ps-text-muted)]">
                {resolutionStops.map((stop) => (
                    <button
                        key={stop.id}
                        type="button"
                        aria-pressed={stop.id === value}
                        className={`${commandButtonClass(stop.id === value, { size: "touch" })} relative -top-0.5 px-2 md:min-h-7 md:py-1 md:text-[10px]`}
                        onClick={() => onChange(stop.id)}
                    >
                        {stop.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ResolutionSlider;
