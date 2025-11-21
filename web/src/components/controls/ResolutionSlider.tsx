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
      <div className="relative mt-1">
        <input
          type="range"
          min={0}
          max={resolutionStops.length - 1}
          step={1}
          value={safeIndex}
          onChange={handleChange}
          className="phase-resolution-slider w-full cursor-pointer appearance-none bg-transparent focus:outline-none"
          aria-label="Resolution"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[color:var(--ps-text-muted)]">
        {resolutionStops.map((stop) => (
          <button
            key={stop.id}
            className="relative -top-1 text-[10px] font-medium"
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
