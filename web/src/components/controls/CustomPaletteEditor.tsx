import type { CustomPaletteState } from "../../palettes";
import { controlFocusRing, controlTransition } from "./controlStyles";

interface CustomPaletteEditorProps {
  state: CustomPaletteState;
  onChange: (updates: Partial<CustomPaletteState>) => void;
}

function CustomPaletteEditor({ state, onChange }: CustomPaletteEditorProps) {
  return (
    <div className="mt-2 rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-3 shadow-[var(--ps-shadow-subtle)]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">
        Custom palette
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
        {[
          { key: "low", label: "Low" },
          { key: "mid", label: "Mid" },
          { key: "high", label: "High" },
        ].map((stop) => (
          <label key={stop.key} className="flex flex-col gap-1">
            <span>{stop.label}</span>
            <input
              type="color"
              value={(state as any)[stop.key] as string}
              onChange={(e) => onChange({ [stop.key]: e.target.value } as Partial<CustomPaletteState>)}
              className={`${controlTransition} ${controlFocusRing} h-11 w-full rounded-[8px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] p-1 [box-shadow:var(--ps-control-shadow)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:[box-shadow:var(--ps-control-hover-shadow)] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[6px] [&::-webkit-color-swatch]:border-0`}
            />
          </label>
        ))}
      </div>
      <div
        className="mt-3 h-2 rounded-full border border-[color:var(--ps-accent-subtle)]"
        style={{ background: `linear-gradient(90deg, ${state.low}, ${state.mid}, ${state.high})` }}
      />
    </div>
  );
}

export default CustomPaletteEditor;
