import type { ChangeEvent } from "react";
import type { Resolution } from "../../types";

const resolutionStops: { id: Resolution; label: string; position: string }[] = [
  { id: "fast", label: "Fast", position: "0%" },
  { id: "default", label: "Default", position: "33%" },
  { id: "high", label: "High", position: "66%" },
  { id: "ultra", label: "Ultra", position: "100%" },
];

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
        <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">
          RESOLUTION
        </div>
      </div>

      <div className="group relative flex min-h-[44px] items-center">
        <div className="pointer-events-none absolute inset-0 flex items-center px-[6px]">
          <div className="relative w-full">
            <div className="h-[14px] w-full rounded-full bg-[linear-gradient(to_right,#3B82F6,#22C55E,#FACC15,#EF4444)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25),inset_0_0_8px_rgba(0,0,0,0.35)]" />
            <div className="absolute inset-0">
              {resolutionStops.map((stop) => {
                const isActive = stop.id === value;
                return (
                  <div
                    key={stop.id}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-150 ${
                      isActive
                        ? "h-2.5 w-2.5 bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                        : "h-[6px] w-[6px] bg-white/50"
                    } group-hover:scale-105`}
                    style={{ left: stop.position }}
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
        />
      </div>

      <div className="flex justify-between text-[10px] text-[color:var(--ps-text-muted)]">
        {resolutionStops.map((stop) => (
          <button
            key={stop.id}
            className="relative -top-0.5 text-[10px] font-medium"
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
