import clsx from "clsx";
import { controlFocusRing, controlTransition, disabledState } from "./controlStyles";

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ label, checked, onToggle, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={clsx(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left text-xs font-medium outline-none",
        controlTransition,
        controlFocusRing,
        disabledState,
        checked
          ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)]"
          : "border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] hover:[box-shadow:var(--ps-control-hover-shadow)]",
        "active:translate-y-px active:bg-[color:var(--ps-control-pressed-bg)] active:[box-shadow:var(--ps-control-pressed-shadow)]"
      )}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-[background-color,border-color,box-shadow] duration-150",
          checked
            ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-accent-subtle)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.22)]"
            : "border-[color:var(--ps-control-border)] bg-[color:var(--ps-panel-alt-bg)] shadow-[inset_0_1px_2px_rgba(10,24,64,0.12)]"
        )}
      >
        <span
          className={clsx(
            "h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(10,24,64,0.25),inset_0_1px_0_rgba(255,255,255,0.95)] transition-transform duration-150 ease-out",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

export default ToggleSwitch;
