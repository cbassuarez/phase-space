import clsx from "clsx";
import { builtInPalettes, CustomPaletteBank, defaultCustomPaletteBank } from "../../palettes";
import type { CustomPaletteSlotId } from "../../types";
import { useViewerState } from "../../state/viewerState";
import ToggleSwitch from "./ToggleSwitch";

const paletteOptions = [...builtInPalettes.map((p) => ({ id: p.id, label: p.label })), { id: "custom", label: "Custom" }];

function SlotButton({
  slot,
  active,
  onSelect,
}: {
  slot: CustomPaletteSlotId;
  active: boolean;
  onSelect: (slot: CustomPaletteSlotId) => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "rounded-full px-3 py-1 text-xs transition-all",
        active
          ? "bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)] border border-[color:var(--ps-accent)] shadow-[var(--ps-shadow-subtle)]"
          : "text-[color:var(--ps-text-soft)]"
      )}
      onClick={() => onSelect(slot)}
    >
      {slot.replace("custom-", "Custom ")}
    </button>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)]"
      />
    </label>
  );
}

function PaletteControls() {
  const {
    palette,
    setPalette,
    customPaletteSlot,
    setCustomPaletteSlot,
    customPalettes,
    updateCustomPalette,
  } = useViewerState();

  const activeSlot = customPalettes[customPaletteSlot] ?? defaultCustomPaletteBank[customPaletteSlot];

  const handleSlotChange = (slot: CustomPaletteSlotId) => {
    setCustomPaletteSlot(slot);
    setPalette("custom");
  };

  const handleCustomUpdate = (updates: Partial<CustomPaletteBank["custom-1"]>) => {
    updateCustomPalette(customPaletteSlot, updates);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="text-[11px] font-medium tracking-[0.12em] text-[color:var(--ps-text-muted)]">COLOR</div>
      <label className="text-[11px] text-[color:var(--ps-text-soft)]">
        <span className="mb-1 block font-medium text-[color:var(--ps-text)]">Palette</span>
        <select
          className="w-full rounded-lg border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] px-3 py-2 text-sm"
          value={palette}
          onChange={(e) => setPalette(e.target.value as typeof palette)}
        >
          {paletteOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {palette === "custom" && (
        <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] p-3">
          <div className="text-[11px] font-medium tracking-[0.08em] text-[color:var(--ps-text-soft)]">Custom palette slots</div>
          <div className="inline-flex w-full items-center rounded-full bg-[color:var(--ps-panel-bg)] p-1 text-xs">
            {(["custom-1", "custom-2", "custom-3"] as CustomPaletteSlotId[]).map((slot) => (
              <SlotButton key={slot} slot={slot} active={slot === customPaletteSlot} onSelect={handleSlotChange} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ColorInput label="Low" value={activeSlot.low} onChange={(v) => handleCustomUpdate({ low: v })} />
            <ColorInput label="Mid" value={activeSlot.mid} onChange={(v) => handleCustomUpdate({ mid: v })} />
            <ColorInput label="High" value={activeSlot.high} onChange={(v) => handleCustomUpdate({ high: v })} />
          </div>
          <ToggleSwitch
            label="Tri-primary saturation"
            checked={activeSlot.triPrimary}
            onToggle={() => handleCustomUpdate({ triPrimary: !activeSlot.triPrimary })}
          />
          <label className="flex flex-col gap-1 text-[11px] text-[color:var(--ps-text-soft)]">
            <div className="flex items-center justify-between">
              <span>Gamma</span>
              <span className="tabular-nums text-[10px] text-[color:var(--ps-text-muted)]">{activeSlot.gamma.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.3}
              step={0.01}
              value={activeSlot.gamma}
              onChange={(e) => handleCustomUpdate({ gamma: parseFloat(e.target.value) })}
              className="accent-[color:var(--ps-accent)]"
            />
          </label>
        </div>
      )}
    </section>
  );
}

export default PaletteControls;
