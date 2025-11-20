import { motion } from "framer-motion";
import type { Resolution } from "../../types";

const STRESS_GRADIENT =
  "linear-gradient(to right, #111827, #22c55e, #facc15, #ef4444)";

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
      <div
        className="relative mt-1 h-3 rounded-full shadow-[var(--ps-shadow-inner)]"
        style={{
          background: STRESS_GRADIENT,
        }}
      >
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-[color:var(--ps-accent-subtle)] bg-white shadow-soft"
          initial={false}
          animate={{ left: activeStop.position }}
          transition={{ type: "spring", stiffness: 360, damping: 22, mass: 0.55 }}
          style={{ translateX: "-50%" }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.92 }}
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
