import clsx from "clsx";
import type { CustomPaletteBank, CustomPaletteId } from "../../palettes";

interface CustomPaletteEditorProps {
  bank: CustomPaletteBank;
  activeId: CustomPaletteId;
  onSelect: (id: CustomPaletteId) => void;
  onUpdate: (id: CustomPaletteId, updates: Partial<CustomPaletteBank[CustomPaletteId]>) => void;
}

function CustomPaletteEditor({ bank, activeId, onSelect, onUpdate }: CustomPaletteEditorProps) {
  const current = bank[activeId];
  if (!current) return null;

  return (
    <div className="mt-2 rounded-[10px] bg-[color:var(--ps-panel-bg)] p-3 shadow-[var(--ps-shadow-subtle)]">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]">
        <span>Custom palette</span>
        <select
          className="rounded-md border border-[color:var(--ps-border-subtle)] bg-white px-2 py-1 text-[11px] font-medium text-[color:var(--ps-text-soft)]"
          value={activeId}
          onChange={(e) => onSelect(e.target.value as CustomPaletteId)}
        >
          <option value="custom-1">Custom 1</option>
          <option value="custom-2">Custom 2</option>
          <option value="custom-3">Custom 3</option>
        </select>
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
              value={(current as any)[stop.key] as string}
              onChange={(e) => onUpdate(activeId, { [stop.key]: e.target.value } as any)}
              className={clsx(
                "h-9 w-full rounded-md border border-[color:var(--ps-border-subtle)] bg-white p-0",
                "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
              )}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--ps-text-soft)]">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={current.saturationBoost}
            onChange={(e) => onUpdate(activeId, { saturationBoost: e.target.checked })}
          />
          <span>Saturation boost</span>
        </label>
        <div className="text-[10px] font-medium text-[color:var(--ps-text-muted)]">
          Gamma {current.gamma.toFixed(2)}
        </div>
      </div>
      <input
        type="range"
        min={0.7}
        max={1.3}
        step={0.01}
        value={current.gamma}
        onChange={(e) => onUpdate(activeId, { gamma: parseFloat(e.target.value) })}
        className="mt-1 w-full accent-[color:var(--ps-accent)]"
      />
      <div
        className="mt-3 h-2 rounded-full"
        style={{ background: `linear-gradient(90deg, ${current.low}, ${current.mid}, ${current.high})` }}
      />
    </div>
  );
}

export default CustomPaletteEditor;
