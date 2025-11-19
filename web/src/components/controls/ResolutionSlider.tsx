import { motion } from "framer-motion";
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
  const activeStop = resolutionStops.find((s) => s.id === value) ?? resolutionStops[1];

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">RESOLUTION</div>
      <div className="relative mt-1 h-3 rounded-full bg-gradient-to-r from-[rgba(79,111,255,0.08)] to-[rgba(255,214,107,0.18)] shadow-[var(--ps-shadow-inner)]">
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-soft border border-[color:var(--ps-border-subtle)]"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{ left: activeStop.position, translateX: "-50%" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[color:var(--ps-text-muted)]">
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
