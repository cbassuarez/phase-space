import type { CustomPaletteState } from "../../palettes";

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
              className="h-9 w-full rounded-md border border-[color:var(--ps-border-subtle)] bg-white p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
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
