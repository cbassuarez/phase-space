import React from "react";
import type { CustomPaletteBank, CustomPaletteId } from "../../palettes";
import { CUSTOM_LABELS } from "../../palettes";

interface CustomPaletteEditorProps {
  activeId: CustomPaletteId;
  bank: CustomPaletteBank;
  onSelect: (id: CustomPaletteId) => void;
  onChange: (id: CustomPaletteId, updates: Partial<CustomPaletteBank[CustomPaletteId]>) => void;
}

function CustomPaletteEditor({ activeId, bank, onSelect, onChange }: CustomPaletteEditorProps) {
  const active = bank[activeId];
  if (!active) return null;

  return (
    <div className="space-y-3">
      <label className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">
        Custom palette
      </label>
      <select
        className="w-full rounded-md border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] px-3 py-2 text-sm"
        value={activeId}
        onChange={(e) => onSelect(e.target.value as CustomPaletteId)}
      >
        {(Object.keys(CUSTOM_LABELS) as CustomPaletteId[]).map((id) => (
          <option key={id} value={id}>
            {CUSTOM_LABELS[id]}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-[color:var(--ps-text-soft)]">
        {[
          { label: "Low", key: "low" as const },
          { label: "Mid", key: "mid" as const },
          { label: "High", key: "high" as const },
        ].map((stop) => (
          <label key={stop.key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[color:var(--ps-text-muted)]">{stop.label}</span>
            <input
              type="color"
              className="h-10 w-full cursor-pointer rounded border border-[color:var(--ps-border-subtle)]"
              value={active[stop.key]}
              onChange={(e) => onChange(activeId, { [stop.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12px] text-[color:var(--ps-text-soft)]">
        <input
          type="checkbox"
          checked={active.saturationBoost}
          onChange={(e) => onChange(activeId, { saturationBoost: e.target.checked })}
        />
        Saturation boost
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[color:var(--ps-text-muted)]">
          <span>Gamma</span>
          <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{active.gamma.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.01}
          value={active.gamma}
          onChange={(e) => onChange(activeId, { gamma: parseFloat(e.target.value) })}
          className="accent-[color:var(--ps-accent)]"
        />
      </label>
    </div>
  );
}

export default CustomPaletteEditor;
