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
      <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">RESOLUTION</div>

      <div className="phase-resolution-slider-wrapper relative mt-1">
        <input
          type="range"
          min={0}
          max={resolutionStops.length - 1}
          step={1}
          value={safeIndex}
          onChange={handleChange}
          className="phase-resolution-slider relative z-10 w-full cursor-pointer appearance-none bg-transparent focus:outline-none"
          aria-label="Resolution"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
          {resolutionStops.map((stop) => {
            const isActive = stop.id === value;
            return (
              <span
                key={stop.id}
                className={`h-[11px] w-[11px] rounded-full transition-all duration-150 ${
                  isActive
                    ? "bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                    : "bg-white/60 shadow-[0_0_0_1px_rgba(17,24,39,0.15)]"
                }`}
                aria-hidden="true"
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-center text-[10px] text-[color:var(--ps-text-muted)]">
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
